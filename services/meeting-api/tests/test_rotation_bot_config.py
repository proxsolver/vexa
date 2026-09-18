"""The rotated bot must inherit the meeting's configured timeouts.

`resolved_timeouts` is stored under the API's snake_case names. The bot
parses `automaticLeave` with a camelCase schema that drops unknown keys and
substitutes its own defaults, so handing the blob over verbatim silently
downgraded every rotated bot — most damagingly to a 2-minute everyone-left
timeout against a configured 15.
"""

import json

import pytest

from meeting_api.meetings import scheduler_rotation_spawn

from .conftest import make_meeting


BOT_SCHEMA_KEYS = {"waitingRoomTimeout", "noOneJoinedTimeout", "everyoneLeftTimeout"}


async def _spawn_and_capture(monkeypatch, resolved_timeouts):
    """Run the rotation endpoint far enough to capture the bot config it builds."""
    meeting = make_meeting(status="active")
    meeting.data = {
        "rotation": {"enabled": True, "interval_ms": 3600000, "rotation_count": 0},
        "meeting_url": "https://zoom.us/j/123",
        "passcode": "pw",
    }
    if resolved_timeouts is not None:
        meeting.data["resolved_timeouts"] = resolved_timeouts

    captured = {}

    async def fake_spawn(profile, config, user_id, callback_url, metadata):
        captured["env"] = config["env"]
        return None  # abort after capture — the spawn-failure path is harmless here

    class FakeResult:
        def scalars(self):
            return self

        def first(self):
            return meeting

    class FakeDB:
        async def get(self, model, pk):
            return meeting

        async def execute(self, stmt):
            # Serves lock_meeting_row's SELECT ... FOR UPDATE re-read.
            return FakeResult()

        async def commit(self):
            pass

        async def refresh(self, obj):
            pass

        def add(self, obj):
            pass

    monkeypatch.setattr("meeting_api.meetings._spawn_via_runtime_api", fake_spawn)
    monkeypatch.setattr(
        "meeting_api.meetings.mint_meeting_token", lambda *a, **k: "tok"
    )
    # flag_modified needs a real instrumented instance; the meeting is a Mock.
    monkeypatch.setattr(
        "meeting_api.meetings.attributes.flag_modified", lambda *a, **k: None
    )

    async def noop(*a, **k):
        return None

    monkeypatch.setattr("meeting_api.meetings._cancel_bot_timeout", noop)
    monkeypatch.setattr("meeting_api.meetings._schedule_bot_rotation", noop)

    class FakeBackgroundTasks:
        def add_task(self, *a, **k):
            pass

    await scheduler_rotation_spawn(meeting.id, FakeBackgroundTasks(), db=FakeDB())
    return json.loads(captured["env"]["BOT_CONFIG"])["automaticLeave"]


@pytest.mark.asyncio
async def test_rotated_bot_inherits_configured_timeouts(monkeypatch):
    automatic_leave = await _spawn_and_capture(
        monkeypatch,
        {
            "max_bot_time": 7200000,
            "max_wait_for_admission": 900000,
            "max_time_left_alone": 900000,
            "no_one_joined_timeout": 120000,
        },
    )

    assert automatic_leave == {
        "waitingRoomTimeout": 900000,
        "noOneJoinedTimeout": 120000,
        "everyoneLeftTimeout": 900000,
    }


@pytest.mark.asyncio
async def test_rotated_bot_honours_a_custom_alone_timeout(monkeypatch):
    # The value the bot would otherwise replace with its own 2-minute default.
    automatic_leave = await _spawn_and_capture(
        monkeypatch,
        {"max_time_left_alone": 1800000},
    )

    assert automatic_leave["everyoneLeftTimeout"] == 1800000


@pytest.mark.asyncio
async def test_rotated_bot_config_uses_only_bot_schema_keys(monkeypatch):
    # snake_case keys reaching the bot are dropped on its side, so a mismatch
    # here is invisible at runtime — assert the shape instead.
    automatic_leave = await _spawn_and_capture(
        monkeypatch,
        {
            "max_bot_time": 7200000,
            "max_wait_for_admission": 900000,
            "max_time_left_alone": 900000,
            "no_one_joined_timeout": 120000,
        },
    )

    assert set(automatic_leave) == BOT_SCHEMA_KEYS


@pytest.mark.asyncio
async def test_missing_resolved_timeouts_falls_back_to_system_defaults(monkeypatch):
    automatic_leave = await _spawn_and_capture(monkeypatch, None)

    assert automatic_leave == {
        "waitingRoomTimeout": 900000,
        "noOneJoinedTimeout": 120000,
        "everyoneLeftTimeout": 900000,
    }
