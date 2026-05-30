"""AI Summary API endpoints."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .models import Meeting
from .schemas import AISummaryData, AISummaryResponse
from .auth import get_user_and_token

router = APIRouter(tags=["AI Summary"])


@router.get(
    "/meetings/{meeting_id}/summary",
    response_model=AISummaryResponse,
    summary="Get AI-generated meeting summary",
    dependencies=[Depends(get_user_and_token)],
)
async def get_meeting_summary(
    meeting_id: int = Path(..., gt=0),
    auth_data: tuple = Depends(get_user_and_token),
    db: AsyncSession = Depends(get_db),
):
    """Returns the AI-generated summary for a completed meeting."""
    _, current_user = auth_data
    meeting = (await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.user_id == current_user.id)
    )).scalars().first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    data = meeting.data if isinstance(meeting.data, dict) else {}
    raw_summary = data.get("ai_summary")

    if raw_summary and isinstance(raw_summary, dict):
        summary = AISummaryData.from_raw(raw_summary)
    else:
        summary = None

    return AISummaryResponse(meeting_id=meeting_id, ai_summary=summary)


@router.post(
    "/meetings/{meeting_id}/summary",
    response_model=AISummaryResponse,
    summary="Generate AI summary on-demand",
    dependencies=[Depends(get_user_and_token)],
)
async def generate_meeting_summary(
    meeting_id: int = Path(..., gt=0),
    background_tasks: BackgroundTasks = None,
    auth_data: tuple = Depends(get_user_and_token),
    db: AsyncSession = Depends(get_db),
):
    """Generate AI summary for a meeting that doesn't have one yet."""
    from .config import AI_SUMMARY_ENABLED
    if not AI_SUMMARY_ENABLED:
        raise HTTPException(status_code=503, detail="AI summary is not enabled (set AI_SUMMARY_ENABLED=true)")

    _, current_user = auth_data
    meeting = (await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.user_id == current_user.id)
    )).scalars().first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    data = meeting.data if isinstance(meeting.data, dict) else {}
    if data.get("ai_summary"):
        return AISummaryResponse(
            meeting_id=meeting_id,
            ai_summary=AISummaryData.from_raw(data["ai_summary"]),
        )

    # Generate on-demand in background
    from .ai_summary import generate_ai_summary_standalone
    background_tasks.add_task(generate_ai_summary_standalone, meeting_id)

    return AISummaryResponse(
        meeting_id=meeting_id,
        ai_summary=AISummaryData(
            summary="Summary generation in progress...",
            key_decisions=[],
            action_items=[],
            topics=[],
        ),
    )
