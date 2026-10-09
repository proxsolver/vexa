"""Tests for _retry_failed_events retry accounting."""

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

os.environ.setdefault("DEFAULT_MAX_RETRIES", "3")
os.environ.setdefault("RETRY_BACKOFF_BASE_SECONDS", "30")

from app.sync import _retry_failed_events


def _make_event(event_id=1, retry_count=0, max_retries=3, last_retry_at=None, end_time=None):
    event = MagicMock()
    event.id = event_id
    event.title = f"Event {event_id}"
    event.status = "failed"
    event.retry_count = retry_count
    event.max_retries = max_retries
    event.last_retry_at = last_retry_at
    # Default to a meeting that has not ended yet, so end_time never blocks a retry.
    event.end_time = end_time if end_time is not None else datetime.now(timezone.utc) + timedelta(hours=1)
    return event


def _make_db(events):
    db = AsyncMock()
    result = MagicMock()
    scalars = MagicMock()
    scalars.all.return_value = events
    result.scalars.return_value = scalars
    db.execute.return_value = result
    db.commit = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_retries_a_failed_event():
    event = _make_event(retry_count=0)
    reset = await _retry_failed_events(_make_db([event]))

    assert reset == 1
    assert event.status == "pending"
    assert event.retry_count == 1
    assert event.meeting_id is None


@pytest.mark.asyncio
async def test_max_retries_zero_means_never_retry():
    """max_retries=0 opts an event out. `or DEFAULT_MAX_RETRIES` would revive it."""
    event = _make_event(retry_count=0, max_retries=0)
    reset = await _retry_failed_events(_make_db([event]))

    assert reset == 0
    assert event.status == "failed"
    assert event.retry_count == 0


@pytest.mark.asyncio
async def test_stops_once_retries_are_exhausted():
    event = _make_event(retry_count=3, max_retries=3)
    reset = await _retry_failed_events(_make_db([event]))

    assert reset == 0
    assert event.status == "failed"


@pytest.mark.asyncio
async def test_waits_out_the_backoff_window():
    """Second attempt waits 60s (30 * 2**1); a retry 5s ago is too recent."""
    event = _make_event(retry_count=1, last_retry_at=datetime.now(timezone.utc) - timedelta(seconds=5))
    reset = await _retry_failed_events(_make_db([event]))

    assert reset == 0
    assert event.status == "failed"


@pytest.mark.asyncio
async def test_retries_once_the_backoff_window_has_passed():
    event = _make_event(retry_count=1, last_retry_at=datetime.now(timezone.utc) - timedelta(seconds=120))
    reset = await _retry_failed_events(_make_db([event]))

    assert reset == 1
    assert event.status == "pending"
    assert event.retry_count == 2


@pytest.mark.asyncio
async def test_skips_events_whose_meeting_already_ended():
    event = _make_event(end_time=datetime.now(timezone.utc) - timedelta(minutes=5))
    reset = await _retry_failed_events(_make_db([event]))

    assert reset == 0
    assert event.status == "failed"


@pytest.mark.asyncio
async def test_one_exhausted_event_does_not_block_the_others():
    """The sweep has no per-event try/except, so a raise here would strand every
    later event. Keep a mixed batch in the suite to catch that."""
    exhausted = _make_event(event_id=1, retry_count=3, max_retries=3)
    opted_out = _make_event(event_id=2, max_retries=0)
    retryable = _make_event(event_id=3, retry_count=0)

    reset = await _retry_failed_events(_make_db([exhausted, opted_out, retryable]))

    assert reset == 1
    assert exhausted.status == "failed"
    assert opted_out.status == "failed"
    assert retryable.status == "pending"
