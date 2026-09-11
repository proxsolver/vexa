#!/usr/bin/env bash
# Synthetic scenario — bot rotation handoff (meeting 53, 2026-09-11).
#
# A rotation replaces the bot mid-meeting: a second bot joins while the
# outgoing one keeps the meeting ACTIVE, then the outgoing one leaves.
# Three defects made that impossible, each reproduced below:
#
#   1. the replacement's `joining` callback was rejected as an invalid
#      active → joining transition, so it aborted after 3 retries
#   2. the replacement's exit marked the still-recording meeting FAILED
#   3. phase 2 (retire the outgoing bot) lived in a branch that a
#      rotation can never reach, so both bots stayed in the meeting
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../rig.sh"

PG=${PG_CONTAINER:-vexa-postgres-1}
REDIS=${REDIS_CONTAINER:-vexa-redis-1}
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-vexa}

echo
echo "=== Scenario: pack-rot-handoff ==="

_psql() { docker exec "$PG" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1"; }

# Put the meeting in the state the rotation endpoint leaves behind once it
# has spawned the replacement: handoff pending, outgoing bot identified.
_arm_handoff() {
    local meeting_id=$1 outgoing_session=$2
    _psql "UPDATE meetings SET data = jsonb_set(
             COALESCE(data, '{}'::jsonb), '{rotation}',
             '{\"enabled\": true, \"pending_handoff\": true,
               \"outgoing_container_id\": \"outgoing-ctr-$meeting_id\",
               \"outgoing_session_uid\": \"$outgoing_session\",
               \"overlap_ms\": 120000, \"consecutive_failures\": 0,
               \"rotation_count\": 0}'::jsonb)
           WHERE id = $meeting_id;" >/dev/null
}

_rotation_field() {
    _psql "SELECT COALESCE(data->'rotation'->>'$2', '') FROM meetings WHERE id = $1;"
}

# ─── Part 1: a healthy handoff ─────────────────────────────────────

read -r token meeting_id outgoing_uid native_id <<<"$(rig_setup_meeting pack-rot-ok)"
echo "    meeting_id=$meeting_id (outgoing session=${outgoing_uid:0:8})"

rig_drive_to_active "$outgoing_uid" "$native_id"
_arm_handoff "$meeting_id" "$outgoing_uid"

incoming_uid=$(rig_session_bootstrap "$meeting_id")
echo "    replacement session=${incoming_uid:0:8}"

# Defect 1 — the replacement announces itself while the meeting is ACTIVE.
resp=$(rig_callback "$incoming_uid" status_change status=joining container_id="incoming-ctr")
echo "$resp" | grep -q '"status": *"error"' && {
    echo "    ✗ replacement's joining callback rejected: $resp" >&2; exit 1; }
status=$(_psql "SELECT status FROM meetings WHERE id = $meeting_id;")
[ "$status" = "active" ] || { echo "    ✗ meeting downgraded to '$status' by a joining callback" >&2; exit 1; }
echo "    ✓ joining accepted while ACTIVE, meeting not downgraded"

# Defect 3 — reaching ACTIVE must retire the outgoing bot. Capture the
# leave command off the bot's command channel to prove it was sent.
leave_log=$(mktemp)
docker exec "$REDIS" timeout 8 redis-cli subscribe "bot_commands:meeting:$meeting_id" >"$leave_log" 2>&1 &
sub_pid=$!
sleep 1

resp=$(rig_callback "$incoming_uid" status_change status=active container_id="incoming-ctr")
wait "$sub_pid" 2>/dev/null || true

echo "$resp" | grep -q "rotation_handoff_scheduled" || {
    echo "    ✗ phase 2 did not run: $resp" >&2; exit 1; }
echo "    ✓ phase 2 ran on the already-ACTIVE path"

grep -q "bot_rotation" "$leave_log" || {
    echo "    ✗ no leave command on bot_commands:meeting:$meeting_id" >&2
    cat "$leave_log" >&2; exit 1; }
grep -q "$outgoing_uid" "$leave_log" || {
    echo "    ✗ leave command did not target the outgoing session" >&2
    cat "$leave_log" >&2; exit 1; }
echo "    ✓ leave command published, targeting the outgoing session"
rm -f "$leave_log"

# The outgoing bot now exits — the meeting belongs to the replacement.
rig_callback "$outgoing_uid" exited exit_code=0 reason=bot_rotation >/dev/null
sleep 1
status=$(_psql "SELECT status FROM meetings WHERE id = $meeting_id;")
[ "$status" = "active" ] || { echo "    ✗ outgoing bot's exit ended the meeting (status=$status)" >&2; exit 1; }
echo "    ✓ outgoing bot exited, meeting stays ACTIVE"

# ─── Part 2: the replacement dies before taking over ───────────────

read -r token2 meeting2 outgoing2 native2 <<<"$(rig_setup_meeting pack-rot-fail)"
echo "    meeting_id=$meeting2 (replacement will fail)"

rig_drive_to_active "$outgoing2" "$native2"
_arm_handoff "$meeting2" "$outgoing2"
incoming2=$(rig_session_bootstrap "$meeting2")

# Defect 2, via the status_change path (guarded before this change).
rig_callback "$incoming2" status_change status=failed \
    reason=join_rejected completion_reason=validation_error >/dev/null
sleep 1
status=$(_psql "SELECT status FROM meetings WHERE id = $meeting2;")
[ "$status" = "active" ] || { echo "    ✗ replacement's FAILED killed the meeting (status=$status)" >&2; exit 1; }
echo "    ✓ replacement reporting FAILED left the meeting ACTIVE"

# Defect 2, via the exit path — this is how meeting 53 actually died.
_arm_handoff "$meeting2" "$outgoing2"
incoming3=$(rig_session_bootstrap "$meeting2")
resp=$(rig_callback "$incoming3" exited exit_code=1 reason=join_failed)
sleep 1
status=$(_psql "SELECT status FROM meetings WHERE id = $meeting2;")
[ "$status" = "active" ] || { echo "    ✗ replacement's exit killed the meeting (status=$status)" >&2; exit 1; }
echo "$resp" | grep -q "rotation_incoming_failed" || {
    echo "    ✗ exit not recognised as a failed handoff: $resp" >&2; exit 1; }
echo "    ✓ replacement's exit left the meeting ACTIVE"

# Same path, clean exit code. The pre-existing guard only covered non-zero
# exits, so a replacement that quit tidily ended the meeting AND finalized
# its recording mid-stream — how meeting 53 shipped a 59m master for a
# 2h39m session.
_arm_handoff "$meeting2" "$outgoing2"
incoming4=$(rig_session_bootstrap "$meeting2")
rig_callback "$incoming4" exited exit_code=0 reason=self_initiated_leave completion_reason=stopped >/dev/null
sleep 1
status=$(_psql "SELECT status FROM meetings WHERE id = $meeting2;")
[ "$status" = "active" ] || { echo "    ✗ replacement's clean exit ended the meeting (status=$status)" >&2; exit 1; }
echo "    ✓ replacement's clean exit left the meeting ACTIVE"

pending=$(_rotation_field "$meeting2" pending_handoff)
failures=$(_rotation_field "$meeting2" consecutive_failures)
[ "$pending" = "false" ] || { echo "    ✗ handoff still pending after failure (got '$pending')" >&2; exit 1; }
[ "$failures" = "1" ] || { echo "    ✗ consecutive_failures=$failures, expected 1 (counter resets with each re-arm)" >&2; exit 1; }
echo "    ✓ handoff cleared, failure counted (consecutive_failures=$failures)"

# Clean up: retire both synthetic meetings.
rig_callback "$outgoing_uid" exited exit_code=0 reason=self_initiated_leave completion_reason=stopped >/dev/null 2>&1 || true
rig_callback "$outgoing2" exited exit_code=0 reason=self_initiated_leave completion_reason=stopped >/dev/null 2>&1 || true

echo "    ✅ rotation handoff verified"
