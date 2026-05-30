"""AI Summary generation — Groq LLM integration.

Generates meeting summaries, action items, and key decisions
using Groq's OpenAI-compatible API (llama-3.3-70b-versatile by default).

Called from post_meeting.run_all_tasks() as Task 1.5 (after transcription
aggregation, before webhook delivery).
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from .models import Meeting, Transcription
from .config import (
    AI_SUMMARY_ENABLED,
    AI_SUMMARY_MAX_TRANSCRIPT_CHARS,
    GROQ_API_KEY,
    GROQ_BASE_URL,
    GROQ_MODEL,
)

logger = logging.getLogger("meeting_api.ai_summary")

MIN_TRANSCRIPT_LENGTH = 30

SYSTEM_PROMPT = """\
You are a meeting assistant. Analyze the transcript and respond with ONLY valid JSON (no markdown fences, no commentary outside JSON):

{
  "summary": "2-3 sentence overview of the meeting",
  "key_decisions": ["decision 1", "decision 2"],
  "action_items": [
    {"task": "what to do", "assignee": "person name or null"},
  ],
  "topics": ["topic 1", "topic 2"]
}

Rules:
- If the transcript is too short or unclear, return empty arrays and a brief summary.
- Extract action items only when clearly stated.
- Respond in the same language as the transcript."""


def _build_transcript_text(
    segments: List[Dict[str, Any]],
    max_chars: int = AI_SUMMARY_MAX_TRANSCRIPT_CHARS,
) -> str:
    """Format transcript segments into a single string, truncating if needed."""
    lines = []
    total = 0
    for seg in segments:
        speaker = seg.get("speaker") or "Unknown"
        text = seg.get("text", "").strip()
        if not text:
            continue
        line = f"{speaker}: {text}"
        if total + len(line) > max_chars:
            remaining = max_chars - total
            if remaining > 50:
                lines.append(line[:remaining] + "...")
            break
        lines.append(line)
        total += len(line)
    return "\n".join(lines)


async def _call_groq(transcript_text: str) -> Optional[Dict[str, Any]]:
    """Call Groq API with the transcript and return parsed summary."""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Transcript:\n\n{transcript_text}"},
        ],
        "temperature": 0.3,
        "max_tokens": 1024,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{GROQ_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
        )

    if response.status_code != 200:
        logger.error(
            "Groq API returned %s for meeting summary generation",
            response.status_code,
        )
        return None

    body = response.json()
    choices = body.get("choices", [])
    if not choices:
        logger.error("Groq returned no choices in response")
        return None
    content = choices[0].get("message", {}).get("content", "").strip()
    if not content:
        logger.error("Groq returned empty content")
        return None

    # Strip markdown fences if present
    if content.startswith("```"):
        content = content.split("\n", 1)[-1]
    if content.endswith("```"):
        content = content.rsplit("```", 1)[0]

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logger.error("Groq returned non-JSON response: %s", content[:300])
        return {"summary": content, "key_decisions": [], "action_items": [], "topics": []}


async def generate_ai_summary(meeting: Meeting, db: AsyncSession) -> bool:
    """Generate AI summary for a completed meeting.

    Returns True if summary was generated (or was already present).
    Returns False if generation was skipped or failed (non-fatal).
    """
    if not AI_SUMMARY_ENABLED:
        return False

    if not GROQ_API_KEY:
        logger.warning("AI_SUMMARY_ENABLED but GROQ_API_KEY is not set")
        return False

    # Skip if already generated
    data = meeting.data if isinstance(meeting.data, dict) else {}
    if data.get("ai_summary"):
        return True

    # Fetch transcription segments
    from sqlalchemy import select

    result = await db.execute(
        select(Transcription)
        .where(Transcription.meeting_id == meeting.id)
        .order_by(Transcription.start_time)
    )
    segments = result.scalars().all()

    if not segments:
        logger.info("No transcript segments for meeting %s", meeting.id)
        return False

    # Convert ORM objects to dicts
    segment_dicts = [
        {
            "speaker": seg.speaker,
            "text": seg.text,
            "start_time": seg.start_time,
        }
        for seg in segments
    ]

    transcript_text = _build_transcript_text(segment_dicts)
    if len(transcript_text.strip()) < MIN_TRANSCRIPT_LENGTH:
        logger.info("Transcript too short for meeting %s", meeting.id)
        return False

    summary_data = await _call_groq(transcript_text)
    if not summary_data:
        return False

    # Store in meeting.data JSONB
    data = dict(meeting.data or {})
    data["ai_summary"] = {
        "summary": summary_data.get("summary", ""),
        "key_decisions": summary_data.get("key_decisions", []),
        "action_items": summary_data.get("action_items", []),
        "topics": summary_data.get("topics", []),
        "model": GROQ_MODEL,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    meeting.data = data
    flag_modified(meeting, "data")

    logger.info(
        "AI summary generated for meeting %s (%d segments, model=%s)",
        meeting.id, len(segment_dicts), GROQ_MODEL,
    )
    return True


async def generate_ai_summary_standalone(meeting_id: int) -> bool:
    """On-demand summary generation — used by POST /meetings/{id}/summary.

    Creates its own DB session to avoid holding connections.
    Re-checks for existing summary to prevent duplicate generation.
    """
    from .database import async_session_local

    try:
        async with async_session_local() as db:
            meeting = await db.get(Meeting, meeting_id)
            if not meeting:
                logger.error("Meeting %s not found for on-demand summary", meeting_id)
                return False

            # Re-check: another task may have generated it already
            data = meeting.data if isinstance(meeting.data, dict) else {}
            if data.get("ai_summary"):
                logger.info("Summary already exists for meeting %s, skipping", meeting_id)
                return True

            success = await generate_ai_summary(meeting, db)
            if success:
                await db.commit()
            return success
    except Exception as e:
        logger.error("On-demand summary failed for meeting %s", meeting_id, exc_info=True)
        return False
