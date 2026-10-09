"""The bot only accepts a fixed set of status_change response statuses.

services/vexa-bot/core/src/services/unified-callback.ts treats any other
value as a rejection, retries three times, then throws — which kills the
bot and takes the meeting with it. Returning a descriptive new string from
a status_change branch is therefore a meeting-ending change, not a cosmetic
one: "acknowledged" did exactly that to meeting 83 on 2026-09-18, inside
the very branch added to stop rotation from killing meetings.

Extra detail belongs in a side field (the bot ignores unknown keys).
"""

import ast
import pathlib

import pytest

# Mirror of the bot's accept-list in unified-callback.ts.
BOT_ACCEPTED_STATUSES = {"processed", "ok", "container_updated", "ignored"}

CALLBACKS_PY = (
    pathlib.Path(__file__).resolve().parent.parent / "meeting_api" / "callbacks.py"
)


def _status_change_function() -> ast.AsyncFunctionDef:
    tree = ast.parse(CALLBACKS_PY.read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "bot_status_change_callback":
            return node
    raise AssertionError("bot_status_change_callback not found")


def _returned_status_literals(fn: ast.AsyncFunctionDef):
    """Every literal value returned under a "status" key, with its line."""
    found = []
    for node in ast.walk(fn):
        if not isinstance(node, ast.Return) or not isinstance(node.value, ast.Dict):
            continue
        for key, value in zip(node.value.keys, node.value.values):
            if (
                isinstance(key, ast.Constant)
                and key.value == "status"
                and isinstance(value, ast.Constant)
                and isinstance(value.value, str)
            ):
                found.append((value.value, node.lineno))
    return found


def test_status_change_only_returns_statuses_the_bot_accepts():
    statuses = _returned_status_literals(_status_change_function())

    assert statuses, "no literal status returns found — did the handler move?"

    offenders = [
        (s, line) for s, line in statuses
        # "error" is the deliberate rejection path for a genuinely invalid
        # transition; the bot is meant to retry and fail there.
        if s not in BOT_ACCEPTED_STATUSES and s != "error"
    ]

    assert not offenders, (
        "status_change returned statuses the bot rejects: "
        + ", ".join(f"{s!r} (callbacks.py:{line})" for s, line in offenders)
        + f". Use one of {sorted(BOT_ACCEPTED_STATUSES)} and put detail in a side field."
    )


@pytest.mark.parametrize("status", sorted(BOT_ACCEPTED_STATUSES))
def test_accept_list_matches_the_bot_source(status):
    """Guard against the bot's accept-list drifting away from this mirror."""
    bot_src = (
        CALLBACKS_PY.parent.parent.parent
        / "vexa-bot" / "core" / "src" / "services" / "unified-callback.ts"
    )
    if not bot_src.exists():
        pytest.skip("bot source not present in this checkout")
    assert f"'{status}'" in bot_src.read_text()
