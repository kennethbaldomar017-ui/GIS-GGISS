from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from ..database import get_db
from ..middleware.rbac import get_current_user, require_super_admin
from ..models import NutritionProgram, ProgramSession, ProgramParticipant, Child, User, ProgramType, FundingSource, Purok, Report, Barangay

router = APIRouter(prefix="/api/programs", tags=["program-activities"])


@router.get("/enums")
async def get_program_enums():
    """Get enum values for program types and funding sources"""
    return {
        "program_types": [
            {"value": pt.value, "label": pt.value} 
            for pt in ProgramType
        ],
        "funding_sources": [
            {"value": fs.value, "label": fs.value} 
            for fs in FundingSource
        ]
    }


def _program_out(p: NutritionProgram) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "type": p.frequency.value if hasattr(p.frequency, "value") else "monthly",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "time": "08:00 AM",
        "location": p.purok.name if p.purok else "TBA",
        "status": p.status.value if hasattr(p.status, "value") else "active",
        "registered_children": 0,
        "total_children": sum(len(s.participants) for s in p.sessions) if p.sessions else 0,
    }


def _program_query_for_user(user: User):
    stmt = select(NutritionProgram)
    if user.role.value == "admin":
        if not user.barangay_id:
            raise HTTPException(403, "User is not assigned to a barangay")
        stmt = stmt.join(Purok, NutritionProgram.purok_id == Purok.id).where(
            Purok.barangay_id == user.barangay_id
        )
    return stmt


@router.get("")
async def list_programs(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        stmt = (
            _program_query_for_user(user)
            .options(
                selectinload(NutritionProgram.purok),
                selectinload(NutritionProgram.sessions).selectinload(ProgramSession.participants)
            )
            .order_by(NutritionProgram.created_at.desc())
        )
        rows = list((await db.scalars(stmt)).all())
        return [_program_out(r) for r in rows]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error loading programs: {e}")
        import traceback
        traceback.print_exc()
        return []


class CreateProgramIn(BaseModel):
    name: str
    type: str  # program_type
    funding_source: str = "City Funded Program"
    purok_id: UUID
    date: str
    time: str
    description: str | None = None
    status: str = "scheduled"
    estimated_participants: int = 10  # For AI budget calculation


@router.post("")
async def create_program(
    body: CreateProgramIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a simple program with AI budget recommendation"""
    try:
        if user.role.value not in ["admin", "super_admin"]:
            raise HTTPException(403, "Not authorized")
        
        purok_stmt = select(Purok).where(
            Purok.id == body.purok_id,
            Purok.is_archived.is_(False),
        )
        purok = await db.scalar(purok_stmt)

        if not purok:
            raise HTTPException(404, "Selected purok not found or is archived")
        if user.role.value == "admin" and (
            not user.barangay_id or purok.barangay_id != user.barangay_id
        ):
            raise HTTPException(403, "You can only create programs in your assigned barangay")
        
        # Generate AI budget recommendation with fallback
        try:
            from ..services.program_budget_ai import generate_program_budget_recommendation_simple
            ai_recommendation = await generate_program_budget_recommendation_simple(
                db=db,
                program_type=body.type,
                funding_source=body.funding_source,
                estimated_participants=body.estimated_participants,
                purok_id=purok.id
            )
        except Exception as ai_error:
            print(f"AI recommendation error (using fallback): {ai_error}")
            # Fallback recommendation
            ai_recommendation = {
                "recommended_budget": 5000.00,
                "recommendation_notes": f"Fallback budget for {body.type}",
                "breakdown": {}
            }
        
        # Create the program
        program = NutritionProgram(
            name=body.name,
            program_type=body.type,
            funding_source=body.funding_source,
            description=body.description,
            purok_id=purok.id,
            frequency="monthly",
            status="active",
            government_funded=True,
            budget_amount=ai_recommendation.get("recommended_budget", 5000.00),
            ai_recommended_budget=ai_recommendation.get("recommended_budget", 5000.00),
            ai_recommendation_notes=ai_recommendation.get("recommendation_notes", ""),
            created_by=user.id
        )
        
        db.add(program)
        await db.commit()

        created_program_result = await db.execute(
            select(NutritionProgram)
            .where(NutritionProgram.id == program.id)
            .options(
                selectinload(NutritionProgram.purok),
                selectinload(NutritionProgram.sessions).selectinload(ProgramSession.participants),
            )
        )
        created_program = created_program_result.scalar_one()

        result = _program_out(created_program)
        result["ai_budget"] = ai_recommendation
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create program error: {e}")
        import traceback
        traceback.print_exc()
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create program: {str(e)}")


@router.get("/{program_id}")
async def get_program_details(
    program_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get detailed program information including budget and registrations"""
    stmt = (
        _program_query_for_user(user)
        .where(NutritionProgram.id == program_id)
        .options(
            selectinload(NutritionProgram.purok),
            selectinload(NutritionProgram.sessions).selectinload(ProgramSession.participants)
        )
    )
    program = await db.scalar(stmt)
    
    if not program:
        raise HTTPException(404, "Program not found")
    
    # Count registrations
    total_registered = sum(len(s.participants) for s in program.sessions)
    attended_count = sum(sum(1 for p in s.participants if p.attended) for s in program.sessions)
    
    result = _program_out(program)
    result.update({
        "program_type": program.program_type,
        "funding_source": program.funding_source,
        "description": program.description,
        "budget_amount": program.budget_amount,
        "ai_recommended_budget": program.ai_recommended_budget,
        "ai_recommendation_notes": program.ai_recommendation_notes,
        "total_registered": total_registered,
        "attended_count": attended_count,
        "purok_name": program.purok.name if program.purok else "N/A",
    })
    
    return result


def _child_out(c: Child, attended: bool = False, check_in_time: str | None = None) -> dict:
    from datetime import date
    age = 0
    if c.birth_date:
        age = date.today().year - c.birth_date.year
    return {
        "id": str(c.id),
        "name": c.full_name,
        "age": age,
        "sex": c.sex.value if hasattr(c.sex, "value") else "male",
        "qr_code": f"QR-{str(c.id)[:8].upper()}",
        "attended": attended,
        "check_in_time": check_in_time,
    }


@router.get("/{program_id}/children")
async def program_children(program_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    program = await db.scalar(
        _program_query_for_user(user).where(NutritionProgram.id == program_id)
    )
    if not program:
        raise HTTPException(404, "Program not found")

    sessions = list((await db.scalars(
        select(ProgramSession)
        .where(ProgramSession.program_id == program_id)
        .options(selectinload(ProgramSession.participants))
    )).all())
    child_ids = set()
    attended_map = {}
    for s in sessions:
        for p in s.participants:
            child_ids.add(p.child_id)
            if p.attended:
                attended_map[p.child_id] = s.session_date.strftime("%I:%M %p") if s.session_date else "Checked In"
    children = list((await db.scalars(
        select(Child).where(Child.id.in_(child_ids)) if child_ids else select(Child).where(Child.id.is_(None))
    )).all()) if child_ids else []
    return [_child_out(c, c.id in attended_map, attended_map.get(c.id)) for c in children]


class CheckInIn(BaseModel):
    child_id: UUID


@router.post("/{program_id}/check-in")
async def check_in(program_id: UUID, body: CheckInIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    program = await db.scalar(
        _program_query_for_user(user).where(NutritionProgram.id == program_id)
    )
    if not program:
        raise HTTPException(404, "Program not found")

    session = await db.scalar(
        select(ProgramSession).where(ProgramSession.program_id == program_id).order_by(ProgramSession.session_date.desc())
    )
    if not session:
        return {"status": "no_active_session"}
    participant = await db.scalar(
        select(ProgramParticipant).where(
            ProgramParticipant.session_id == session.id,
            ProgramParticipant.child_id == body.child_id,
        )
    )
    if participant:
        participant.attended = True
    else:
        participant = ProgramParticipant(session_id=session.id, child_id=body.child_id, attended=True)
        db.add(participant)
    await db.commit()
    return {"status": "checked_in"}


class ParticipantRegistrationIn(BaseModel):
    child_name: str
    birth_date: str  # YYYY-MM-DD
    sex: str  # "male" or "female"
    weight: float
    height: float
    guardian_name: str
    guardian_contact: str | None = None
    address: str | None = None
    notes: str | None = None


@router.post("/{program_id}/register")
async def register_participant(
    program_id: UUID,
    body: ParticipantRegistrationIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Register a new child participant in the program and save as a permanent record"""
    from datetime import date as date_type
    from ..models.entities import Sex, Purok, Measurement, WazStatus, HazStatus, WhzStatus, OverallStatus
    
    # Get the program and its purok
    program = await db.scalar(
        _program_query_for_user(user).where(NutritionProgram.id == program_id)
    )
    if not program:
        from fastapi import HTTPException
        raise HTTPException(404, "Program not found")
    
    # Get purok details for barangay assignment
    purok = await db.scalar(
        select(Purok).where(Purok.id == program.purok_id)
    )
    if not purok:
        from fastapi import HTTPException
        raise HTTPException(404, "Purok not found for this program")
    
    # Parse birth date
    try:
        birth_date = date_type.fromisoformat(body.birth_date)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(400, "Invalid birth date format. Use YYYY-MM-DD")
    
    # Calculate age in months
    today = date_type.today()
    age_months = (today.year - birth_date.year) * 12 + (today.month - birth_date.month)
    if today.day < birth_date.day:
        age_months -= 1
    
    # Create or find the child record
    sex_enum = Sex.male if body.sex.lower() == "male" else Sex.female
    
    # Check if child already exists by name and birth_date in the same purok
    existing_child = await db.scalar(
        select(Child).where(
            Child.full_name == body.child_name,
            Child.birth_date == birth_date,
            Child.purok_id == program.purok_id
        )
    )
    
    if existing_child:
        child_id = existing_child.id
        # Update guardian info if provided
        if body.guardian_name:
            existing_child.guardian_name = body.guardian_name
        if body.guardian_contact:
            existing_child.contact_number = body.guardian_contact
    else:
        # Create new child record with default coordinates (will be updated later)
        new_child = Child(
            full_name=body.child_name,
            birth_date=birth_date,
            sex=sex_enum,
            guardian_name=body.guardian_name,
            contact_number=body.guardian_contact,
            purok_id=program.purok_id,
            barangay_id=purok.barangay_id,
            latitude=0.0,  # Default, should be updated by BHW later
            longitude=0.0,  # Default, should be updated by BHW later
            is_active=True
        )
        db.add(new_child)
        await db.flush()
        child_id = new_child.id
    
    # Calculate WHO z-scores and nutritional status
    from ..utils.who_zscore import calculate_full_assessment
    sex_for_calc = "male" if body.sex.lower() == "male" else "female"
    assessment = calculate_full_assessment(sex_for_calc, age_months, body.weight, body.height)
    
    # Extract values from assessment and convert to enum types
    waz = assessment["waz"]
    haz = assessment["haz"]
    whz = assessment["whz"]
    
    # Convert string statuses to enum values
    waz_status = WazStatus[assessment["waz_status"]]
    haz_status = HazStatus[assessment["haz_status"]]
    whz_status = WhzStatus[assessment["whz_status"]]
    overall_status = OverallStatus[assessment["overall_status"]]
    
    # Create measurement record
    measurement = Measurement(
        child_id=child_id,
        measured_by=user.id,
        measurement_date=today,
        age_in_months=age_months,
        weight_kg=body.weight,
        height_cm=body.height,
        muac_cm=None,
        waz=waz,
        haz=haz,
        whz=whz,
        waz_status=waz_status,
        haz_status=haz_status,
        whz_status=whz_status,
        overall_status=overall_status
    )
    db.add(measurement)
    await db.flush()
    
    # Get or create active session for this program
    session = await db.scalar(
        select(ProgramSession)
        .where(ProgramSession.program_id == program_id)
        .order_by(ProgramSession.session_date.desc())
    )
    
    if not session:
        # Create a new session for today
        session = ProgramSession(
            program_id=program_id,
            purok_id=program.purok_id,
            session_date=datetime.now(),
            location=body.address or purok.name,
            conducted_by=user.id,
            notes=f"Registration session for {program.name}",
            total_participants=0
        )
        db.add(session)
        await db.flush()
    
    # Check if already registered in this session
    existing_participant = await db.scalar(
        select(ProgramParticipant).where(
            ProgramParticipant.session_id == session.id,
            ProgramParticipant.child_id == child_id
        )
    )
    
    if not existing_participant:
        # Add child as participant
        participant = ProgramParticipant(
            session_id=session.id,
            child_id=child_id,
            measurement_id=measurement.id,
            attended=True,  # Registered means attended
            notes=body.notes
        )
        db.add(participant)
        
        # Update session participant count
        session.total_participants += 1
    else:
        # Update existing participant with new measurement
        existing_participant.measurement_id = measurement.id
        existing_participant.attended = True
        if body.notes:
            existing_participant.notes = body.notes
    
    await db.commit()
    
    return {
        "status": "success",
        "child_id": str(child_id),
        "measurement_id": str(measurement.id),
        "message": f"{body.child_name} successfully registered for {program.name}"
    }


# Program Approval Endpoints for SuperAdmin

class ProgramApprovalIn(BaseModel):
    status: str  # "approved", "revision", "rejected"
    comments: str | None = None



@router.get("/approval/pending")
async def get_pending_approvals(db: AsyncSession = Depends(get_db), _=Depends(require_super_admin)):
    """Get all programs pending approval (SuperAdmin only)"""
    try:
        stmt = (
            select(NutritionProgram)
            .where(NutritionProgram.approval_status == "pending")
            .options(
                selectinload(NutritionProgram.purok),
                selectinload(NutritionProgram.creator)
            )
            .order_by(NutritionProgram.created_at.desc())
        )
        programs = list((await db.scalars(stmt)).all())
        
        result = []
        for p in programs:
            result.append({
                "id": str(p.id),
                "name": p.name,
                "description": p.description,
                "frequency": p.frequency.value if hasattr(p.frequency, "value") else "monthly",
                "status": p.status.value if hasattr(p.status, "value") else "active",
                "approval_status": p.approval_status,
                "government_funded": p.government_funded,
                "budget_amount": p.budget_amount,
                "purok": {
                    "id": str(p.purok.id),
                    "name": p.purok.name
                } if p.purok else None,
                "created_by": {
                    "id": str(p.creator.id),
                    "username": p.creator.username,
                    "email": p.creator.email
                } if p.creator else None,
                "created_at": p.created_at.isoformat(),
                "comments": p.comments
            })
        
        return result
    except Exception as e:
        print(f"Error loading pending approvals: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error loading pending approvals: {str(e)}")


@router.get("/approval/all-requests")
async def get_all_approval_requests(db: AsyncSession = Depends(get_db), _=Depends(require_super_admin)):
    """Get all programs with approval requests (SuperAdmin only)"""
    try:
        stmt = (
            select(NutritionProgram)
            .where(NutritionProgram.approval_status.in_(["pending", "revision", "rejected"]))
            .options(
                selectinload(NutritionProgram.purok),
                selectinload(NutritionProgram.creator)
            )
            .order_by(NutritionProgram.created_at.desc())
        )
        programs = list((await db.scalars(stmt)).all())
        
        result = []
        for p in programs:
            result.append({
                "id": str(p.id),
                "name": p.name,
                "description": p.description,
                "frequency": p.frequency.value if hasattr(p.frequency, "value") else "monthly",
                "approval_status": p.approval_status,
                "government_funded": p.government_funded,
                "budget_amount": p.budget_amount,
                "purok": {
                    "id": str(p.purok.id),
                    "name": p.purok.name
                } if p.purok else None,
                "created_by": {
                    "id": str(p.creator.id),
                    "username": p.creator.username,
                    "email": p.creator.email
                } if p.creator else None,
                "created_at": p.created_at.isoformat(),
                "comments": p.comments
            })
        
        return result
    except Exception as e:
        print(f"Error loading approval requests: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error loading approval requests: {str(e)}")


@router.post("/{program_id}/approve")
async def approve_program(
    program_id: UUID,
    body: ProgramApprovalIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_super_admin)
):
    """Approve a program (SuperAdmin only)"""
    program = await db.scalar(
        _program_query_for_user(user).where(NutritionProgram.id == program_id)
    )
    
    if not program:
        raise HTTPException(404, "Program not found")
    
    if body.status not in ["approved", "revision", "rejected"]:
        raise HTTPException(400, "Invalid status. Use 'approved', 'revision', or 'rejected'")
    
    program.approval_status = body.status
    program.comments = body.comments
    await db.commit()
    await db.refresh(program)
    
    return {
        "status": "success",
        "message": f"Program '{program.name}' has been marked as {body.status}",
        "program_id": str(program.id),
        "approval_status": program.approval_status,
        "comments": program.comments
    }


@router.post("/{program_id}/reject")
async def reject_program(
    program_id: UUID,
    body: ProgramApprovalIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_super_admin)
):
    """Reject a program with comments (SuperAdmin only)"""
    program = await db.scalar(
        select(NutritionProgram).where(NutritionProgram.id == program_id)
    )
    
    if not program:
        raise HTTPException(404, "Program not found")
    
    program.approval_status = "rejected"
    program.comments = body.comments or "Program rejected by SuperAdmin"
    await db.commit()
    await db.refresh(program)
    
    return {
        "status": "success",
        "message": f"Program '{program.name}' has been rejected",
        "program_id": str(program.id),
        "approval_status": program.approval_status,
        "rejection_reason": program.comments
    }


@router.get("/{program_id}/approval-details")
async def get_approval_details(
    program_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin)
):
    """Get detailed approval information for a program"""
    program = await db.scalar(
        select(NutritionProgram)
        .where(NutritionProgram.id == program_id)
        .options(
            selectinload(NutritionProgram.purok),
            selectinload(NutritionProgram.creator),
            selectinload(NutritionProgram.sessions).selectinload(ProgramSession.participants)
        )
    )
    
    if not program:
        raise HTTPException(404, "Program not found")
    
    # Count total participants
    total_participants = sum(len(s.participants) for s in program.sessions) if program.sessions else 0
    
    return {
        "id": str(program.id),
        "name": program.name,
        "description": program.description,
        "frequency": program.frequency.value if hasattr(program.frequency, "value") else "monthly",
        "status": program.status.value if hasattr(program.status, "value") else "active",
        "approval_status": program.approval_status,
        "government_funded": program.government_funded,
        "budget_amount": program.budget_amount,
        "total_sessions": len(program.sessions) if program.sessions else 0,
        "total_participants": total_participants,
        "purok": {
            "id": str(program.purok.id),
            "name": program.purok.name,
            "code": program.purok.code
        } if program.purok else None,
        "created_by": {
            "id": str(program.creator.id),
            "username": program.creator.username,
            "email": program.creator.email
        } if program.creator else None,
        "created_at": program.created_at.isoformat(),
        "updated_at": program.updated_at.isoformat() if program.updated_at else None,
        "comments": program.comments
    }


@router.delete("/{program_id}")
async def delete_program(
    program_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Delete a program (Admin and SuperAdmin only)"""
    if user.role.value not in ["admin", "super_admin"]:
        raise HTTPException(403, "Not authorized to delete programs")
    
    program = await db.scalar(
        _program_query_for_user(user).where(NutritionProgram.id == program_id)
    )
    
    if not program:
        raise HTTPException(404, "Program not found")
    
    # Delete related sessions and participants first
    sessions = list((await db.scalars(
        select(ProgramSession).where(ProgramSession.program_id == program_id)
    )).all())
    
    for session in sessions:
        # Delete participants
        participants = list((await db.scalars(
            select(ProgramParticipant).where(ProgramParticipant.session_id == session.id)
        )).all())
        
        for participant in participants:
            await db.delete(participant)
        
        # Delete session
        await db.delete(session)
    
    # Delete the program
    await db.delete(program)
    await db.commit()
    
    return {
        "status": "success",
        "message": f"Program '{program.name}' has been deleted",
        "program_id": str(program_id)
    }


@router.post("/{program_id}/generate-report")
async def generate_program_report(
    program_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Generate a formal program activity report and save it to reports"""
    from ..models.entities import ReportStatus, ReportType
    from datetime import date
    
    print(f"\n=== FORMAL REPORT GENERATION START ===")
    print(f"Program ID: {program_id}")
    print(f"User: {user.username} (ID: {user.id})")
    
    try:
        # Get the program with related data
        stmt = (
            _program_query_for_user(user)
            .where(NutritionProgram.id == program_id)
            .options(
                selectinload(NutritionProgram.purok),
                selectinload(NutritionProgram.sessions).selectinload(ProgramSession.participants)
            )
        )
        program = await db.scalar(stmt)
        
        if not program:
            print(f"ERROR: Program not found with ID {program_id}")
            raise HTTPException(status_code=404, detail="Program not found")
        
        print(f"Program found: {program.name}")
        
        # Attribute reports to the barangay where the program is scheduled.
        program_barangay_id = program.purok.barangay_id if program.purok else None
        barangay = await db.get(Barangay, program_barangay_id) if program_barangay_id else None
        budget_amount = float(program.budget_amount or 0)
        
        # Calculate statistics
        total_sessions = len(program.sessions) if program.sessions else 0
        total_participants = sum(len(s.participants) for s in program.sessions) if program.sessions else 0
        attended_count = sum(sum(1 for p in s.participants if p.attended) for s in program.sessions) if program.sessions else 0
        
        # Calculate per-session data
        session_details = []
        if program.sessions:
            for session in program.sessions:
                participants = session.participants if session.participants else []
                attended = sum(1 for p in participants if p.attended)
                session_details.append({
                    "date": session.session_date.isoformat() if session.session_date else "N/A",
                    "participants": len(participants),
                    "attended": attended,
                    "attendance_rate": f"{(attended / len(participants) * 100):.1f}%" if participants else "0%"
                })
        
        attendance_rate = f"{(attended_count / total_participants * 100):.1f}%" if total_participants > 0 else "0%"
        
        print(f"Stats - Sessions: {total_sessions}, Participants: {total_participants}, Attended: {attended_count}")
        
        # Create comprehensive formal report data
        report_data = {
            # Header Information
            "report_type": "PROGRAM ACTIVITY REPORT",
            "report_number": f"PAR-{date.today().year}-{program_id.hex[:6].upper()}",
            "department": "City Health Office",
            "city": "Cabadbaran City",
            "province": "Agusan del Norte",
            "region": "CARAGA",
            "report_date": date.today().isoformat(),
            "prepared_by": user.username,
            "barangay": barangay.name if barangay else "N/A",
            
            # Program Information
            "program_name": program.name,
            "program_type": program.program_type if hasattr(program, 'program_type') else "General Nutrition Program",
            "program_description": program.description if hasattr(program, 'description') else f"Implementation of {program.name} program",
            "funding_source": program.funding_source if hasattr(program, 'funding_source') else "Municipal Fund",
            "budget_allocated": budget_amount,
            "location": program.purok.name if program.purok else "Various Locations",
            "implementation_period": "Monthly",
            
            # Program Statistics
            "statistics": {
                "total_sessions_conducted": total_sessions,
                "total_participants": total_participants,
                "total_attended": attended_count,
                "attendance_rate": attendance_rate,
                "session_details": session_details,
            },
            
            # Key Performance Indicators (KPIs)
            "kpis": [
                {
                    "indicator": "Program Implementation Rate",
                    "target": "100%",
                    "actual": f"{((total_sessions / max(total_sessions, 1)) * 100):.1f}%",
                    "status": "On-Track"
                },
                {
                    "indicator": "Participant Attendance Rate",
                    "target": "90%",
                    "actual": attendance_rate,
                    "status": "On-Track" if float(attendance_rate.rstrip('%')) >= 90 else "At Risk"
                },
                {
                    "indicator": "Program Coverage",
                    "target": "100% of target beneficiaries",
                    "actual": f"{total_participants} participants",
                    "status": "Achieved"
                },
            ],
            
            # Accomplishments
            "accomplishments": [
                f"Successfully conducted {total_sessions} program sessions",
                f"Reached {total_participants} total participants",
                f"Achieved {attendance_rate} average attendance rate",
                f"Total budget utilization: ₱{budget_amount:,.2f}",
                "Provided nutrition education and health monitoring services",
            ],
            
            # Challenges (if any)
            "challenges": [
                "Weather conditions affecting attendance",
                "Geographic distance in remote areas",
            ] if attendance_rate != "100%" else ["No major challenges reported"],
            
            # Recommendations
            "recommendations": [
                "Continue implementation of program activities",
                f"Maintain current implementation strategy with {attendance_rate} attendance rate",
                "Monitor participant engagement and adjust activities as needed",
                "Allocate resources for underserved areas",
                "Schedule follow-up sessions for missed participants",
            ],
            
            # Compliance & Quality
            "compliance": {
                "budget_utilization": f"{(budget_amount / max(budget_amount, 1)) * 100:.1f}%",
                "activity_completion": "100%",
                "documentation_status": "Complete",
                "quality_assurance": "Satisfactory",
            },
            
            # Metadata
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "report_category": "program_activities",
            "status": "SUBMITTED FOR APPROVAL",
        }
        
        report_title = f"Program Activity Report: {program.name}"
        print(f"Creating formal report: {report_title}")
        
        # Create report record
        report = Report(
            title=report_title,
            report_type=ReportType.program_activities,
            barangay_id=program_barangay_id,
            generated_by=user.id,
            period_start=datetime.now(timezone.utc).date(),
            period_end=datetime.now(timezone.utc).date(),
            data=report_data,
            status=ReportStatus.submitted,
        )
        
        db.add(report)
        await db.commit()
        await db.refresh(report)
        
        print(f"Formal report created successfully with ID: {report.id}")
        print(f"=== FORMAL REPORT GENERATION SUCCESS ===\n")
        
        # Return plain dict (FastAPI will handle JSON serialization)
        return {
            "status": "success",
            "message": f"Formal report '{report_title}' created successfully!",
            "report_id": str(report.id),
            "report": {
                "id": str(report.id),
                "title": report.title,
                "type": report.report_type.value,
                "number": report_data["report_number"],
                "generated_at": report.generated_at.isoformat(),
                "status": "SUBMITTED FOR APPROVAL",
            }
        }
    
    except HTTPException as he:
        print(f"HTTP Exception: {he.status_code} - {he.detail}")
        raise he
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"=== FORMAL REPORT GENERATION FAILED ===\n")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
