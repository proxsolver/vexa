# Triage log — 260904-zoom-alone-timeout

## Pass 1 — validate red @ 2026-09-04 22:33 (compose, single-host)

Scope proves[] verdict first: **4/4 scope checks PASS**
(ZOOM_ALONE_COUNT_FROM_BADGE, ZOOM_ALONE_AUDIO_CROSS_VALIDATE,
ZOOM_ALONE_TICK_UNIT, ZOOM_LEFT_ALONE_REASON_REPORTED).
Every failure below is outside this release's diff.

### Classification

| check(s) | class | evidence / disposition |
|---|---|---|
| 17× contract 401s (BOT_CREATE_OK, MEETINGS_LIST, TEAMS_URL_*, GMEET_URL_PARSED, INVALID_URL_REJECTED, WEBHOOK_SSRF_INPUT_REJECTED, BROWSER_SESSION_*, DB_POOL_NO_EXHAUSTION, SEGMENT_PIPELINE, BOT_STATUS_TRANSITIONS, BOTS_STATUS_NOT_422, TRANSCRIPTION_TOKEN_VALID) | **environment** | `bootstrap_creds` creates `test@vexa.ai` but this stack's admin-api gates accounts on approval (`/internal/validate` → "Account pending approval"); every minted token 401'd at the gateway. Proof: user-1 tokens (old AND same-day) → 200; user-2 token → 401 pre-approval, → 200 after `PATCH /admin/users/2/approval {"status":"approved"}`. **Harness gap: bootstrap_creds predates approval-gated admin-api** — future fix: bootstrap should approve its own test user. Fixed for this run by manual approval (2026-09-04). |
| TRANSCRIPTION_UP | **environment** | Check runs on the host but `.env TRANSCRIPTION_SERVICE_URL` is the docker-internal hostname (`transcription-service:8023`, port not published). Service verified healthy in-network: HTTP 200 from meeting-api container. Single-host harness limitation, not an outage. |
| CHART_VERSION_CURRENT | **pre-existing** | #228 chart-version drift; helm surface — this release touches no chart. |
| PLATFORM_RECORDING_TS_LINE_BUDGET | **pre-existing** | Red before this release's diff: msteams=1088>1000 and zoom/web=290>200 at branch HEAD~2. This release *improved* zoom/web to 236 (monitor split into alone-monitor.ts) but did not close the pre-existing overage; msteams untouched. Future cleanup item. |
| FINALIZER_BEFORE_STATUS_FLIP | **pre-existing** | count-mismatch fin=4 upd=3 in meeting-api; predates this release's diff (verified red at branch HEAD~2). Not in scope (bot-only release). |
| BOT_IMAGE_HAS_HALLUCINATION_PHRASES | **flaky check script** | Passes deterministically when run standalone (exit 0, "4 language phrase files present"). Failure signature is the EMPTY branch under parallel matrix load: `set -o pipefail` + `grep -q` early-exit → upstream grep SIGPIPE(141) → pipeline "fails" → file misread as empty. Check-script bug, not a corpus regression. Future fix: drop pipefail for that pipeline or use `awk`. |

### Next-fix decision

No code regression attributable to this release. Environment items fixed
in-place (test-user approval); pre-existing/flaky items filed above as
future work, out of this scope. → re-enter develop→deploy (no code change,
no image change) → re-run validate.

## Pass 2 — validate red @ 2026-09-04 22:40 (compose, single-host)

Environment fixes held: contract 17→3 fails, hallucination flake did not
recur (confirming the flaky-check classification).

### Classification

| check(s) | class | evidence / disposition |
|---|---|---|
| BOT_STATUS_TRANSITIONS | **REGRESSION (this release's deploy)** | Bot containers spawned from the new `lexa-box:latest` stick in Docker `Created` state, `exec: "/app/entrypoint.sh": no such file or directory`. Root cause is an **upstream repo inconsistency**: `services/runtime-api/profiles.yaml` (HEAD) commands `/app/entrypoint.sh` + `working_dir /app` (the pre-restructure layout), but `services/vexa-bot/Dockerfile` (HEAD) places the entrypoint at `/app/vexa-bot/entrypoint.sh`. The July lexa-box build predates the restructure, so the drift was invisible until this rebuild. Fix (develop pass 2): bot image provides both paths via symlink — self-contained in the approved scope surface (bot image only); does NOT touch the live runtime-api. Future work: align profiles.yaml + add a drift lock (needs its own plan approval). |
| BROWSER_SESSION_CDP | same root cause | browser-session profile also commands `/app/entrypoint.sh`; container never started → CDP proxy name-resolution 502. |
| TRANSCRIPTION_TOKEN_VALID | **environment** | HTTP 0 — check curls the docker-internal transcription URL from the host (same class as TRANSCRIPTION_UP). |
| TRANSCRIPTION_UP, CHART_VERSION_CURRENT, PLATFORM_RECORDING_TS_LINE_BUDGET, FINALIZER_BEFORE_STATUS_FLIP | unchanged | same classes as pass 1. |

Stuck `Created` test containers (meetings 45-51, test@vexa.ai) removed.

## Pass 3 — validate @ 2026-09-04 22:43 (compose, single-host) — scope-green

Entrypoint-compat rebuild (d23925c7) verified live:
**BOT_STATUS_TRANSITIONS PASS** (real bot spawned from new image, booted,
status callbacks flowed), **BROWSER_SESSION_CDP PASS**. Scope checks 4/4
PASS across all three passes.

Remaining fails — all previously classified, none regression:
TRANSCRIPTION_TOKEN_VALID + TRANSCRIPTION_UP (environment: docker-internal
URL from host), CHART_VERSION_CURRENT (#228 pre-existing),
PLATFORM_RECORDING_TS_LINE_BUDGET + FINALIZER_BEFORE_STATUS_FLIP
(pre-existing).

### Gate analysis — structural

`report-gate` = 0-10% confidence on 8 features because the aggregator
expects the FULL provisioned matrix (lite+compose+helm VMs, expensive
tiers). That infra was retired with the cloud VMs; this single host cannot
reach those thresholds for ANY release, independent of this diff. The
mechanical full-gate is therefore *structurally* red here — a harness/infra
gap, not a verdict on this release.

### Handoff to human (decision required)

Scope verdict: green (4/4 proves + live bot-spawn contract checks).
Deviation to accept (or reject): treat scope-green as gate-green for this
single-host cycle. Remaining human_verify (the REAL confirmation):
1. Real Zoom meeting, 2+ humans, cameras OFF, audio flowing → bot still
   present past 16 min; meeting stays `active`.
2. Everyone leaves, meeting stays open → bot leaves ~15 min later;
   `status_transition` records `left_alone_timeout` (not "stopped").

## Pass 4 — findings from the human_verify attempt, 2026-09-11 / 09-18

human_verify #1 was attempted against a real Zoom meeting (meeting 53,
2h39m, UNIST). It did not reach a verdict: the meeting outlived the
1-hour rotation, and the rotation path failed in four distinct ways that
end long meetings early. **Neither human_verify item is answered yet.**

### Process deviation — recorded, not excused

Every fix below was written, tested and deployed **during `triage`**, on
explicit operator instruction ("고쳐라" / "수정해", repeated). The stage
contract forbids code edits here; the correct path was
`triage → develop`. The commits are real and tested but sit outside the
INNER loop's accounting — the Registry has no DoD for any of them. The
operator should decide whether to (a) back-date them into a `develop`
pass, or (b) fold them into the next release's scope.

### Classification

| finding | class | evidence / disposition |
|---|---|---|
| Replacement bot's `joining` callback rejected while meeting ACTIVE → aborts after 3 retries | **pre-existing (latent)** | `active → joining` was never a legal transition, so *no rotation has ever succeeded*. Masked until a meeting ran past 1h. Fix `f6577f1f`; negative-tested against the prior image ("Failed to update meeting status"). |
| Replacement bot's **clean** exit (code 0) during a pending handoff ends the live meeting and finalizes its recording | **pre-existing (gap)** | The existing guard covered non-zero exits only. This is how meeting 53 died at 11:01 and how its master got cut. Fix `f6577f1f`. Note: the earlier "exit kills the meeting" wording in my own report was wrong for the non-zero case — corrected here. |
| Rotation phase 2 (retire outgoing bot) sits in a branch a rotation cannot reach | **pre-existing (latent)** | During a handoff the outgoing bot holds the meeting ACTIVE, so the replacement's ACTIVE callback always lands in the already-ACTIVE branch, which returned `container_updated` and skipped the leave command. Had only the first two been fixed, both bots would have stayed in the meeting recording in parallel. Fix `1f30f45b`. |
| Finalizer publishes a truncated master | **pre-existing (gap), data loss** | A master built mid-recording short-circuits every later finalize via `master already exists`. Meeting 53 recorded 2h39m and published **59.8 min**; the remaining 634 chunks sat unmerged in MinIO. Fix `1f30f45b` rebuilds when chunks post-date the master. Meeting 53 recovered to 158.7 min, first 10 min byte-identical. |
| Rotated bots ignore the meeting's timeouts | **pre-existing (gap) — reproduces this release's symptom** | The rotation path passed `resolved_timeouts` (snake_case) into `automaticLeave` (camelCase zod, unknown keys dropped, per-key defaults). Every rotated bot ran `everyoneLeftTimeout` **2 min against a configured 15** — i.e. the exact early-leave this release exists to fix, reintroduced after the 1h handoff. Fix `c32fb109`, 4 tests, all confirmed failing against the prior line. **This is the one finding a reviewer should weigh against scope.** |
| Dashboard session tokens minted before scope enforcement 403 on `/transcripts` | **pre-existing, unrelated** | Token id 2 (2026-05-30) carried `{bot}` only; `/api/auth/me` trusted the cookie without checking scopes, so the 30-day cookie failed silently and forever. Fix `d5b32ecd`. |
| `needs_human_help` bot appeared not to time out | **not a defect** | `getEscalationExtensionMs()` (escalation.ts:83) grants +5 min once escalated, so 15→20 min is by design. Recorded so nobody re-investigates — my initial report of this as a defect was wrong. |

### Blocker — human_verify cannot proceed without an operator action

Zoom refuses anonymous bots on this meeting ("Automated bots aren't
allowed to join this meeting — sign in to join"); the bot parks in
`needs_human_help` and times out at 20 min. Platform policy, not a
defect. The supported path is the authenticated join: a `browser_session`
saves a signed-in Chrome profile to MinIO and bots started with
`authenticated: true` sync it back down. That whole path worked already
**except** the dashboard toggle, which was hardcoded
`checked={false} disabled` behind a "Soon" badge — enabled in `0b0b2404`.
Round trip verified except the sign-in itself, which needs credentials
only the operator has.

### Verification status of the Pass-4 fixes

Synthetic only: `tests3/synthetic/scenarios/pack-rot-handoff.sh` (new,
`1cd7acf7`) drives a full handoff through the callback API and every
assertion was confirmed failing against the pre-fix image. meeting-api
suite 285 passed / 10 skipped. **No rotation has yet been observed
succeeding on a real meeting** — that needs a 1h+ meeting and is the
natural companion to human_verify #1.

Pre-existing synthetic failures left untouched: `pack-fm001` (calls
`rig_seed_transcription`, absent from rig.sh) and `pack-fuzz`
(`oversize-1MB` → HTTP 000).

### Handoff to human (decision required)

1. Accept or reject the process deviation above, and choose where these
   six commits land (`develop` back-fill vs next release's scope).
2. Decide whether the rotated-bot timeout finding changes this release's
   scope verdict — it reintroduces this release's own symptom on any
   meeting that passes 1h.
3. Sign in once via the Browser session so human_verify #1/#2 can finally
   run, ideally on a 1h+ meeting so the rotation handoff gets its first
   real-world proof.
