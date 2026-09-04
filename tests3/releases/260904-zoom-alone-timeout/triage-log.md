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
