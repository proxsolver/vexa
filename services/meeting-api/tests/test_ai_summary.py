"""Tests for AI Summary feature — Groq LLM integration."""

import json
import os
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from meeting_api.ai_summary import (
    _build_transcript_text,
    generate_ai_summary,
)
from meeting_api.models import Meeting, Transcription


# ---------------------------------------------------------------------------
# Unit tests — transcript formatting
# ---------------------------------------------------------------------------

class TestBuildTranscriptText:
    def test_basic_formatting(self):
        segments = [
            {"speaker": "Alice", "text": "Hello everyone"},
            {"speaker": "Bob", "text": "Hi Alice"},
        ]
        result = _build_transcript_text(segments)
        assert "Alice: Hello everyone" in result
        assert "Bob: Hi Alice" in result

    def test_truncation(self):
        segments = [{"speaker": "A", "text": "x" * 1000}] * 100
        result = _build_transcript_text(segments, max_chars=500)
        assert len(result) <= 600  # truncation + "..."

    def test_empty_segments(self):
        result = _build_transcript_text([])
        assert result == ""

    def test_skips_empty_text(self):
        segments = [
            {"speaker": "A", "text": "hello"},
            {"speaker": "B", "text": ""},
            {"speaker": "C", "text": "world"},
        ]
        result = _build_transcript_text(segments)
        assert "B:" not in result

    def test_unknown_speaker_fallback(self):
        segments = [{"speaker": None, "text": "test"}]
        result = _build_transcript_text(segments)
        assert "Unknown: test" in result


# ---------------------------------------------------------------------------
# Integration tests — generate_ai_summary
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_meeting():
    m = MagicMock(spec=Meeting)
    m.id = 42
    m.user_id = 1
    m.data = {}
    return m


@pytest.fixture
def mock_segments():
    segs = []
    for i, (speaker, text) in enumerate([
        ("Alice", "Let's discuss the quarterly targets."),
        ("Bob", "We need to increase revenue by 20%."),
        ("Alice", "Action item: Bob will prepare the report by Friday."),
    ]):
        s = MagicMock(spec=Transcription)
        s.speaker = speaker
        s.text = text
        s.start_time = float(i * 10)
        segs.append(s)
    return segs


class TestGenerateAISummary:
    @pytest.mark.asyncio
    async def test_disabled_skips(self, mock_meeting):
        """When AI_SUMMARY_ENABLED=false, skip generation."""
        mock_db = AsyncMock()
        with patch("meeting_api.ai_summary.AI_SUMMARY_ENABLED", False):
            result = await generate_ai_summary(mock_meeting, mock_db)
        assert result is False

    @pytest.mark.asyncio
    async def test_no_api_key_skips(self, mock_meeting):
        """When GROQ_API_KEY is empty, skip with warning."""
        mock_db = AsyncMock()
        with patch("meeting_api.ai_summary.AI_SUMMARY_ENABLED", True), \
             patch("meeting_api.ai_summary.GROQ_API_KEY", ""):
            result = await generate_ai_summary(mock_meeting, mock_db)
        assert result is False

    @pytest.mark.asyncio
    async def test_already_generated_skips(self, mock_meeting):
        """When summary already exists in data, return True without calling LLM."""
        mock_meeting.data = {"ai_summary": {"summary": "existing"}}
        mock_db = AsyncMock()
        with patch("meeting_api.ai_summary.AI_SUMMARY_ENABLED", True), \
             patch("meeting_api.ai_summary.GROQ_API_KEY", "test-key"):
            result = await generate_ai_summary(mock_meeting, mock_db)
        assert result is True

    @pytest.mark.asyncio
    async def test_no_segments_skips(self, mock_meeting, mock_segments):
        """When meeting has no transcript segments, skip."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("meeting_api.ai_summary.AI_SUMMARY_ENABLED", True), \
             patch("meeting_api.ai_summary.GROQ_API_KEY", "test-key"):
            result = await generate_ai_summary(mock_meeting, mock_db)
        assert result is False

    @pytest.mark.asyncio
    async def test_successful_generation(self, mock_meeting, mock_segments):
        """Happy path: segments → Groq call → summary stored in meeting.data."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_segments
        mock_db.execute = AsyncMock(return_value=mock_result)

        groq_response = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "summary": "Discussion about quarterly targets.",
                        "key_decisions": ["Increase revenue by 20%"],
                        "action_items": [{"task": "Prepare report", "assignee": "Bob"}],
                        "topics": ["quarterly targets", "revenue"],
                    })
                }
            }]
        }

        mock_httpx_response = MagicMock()
        mock_httpx_response.status_code = 200
        mock_httpx_response.json.return_value = groq_response

        with patch("meeting_api.ai_summary.AI_SUMMARY_ENABLED", True), \
             patch("meeting_api.ai_summary.GROQ_API_KEY", "test-key"), \
             patch("meeting_api.ai_summary.flag_modified"), \
             patch("meeting_api.ai_summary.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_httpx_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            result = await generate_ai_summary(mock_meeting, mock_db)

        assert result is True
        assert "ai_summary" in mock_meeting.data
        assert mock_meeting.data["ai_summary"]["summary"] == "Discussion about quarterly targets."
        assert mock_meeting.data["ai_summary"]["key_decisions"] == ["Increase revenue by 20%"]
        assert mock_meeting.data["ai_summary"]["model"] is not None

    @pytest.mark.asyncio
    async def test_llm_failure_non_fatal(self, mock_meeting, mock_segments):
        """Groq API failure should return False without affecting meeting status."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_segments
        mock_db.execute = AsyncMock(return_value=mock_result)

        mock_httpx_response = MagicMock()
        mock_httpx_response.status_code = 500
        mock_httpx_response.text = "Internal Server Error"

        with patch("meeting_api.ai_summary.AI_SUMMARY_ENABLED", True), \
             patch("meeting_api.ai_summary.GROQ_API_KEY", "test-key"), \
             patch("meeting_api.ai_summary.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_httpx_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            result = await generate_ai_summary(mock_meeting, mock_db)

        assert result is False
        assert "ai_summary" not in mock_meeting.data

    @pytest.mark.asyncio
    async def test_groq_non_json_fallback(self, mock_meeting, mock_segments):
        """When Groq returns plain text instead of JSON, use it as summary."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_segments
        mock_db.execute = AsyncMock(return_value=mock_result)

        groq_response = {
            "choices": [{
                "message": {"content": "This meeting was about quarterly targets."}
            }]
        }

        mock_httpx_response = MagicMock()
        mock_httpx_response.status_code = 200
        mock_httpx_response.json.return_value = groq_response

        with patch("meeting_api.ai_summary.AI_SUMMARY_ENABLED", True), \
             patch("meeting_api.ai_summary.GROQ_API_KEY", "test-key"), \
             patch("meeting_api.ai_summary.flag_modified"), \
             patch("meeting_api.ai_summary.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_httpx_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            result = await generate_ai_summary(mock_meeting, mock_db)

        assert result is True
        assert mock_meeting.data["ai_summary"]["summary"] == "This meeting was about quarterly targets."

    @pytest.mark.asyncio
    async def test_short_transcript_skips(self, mock_meeting):
        """Very short transcript should be skipped."""
        mock_db = AsyncMock()
        mock_seg = MagicMock(spec=Transcription)
        mock_seg.speaker = "A"
        mock_seg.text = "hi"
        mock_seg.start_time = 0.0
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_seg]
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("meeting_api.ai_summary.AI_SUMMARY_ENABLED", True), \
             patch("meeting_api.ai_summary.GROQ_API_KEY", "test-key"):
            result = await generate_ai_summary(mock_meeting, mock_db)
        assert result is False
