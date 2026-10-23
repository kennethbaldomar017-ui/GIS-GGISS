from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from ..database import get_db
from ..middleware.rbac import get_current_user
from ..models import CalendarEvent, CalendarEventType, User

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def _event_out(e: CalendarEvent) -> dict:
    return {
        "id": str(e.id),
        "title": e.title,
        "type": e.event_type.value if hasattr(e.event_type, "value") else str(e.event_type),
        "date": e.event_date.isoformat() if isinstance(e.event_date, date) else str(e.event_date),
        "time": e.time,
        "location": e.location,
        "purok": e.purok.name if e.purok else None,
        "assigned_to": e.assigned_user.username if e.assigned_user else None,
        "description": e.description,
        "reminder_sent": e.reminder_sent,
    }


@router.get("")
async def list_events(month: int, year: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = (
        select(CalendarEvent)
        .where(
            extract("month", CalendarEvent.event_date) == month,
            extract("year", CalendarEvent.event_date) == year,
        )
        .options(
            selectinload(CalendarEvent.purok),
            selectinload(CalendarEvent.assigned_user),
        )
        .order_by(CalendarEvent.event_date)
    )
    rows = list((await db.scalars(stmt)).all())
    return [_event_out(r) for r in rows]


class EventIn(BaseModel):
    title: str
    event_type: str
    event_date: str
    time: str
    location: str
    purok_id: str | None = None
    assigned_to: str | None = None
    description: str | None = None
    send_reminder: bool = False


@router.post("")
async def create_event(body: EventIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    ev = CalendarEvent(
        title=body.title,
        event_type=CalendarEventType(body.event_type),
        event_date=date.fromisoformat(body.event_date),
        time=body.time,
        location=body.location,
        purok_id=UUID(body.purok_id) if body.purok_id else None,
        assigned_to=UUID(body.assigned_to) if body.assigned_to else None,
        description=body.description,
        reminder_sent=body.send_reminder,
        created_by=user.id,
    )
    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return {"id": str(ev.id), "status": "created"}


@router.delete("/{event_id}")
async def delete_event(event_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    ev = await db.get(CalendarEvent, event_id)
    if not ev:
        raise HTTPException(404, "Event not found")
    await db.delete(ev)
    await db.commit()
    return {"status": "deleted"}
