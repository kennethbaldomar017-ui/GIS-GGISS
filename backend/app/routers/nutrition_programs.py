from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlalchemy import select, func, and_, desc
from datetime import datetime, date
from uuid import UUID
from typing import Optional

from ..database import get_db
from ..models.entities import (
    NutritionProgram, ProgramSession, ProgramParticipant, Child, 
    Measurement, OverallStatus, User, Purok, ActivityLog, ActivityLogType,
    ProgramType, FundingSource
)
from ..schemas.nutrition_programs import (
    NutritionProgramIn, NutritionProgramOut, NutritionProgramUpdate,
    ProgramSessionIn, ProgramSessionOut, ProgramSessionUpdate,
    ProgramParticipantIn, ProgramParticipantOut, ProgramSummary,
    NutritionProgramWithSessionsOut
)
from ..middleware.rbac import get_current_user

router = APIRouter(prefix="/api/nutrition-programs", tags=["nutrition-programs"])


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


@router.get("", response_model=list[NutritionProgramOut])
async def list_nutrition_programs_root(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List nutrition programs visible to the authenticated user"""
    query = select(NutritionProgram)
    if current_user.role == "admin":
        if not current_user.barangay_id:
            raise HTTPException(status_code=403, detail="User is not assigned to a barangay")
        query = query.join(Purok, NutritionProgram.purok_id == Purok.id).where(
            Purok.barangay_id == current_user.barangay_id
        )
    result = await db.execute(query)
    programs = result.scalars().all()
    return programs


async def log_activity(
    db: AsyncSession,
    user_id: UUID | None,
    barangay_id: UUID | None,
    action_type: ActivityLogType,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None
):
    """Log activity for audit trail and notifications"""
    log = ActivityLog(
        user_id=user_id,
        barangay_id=barangay_id,
        action_type=action_type,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        details=details or {},
        ip_address=ip_address,
        is_notified=False
    )
    db.add(log)
    await db.flush()
    return log


# ============ NUTRITION PROGRAMS ============

@router.post("/programs", response_model=NutritionProgramOut)
async def create_nutrition_program(
    body: NutritionProgramIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new nutrition program for a purok with AI budget recommendation"""
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verify purok exists and get its barangay for logging
    purok_query = select(Purok).where(Purok.id == body.purok_id)
    purok_result = await db.execute(purok_query)
    purok = purok_result.scalar_one_or_none()
    
    if not purok:
        raise HTTPException(status_code=404, detail="Purok not found")
    
    # Verify admin is in the same barangay as the purok
    if current_user.role == "admin" and purok.barangay_id != current_user.barangay_id:
        raise HTTPException(status_code=403, detail="Not authorized to create program in this purok")
    
    # Generate AI budget recommendation
    from ..services.program_budget_ai import generate_program_budget_recommendation
    ai_recommendation = await generate_program_budget_recommendation(
        db=db,
        program_type=body.program_type,
        funding_source=body.funding_source,
        purok_id=body.purok_id,
        frequency=body.frequency
    )
    
    program = NutritionProgram(
        name=body.name,
        description=body.description,
        program_type=body.program_type,
        funding_source=body.funding_source,
        purok_id=body.purok_id,
        frequency=body.frequency,
        status=body.status,
        government_funded=body.government_funded,
        budget_amount=body.budget_amount or ai_recommendation["recommended_budget"],
        ai_recommended_budget=ai_recommendation["recommended_budget"],
        ai_recommendation_notes=ai_recommendation["recommendation_notes"],
        created_by=current_user.id
    )
    
    db.add(program)
    await db.flush()
    
    # Log activity - use purok's barangay for audit trail
    await log_activity(
        db, 
        current_user.id,
        purok.barangay_id,
        ActivityLogType.other,
        f"Created nutrition program: {body.name} with AI budget recommendation: ₱{ai_recommendation['recommended_budget']:,.2f}",
        resource_type="nutrition_program",
        resource_id=program.id,
        details={
            "program_name": body.name, 
            "program_type": body.program_type,
            "funding_source": body.funding_source,
            "purok_id": str(body.purok_id), 
            "frequency": body.frequency, 
            "government_funded": body.government_funded,
            "ai_recommended_budget": ai_recommendation["recommended_budget"],
            "user_budget": body.budget_amount
        }
    )
    
    await db.commit()
    await db.refresh(program)
    return program


@router.get("/programs", response_model=list[NutritionProgramOut])
async def list_nutrition_programs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List nutrition programs for the user's puroks"""
    query = select(NutritionProgram)
    
    if current_user.role == "admin":
        # Admin sees programs in puroks within their barangay
        barangay_id = current_user.barangay_id
        purok_query = select(Purok.id).where(Purok.barangay_id == barangay_id)
        purok_result = await db.execute(purok_query)
        purok_ids = [p[0] for p in purok_result.all()]
        query = query.where(NutritionProgram.purok_id.in_(purok_ids))
    
    result = await db.execute(query)
    programs = result.scalars().all()
    return programs


@router.get("/programs/{program_id}", response_model=NutritionProgramOut)
async def get_nutrition_program(
    program_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific nutrition program"""
    query = select(NutritionProgram).where(NutritionProgram.id == program_id).options(
        joinedload(NutritionProgram.sessions).joinedload(ProgramSession.participants)
    )
    result = await db.execute(query)
    program = result.unique().scalar_one_or_none()
    
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Check access: admin can only see programs in their barangay's puroks
    if current_user["role"] == "admin":
        purok_query = select(Purok).where(Purok.id == program.purok_id)
        purok_result = await db.execute(purok_query)
        purok = purok_result.scalar_one_or_none()
        if purok and purok.barangay_id != current_user.get("barangay_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return program


@router.put("/programs/{program_id}", response_model=NutritionProgramOut)
async def update_nutrition_program(
    program_id: UUID,
    body: NutritionProgramUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a nutrition program"""
    query = select(NutritionProgram).where(NutritionProgram.id == program_id)
    result = await db.execute(query)
    program = result.scalar_one_or_none()
    
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Check access
    if current_user["role"] == "admin":
        purok_query = select(Purok).where(Purok.id == program.purok_id)
        purok_result = await db.execute(purok_query)
        purok = purok_result.scalar_one_or_none()
        if purok and purok.barangay_id != current_user.get("barangay_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update fields
    for field, value in body.dict(exclude_unset=True).items():
        if value is not None:
            setattr(program, field, value)
    
    # Get purok for barangay logging
    purok_query = select(Purok).where(Purok.id == program.purok_id)
    purok_result = await db.execute(purok_query)
    purok = purok_result.scalar_one_or_none()
    
    await log_activity(
        db,
        current_user["id"],
        purok.barangay_id if purok else None,
        ActivityLogType.other,
        f"Updated nutrition program: {program.name}",
        resource_type="nutrition_program",
        resource_id=program.id,
        details={"updates": body.dict(exclude_unset=True)}
    )
    
    await db.commit()
    await db.refresh(program)
    return program


# ============ PROGRAM SESSIONS ============

@router.post("/programs/{program_id}/sessions", response_model=ProgramSessionOut)
async def create_program_session(
    program_id: UUID,
    body: ProgramSessionIn,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a program session (execution/activity)"""
    # Verify program exists and user has access
    prog_query = select(NutritionProgram).where(NutritionProgram.id == program_id)
    prog_result = await db.execute(prog_query)
    program = prog_result.scalar_one_or_none()
    
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Check access via purok's barangay
    if current_user["role"] == "admin":
        purok_query = select(Purok).where(Purok.id == program.purok_id)
        purok_result = await db.execute(purok_query)
        purok = purok_result.scalar_one_or_none()
        if purok and purok.barangay_id != current_user.get("barangay_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get session purok for barangay logging
    session_purok_query = select(Purok).where(Purok.id == body.purok_id)
    session_purok_result = await db.execute(session_purok_query)
    session_purok = session_purok_result.scalar_one_or_none()
    
    # Create session
    session = ProgramSession(
        program_id=program_id,
        purok_id=body.purok_id,
        session_date=body.session_date,
        location=body.location,
        conducted_by=current_user["id"],
        notes=body.notes,
        total_participants=len(body.participants)
    )
    
    db.add(session)
    await db.flush()
    
    # Add participants
    for participant_data in body.participants:
        participant = ProgramParticipant(
            session_id=session.id,
            child_id=participant_data.child_id,
            attended=participant_data.attended,
            notes=participant_data.notes
        )
        db.add(participant)
    
    await log_activity(
        db,
        current_user["id"],
        session_purok.barangay_id if session_purok else None,
        ActivityLogType.program_session_created,
        f"Created program session for {program.name}",
        resource_type="program_session",
        resource_id=session.id,
        details={
            "program_name": program.name,
            "purok_id": str(body.purok_id),
            "session_date": body.session_date.isoformat(),
            "participant_count": len(body.participants)
        }
    )
    
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/programs/{program_id}/sessions", response_model=list[ProgramSessionOut])
async def list_program_sessions(
    program_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all sessions for a program"""
    query = select(ProgramSession).where(
        ProgramSession.program_id == program_id
    ).options(
        joinedload(ProgramSession.participants)
    ).order_by(desc(ProgramSession.session_date))
    
    result = await db.execute(query)
    sessions = result.unique().scalars().all()
    return sessions


@router.get("/programs/{program_id}/sessions/{session_id}", response_model=ProgramSessionOut)
async def get_program_session(
    program_id: UUID,
    session_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific program session"""
    query = select(ProgramSession).where(
        and_(ProgramSession.id == session_id, ProgramSession.program_id == program_id)
    ).options(joinedload(ProgramSession.participants))
    
    result = await db.execute(query)
    session = result.unique().scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session


@router.put("/programs/{program_id}/sessions/{session_id}", response_model=ProgramSessionOut)
async def update_program_session(
    program_id: UUID,
    session_id: UUID,
    body: ProgramSessionUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a program session"""
    query = select(ProgramSession).where(
        and_(ProgramSession.id == session_id, ProgramSession.program_id == program_id)
    ).options(joinedload(ProgramSession.participants))
    
    result = await db.execute(query)
    session = result.unique().scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if body.location:
        session.location = body.location
    if body.notes:
        session.notes = body.notes
    
    # Update participants if provided
    if body.participants is not None:
        # Delete existing participants
        del_query = select(ProgramParticipant).where(ProgramParticipant.session_id == session_id)
        del_result = await db.execute(del_query)
        for participant in del_result.scalars().all():
            await db.delete(participant)
        
        # Add new participants
        for participant_data in body.participants:
            participant = ProgramParticipant(
                session_id=session_id,
                child_id=participant_data.child_id,
                attended=participant_data.attended,
                notes=participant_data.notes
            )
            db.add(participant)
        
        session.total_participants = len(body.participants)
    
    # Get purok for barangay logging
    purok_query = select(Purok).where(Purok.id == session.purok_id)
    purok_result = await db.execute(purok_query)
    purok = purok_result.scalar_one_or_none()
    
    await log_activity(
        db,
        current_user["id"],
        purok.barangay_id if purok else None,
        ActivityLogType.program_session_updated,
        "Updated program session",
        resource_type="program_session",
        resource_id=session_id,
        details=body.dict(exclude_unset=True)
    )
    
    await db.commit()
    await db.refresh(session)
    return session


# ============ ACTIVITY LOGS & NOTIFICATIONS ============

@router.get("/activity-logs")
async def get_activity_logs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    barangay_id: UUID | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get activity logs with notification support"""
    query = select(ActivityLog).order_by(desc(ActivityLog.created_at))
    
    if current_user["role"] == "super_admin":
        # Super admin sees all logs
        pass
    elif current_user["role"] == "admin":
        # Admin sees logs from their barangay
        barangay_id = current_user.get("barangay_id")
        query = query.where(ActivityLog.barangay_id == barangay_id)
    
    if barangay_id:
        query = query.where(ActivityLog.barangay_id == barangay_id)
    
    result = await db.execute(query.limit(limit).offset(offset))
    logs = result.scalars().all()
    
    # Mark as notified
    for log in logs:
        if not log.is_notified:
            log.is_notified = True
            log.notified_at = datetime.utcnow()
    
    await db.commit()
    
    return [{
        "id": str(log.id),
        "user_id": str(log.user_id) if log.user_id else None,
        "barangay_id": str(log.barangay_id) if log.barangay_id else None,
        "action_type": log.action_type,
        "action": log.action,
        "resource_type": log.resource_type,
        "resource_id": log.resource_id,
        "details": log.details,
        "created_at": log.created_at,
        "is_notified": log.is_notified
    } for log in logs]


@router.get("/unread-notifications")
async def get_unread_notifications(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get unread activity notifications for super admin"""
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can access notifications")
    
    query = select(ActivityLog).where(
        ActivityLog.is_notified == False
    ).order_by(desc(ActivityLog.created_at))
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return [{
        "id": str(log.id),
        "user_id": str(log.user_id) if log.user_id else None,
        "barangay_id": str(log.barangay_id) if log.barangay_id else None,
        "action_type": log.action_type,
        "action": log.action,
        "resource_type": log.resource_type,
        "created_at": log.created_at
    } for log in logs]


# ============ ANALYTICS ============

@router.get("/analytics/summary")
async def get_program_analytics(
    program_id: UUID | None = None,
    barangay_id: UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get nutrition program analytics"""
    if current_user["role"] == "admin":
        barangay_id = current_user.get("barangay_id")
    
    # Get program sessions
    sessions_query = select(ProgramSession).order_by(desc(ProgramSession.session_date))
    
    if program_id:
        sessions_query = sessions_query.where(ProgramSession.program_id == program_id)
    
    if start_date:
        sessions_query = sessions_query.where(ProgramSession.session_date >= start_date)
    if end_date:
        sessions_query = sessions_query.where(ProgramSession.session_date <= end_date)
    
    sessions_result = await db.execute(sessions_query)
    sessions = sessions_result.scalars().all()
    
    # Calculate stats
    total_sessions = len(sessions)
    total_participants = 0
    malnourished_count = 0
    normal_count = 0
    
    for session in sessions:
        total_participants += session.total_participants
        
        # Get participant stats
        for participant in session.participants:
            if participant.measurement:
                if participant.measurement.overall_status in [
                    OverallStatus.severe_acute_malnutrition,
                    OverallStatus.moderate_acute_malnutrition
                ]:
                    malnourished_count += 1
                else:
                    normal_count += 1
    
    return {
        "total_sessions": total_sessions,
        "total_participants": total_participants,
        "malnourished_count": malnourished_count,
        "normal_count": normal_count,
        "malnourished_percentage": (malnourished_count / total_participants * 100) if total_participants > 0 else 0
    }


from pydantic import BaseModel

class ApprovalInput(BaseModel):
    comments: Optional[str] = None


@router.put("/programs/{program_id}/approve", response_model=NutritionProgramOut)
async def approve_nutrition_program(
    program_id: UUID,
    body: ApprovalInput,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role.value != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    program = await db.get(NutritionProgram, program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    program.approval_status = "approved"
    program.comments = body.comments
    await db.commit()
    await db.refresh(program)
    return program


@router.put("/programs/{program_id}/reject", response_model=NutritionProgramOut)
async def reject_nutrition_program(
    program_id: UUID,
    body: ApprovalInput,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role.value != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    program = await db.get(NutritionProgram, program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    program.approval_status = "rejected"
    program.comments = body.comments
    await db.commit()
    await db.refresh(program)
    return program


@router.put("/programs/{program_id}/revision", response_model=NutritionProgramOut)
async def revision_nutrition_program(
    program_id: UUID,
    body: ApprovalInput,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role.value != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    program = await db.get(NutritionProgram, program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    program.approval_status = "revision"
    program.comments = body.comments
    await db.commit()
    await db.refresh(program)
    return program
