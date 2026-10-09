# Release validation report — `unknown`

_Generated 2026-09-04T13:43:47.889026Z from `tests3/.state/reports/`._

## Deployment coverage

| Mode | Image tag | Tests run | Passed | Failed |
|------|-----------|-----------|--------|--------|
| `compose` | `—` | 6 | 2 | 4 |

## Feature confidence

| Feature | Confidence | Gate | Status |
|---------|-----------:|-----:|:-------|
| `auth-and-limits` | **100%** | 95% | ✅ pass |
| `authenticated-meetings` | **0%** | 0% | ✅ pass |
| `bot-lifecycle` | **0%** | 90% | ❌ below gate |
| `browser-session` | **0%** | 0% | ✅ pass |
| `container-lifecycle` | **0%** | 0% | ✅ pass |
| `dashboard` | **0%** | 90% | ❌ below gate |
| `infrastructure` | **0%** | 100% | ❌ below gate |
| `meeting-chat` | **0%** | 0% | ✅ pass |
| `meeting-urls` | **0%** | 100% | ❌ below gate |
| `post-meeting-transcription` | **0%** | 60% | ❌ below gate |
| `realtime-transcription` | **0%** | 0% | ✅ pass |
| `realtime-transcription/gmeet` | **0%** | 0% | ✅ pass |
| `realtime-transcription/msteams` | **0%** | 0% | ✅ pass |
| `realtime-transcription/zoom` | **0%** | 0% | ✅ pass |
| `remote-browser` | **0%** | 95% | ❌ below gate |
| `security-hygiene` | **10%** | 95% | ❌ below gate |
| `speaking-bot` | **0%** | 0% | ✅ pass |
| `webhooks` | **9%** | 95% | ❌ below gate |

## DoD details

### `auth-and-limits` (100% / gate 95%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|
| internal-transcripts-require-auth | meeting-api /internal/transcripts/{id} rejects unauthenticated callers (CVE-2026-25058 / GHSA-w73r-2449-qwgh) | 10 | ✅ pass | compose: smoke-contract/INTERNAL_TRANSCRIPT_REQUIRES_AUTH: HTTP 403 (auth required) |

### `authenticated-meetings` (0% / gate 0%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|

### `bot-lifecycle` (0% / gate 90%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|
| create-ok | POST /bots spawns a bot container and returns a bot id | 15 | ⬜ missing | helm: no report for test=containers |
| create-alive | Bot process is running 10s after creation (not crash-looping) | 15 | ⬜ missing | helm: no report for test=containers |
| bots-status-not-422 | GET /bots/status never returns 422 (schema stable under concurrent writes) | 5 | ⬜ missing | lite: check BOTS_STATUS_NOT_422 not found in any report; compose: smoke-contract/BOTS_STATUS_NOT_422: GET /bots/status returns 200 — no route collision with /bots/{meeting_id}; helm: check BOTS_STA… |
| removal | Container fully removed after DELETE /bots/... | 10 | ⬜ missing | helm: no report for test=containers |
| status-completed | Meeting.status=completed after stop (not failed/stuck) | 10 | ⬜ missing | helm: no report for test=containers |
| graceful-leave | Bot leaves the meeting gracefully on stop (no force-kill by default) | 5 | ⬜ missing | lite: check GRACEFUL_LEAVE not found in any report; compose: smoke-static/GRACEFUL_LEAVE: self_initiated_leave during stopping treated as completed, not failed; helm: check GRACEFUL_LEAVE not found… |
| route-collision | No Starlette route collisions — /bots/{id} and /bots/{platform}/{native_id} do not clash | 5 | ⬜ missing | lite: check ROUTE_COLLISION not found in any report; compose: smoke-static/ROUTE_COLLISION: bot detail route is /bots/id/{id}, not /bots/{id} which collides with /bots/status; helm: check ROUTE_COL… |
| timeout-stop | Bot auto-stops after automatic_leave timeout (no_one_joined_timeout) | 10 | ⬜ missing | helm: no report for test=containers |
| concurrency-slot | Concurrent-bot slot released immediately on stop — next create succeeds | 10 | ⬜ missing | helm: no report for test=containers |
| no-orphans | No zombie/exited bot containers left after a lifecycle run | 10 | ⬜ missing | helm: no report for test=containers |
| status-webhooks-fire | Status-change webhooks fire for every transition when enabled in webhook_events | 5 | ⬜ missing | helm: no report for test=webhooks |
| recording-incremental-chunk-upload | bot uploads each MediaRecorder chunk as it arrives; meeting-api accepts chunk_seq on /internal/recordings/upload | 15 | ⬜ missing | lite: check RECORDING_UPLOAD_SUPPORTS_CHUNK_SEQ not found in any report; compose: smoke-static/RECORDING_UPLOAD_SUPPORTS_CHUNK_SEQ: /internal/recordings/upload accepts chunk_seq: int form parameter |
| bot-records-incrementally | bot recording.ts calls MediaRecorder.start with ≥15s timeslice AND uploads each chunk via __vexaSaveRecordingChunk | 10 | ⬜ missing | lite: check BOT_RECORDS_INCREMENTALLY not found in any report; compose: check BOT_RECORDS_INCREMENTALLY not found in any report |
| recording-survives-mid-meeting-kill | SIGKILL mid-recording leaves already-uploaded chunks durable in MinIO; Recording.status stays IN_PROGRESS until is_final=true | 10 | ⬜ missing | compose: check RECORDING_SURVIVES_MID_MEETING_KILL not found in any report |
| runtime-api-stop-grace-matches-pod-spec | runtime-api delete_namespaced_pod grace_period_seconds matches the pod spec terminationGracePeriodSeconds | 5 | ⬜ missing | helm: check RUNTIME_API_STOP_GRACE_MATCHES_POD_SPEC not found in any report |
| runtime-api-exit-callback-durable | runtime-api exit callback delivery is durable across consumer outages (idle_loop re-sweeps pending records) | 10 | ⬜ missing | compose: check RUNTIME_API_EXIT_CALLBACK_DURABLE not found in any report |
| runtime-api-idle-loop-sweeps-pending-callbacks | services/runtime-api lifecycle.py idle_loop iterates pending callbacks each tick and retries delivery | 5 | ⬜ missing | lite: check RUNTIME_API_IDLE_LOOP_SWEEPS_PENDING_CALLBACKS not found in any report; compose: smoke-static/RUNTIME_API_IDLE_LOOP_SWEEPS_PENDING_CALLBACKS: runtime-api idle_loop references list_pendi… |
| bot-video-default-off | POST /bots `video` field defaults to False — video recording is opt-in, not opt-out | 5 | ⬜ missing | lite: check BOT_VIDEO_DEFAULT_OFF not found in any report; compose: smoke-static/BOT_VIDEO_DEFAULT_OFF: POST /bots `video` field defaults to False — video recording is opt-in; audio-only is the def… |
| hallucination-corpus-present | bot hallucination corpus (en, es, pt, ru) exists at services/vexa-bot/core/src/services/hallucinations/ — non-empty, ≥5 phrases each | 5 | ⬜ missing | lite: check HALLUCINATION_CORPUS_PRESENT not found in any report; compose: v0.10.5.3-hallucination-corpus/HALLUCINATION_CORPUS_PRESENT: 4 langs × non-empty corpus = 167 phrases; helm: check HALLUCI… |
| hallucination-corpus-gitignore-exception | .gitignore has the negation rule '!services/vexa-bot/core/src/services/hallucinations/*.txt' protecting the corpus from the global '*.txt' ignore | 5 | ⬜ missing | lite: check HALLUCINATION_CORPUS_GITIGNORE_EXCEPTION not found in any report; compose: v0.10.5.3-hallucination-corpus/HALLUCINATION_CORPUS_GITIGNORE_EXCEPTION: .gitignore exception protects corpus … |
| hallucination-corpus-build-fail-loud | core/package.json build script uses '&&' (fail-fast) for the cp step, not '2>/dev/null;' (silent-fail) — corpus copy failure aborts build | 5 | ⬜ missing | lite: check HALLUCINATION_CORPUS_BUILD_FAIL_LOUD not found in any report; compose: v0.10.5.3-hallucination-corpus/HALLUCINATION_CORPUS_BUILD_FAIL_LOUD: build script uses '&&' chain — cp failure abo… |
| shared-audio-pipeline-module-exists | services/vexa-bot/core/src/services/audio-pipeline.ts exports UnifiedRecordingPipeline + MediaRecorderCapture + PulseAudioCapture — single bot-side capture module driving all 3 platforms | 5 | ⬜ missing | lite: check SHARED_AUDIO_PIPELINE_MODULE_EXISTS not found in any report; compose: v0.10.6-static-greps/SHARED_AUDIO_PIPELINE_MODULE_EXISTS: audio-pipeline.ts exports UnifiedRecordingPipeline + capt… |
| gmeet-recording-uses-shared-pipeline | googlemeet/recording.ts imports UnifiedRecordingPipeline + MediaRecorderCapture from services/audio-pipeline (Pack U.2 — no longer hand-rolls MediaRecorder boilerplate) | 10 | ⬜ missing | lite: check GMEET_RECORDING_USES_SHARED_PIPELINE not found in any report; compose: v0.10.6-static-greps/GMEET_RECORDING_USES_SHARED_PIPELINE: imports from services/audio-pipeline; helm: check GMEET… |
| teams-recording-uses-shared-pipeline | msteams/recording.ts imports UnifiedRecordingPipeline + MediaRecorderCapture from services/audio-pipeline (Pack U.3) | 10 | ⬜ missing | lite: check TEAMS_RECORDING_USES_SHARED_PIPELINE not found in any report; compose: v0.10.6-static-greps/TEAMS_RECORDING_USES_SHARED_PIPELINE: imports from services/audio-pipeline; helm: check TEAMS… |
| zoom-web-recording-uses-shared-pipeline | zoom/web/recording.ts imports UnifiedRecordingPipeline + PulseAudioCapture; chunked-upload model (Pack U.4 — pre-Pack-U: total audio loss on bot crash) | 10 | ⬜ missing | lite: check ZOOM_WEB_RECORDING_USES_SHARED_PIPELINE not found in any report; compose: v0.10.6-static-greps/ZOOM_WEB_RECORDING_USES_SHARED_PIPELINE: imports from services/audio-pipeline; helm: check… |
| zoom-web-uploads-chunks-periodically | PulseAudioCapture in audio-pipeline.ts emits 15s WAV chunks during a Zoom meeting (uploadChunk fires multiple times before finalize) | 10 | ⬜ missing | lite: check ZOOM_WEB_UPLOADS_CHUNKS_PERIODICALLY not found in any report; compose: v0.10.6-static-greps/ZOOM_WEB_UPLOADS_CHUNKS_PERIODICALLY: PulseAudioCapture class present in audio-pipeline.ts; h… |
| platform-recording-ts-line-budget | after Pack U unification, every platform recording.ts is within LOC budget (gmeet ≤ 800, msteams ≤ 1000, zoom/web ≤ 200) — captures the duplication-removal as a static guard | 5 | ⬜ missing | lite: check PLATFORM_RECORDING_TS_LINE_BUDGET not found in any report |
| no-per-platform-master-construction | no platform recording.ts retains __vexaSaveRecordingBlob or __vexaRecordedChunks master-blob assembly — master is exclusively server-side | 10 | ⬜ missing | lite: check NO_PER_PLATFORM_MASTER_CONSTRUCTION not found in any report |
| bot-kill-recording-playable-gmeet | after SIGKILL'ing a GMeet bot mid-recording, server-side finalize_recording_master builds master.webm from chunks already in MinIO → ffprobe-playable. Crash-safety the bot couldn't provide pre-Pack-U. (weight 3: requires fixture meeting URL — operator-driven via scope.yaml human_verify; 0% gate-pull when fixtures absent) | 3 | ⬜ missing | compose: check BOT_KILL_RECORDING_PLAYABLE_GMEET not found in any report; helm: check BOT_KILL_RECORDING_PLAYABLE_GMEET not found in any report |
| bot-kill-recording-playable-teams | Teams equivalent — SIGKILL bot, master built post-callback, ffprobe-playable. (weight 3: fixture-dependent) | 3 | ⬜ missing | compose: check BOT_KILL_RECORDING_PLAYABLE_TEAMS not found in any report; helm: check BOT_KILL_RECORDING_PLAYABLE_TEAMS not found in any report |
| bot-kill-recording-playable-zoom | Zoom Web equivalent — SIGKILL bot, master.wav built from chunked PulseAudio uploads, ffprobe-playable. Pre-Pack-U Zoom crash = total audio loss; this DoD certifies the recovery. (weight 3: fixture-dependent) | 3 | ⬜ missing | compose: check BOT_KILL_RECORDING_PLAYABLE_ZOOM not found in any report |
| unified-alignment-hook-in-pipeline | segment-to-audio alignment hook (publisher.resetSessionStart) lives in UnifiedRecordingPipeline ONLY — per-platform recording.ts files have no exposeFunction('__vexaRecordingStarted') handler and no premature publisher.resetSessionStart() call. Same hook for all 3 platforms via source.on('started'). | 10 | ⬜ missing | lite: check UNIFIED_ALIGNMENT_HOOK_IN_PIPELINE not found in any report; compose: v0.10.6-static-greps/UNIFIED_ALIGNMENT_HOOK_IN_PIPELINE: alignment hook lives only in UnifiedRecordingPipeline; no p… |
| browser-utils-injected-before-pipeline-start | every platform recording.ts that uses MediaRecorderCapture calls ensureBrowserUtils() BEFORE pipeline.start() — Pack U.2/U.3 regression guard. Wrong ordering produced 0 chunks every meeting (post-Pack-U gate green, real-meeting tests on helm/lite all failed STOPPED_WITH_NO_AUDIO until 2026-05-02 when ordering was fixed). | 15 | ⬜ missing | lite: check BROWSER_UTILS_INJECTED_BEFORE_PIPELINE_START not found in any report; compose: v0.10.6-static-greps/BROWSER_UTILS_INJECTED_BEFORE_PIPELINE_START: ensureBrowserUtils precedes pipeline.st… |

### `browser-session` (0% / gate 0%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|

### `container-lifecycle` (0% / gate 0%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|

### `dashboard` (0% / gate 90%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|
| login-flow | POST /api/auth/send-magic-link → 200 + success=true + sets vexa-token cookie | 10 | ⬜ missing | lite: no report for test=dashboard-auth; compose: no report for test=dashboard-auth; helm: no report for test=dashboard-auth |
| cookie-flags | vexa-token cookie Secure flag matches deployment (Secure iff https) | 10 | ⬜ missing | lite: no report for test=dashboard-auth; compose: no report for test=dashboard-auth; helm: no report for test=dashboard-auth |
| identity-me | GET /api/auth/me returns logged-in user's email (never falls back to env) | 10 | ⬜ missing | lite: no report for test=dashboard-auth; compose: no report for test=dashboard-auth; helm: no report for test=dashboard-auth |
| cookie-security | HttpOnly + SameSite cookies on magic-link send/verify + admin-verify + nextauth | 10 | ⬜ missing | lite: check SECURE_COOKIE_SEND_MAGIC_LINK not found in any report; compose: smoke-static/SECURE_COOKIE_SEND_MAGIC_LINK: cookie Secure flag based on actual protocol, not NODE_ENV (send-magic-link); … |
| login-redirect | Magic-link click redirects to /meetings (not disabled /agent) | 5 | ⬜ missing | lite: check LOGIN_REDIRECT not found in any report; compose: smoke-static/LOGIN_REDIRECT: login redirects to / (then /meetings), not to disabled /agent page; helm: check LOGIN_REDIRECT not found in… |
| identity-no-fallback | /api/auth/me uses only the cookie for identity, never env fallback | 5 | ⬜ missing | lite: check IDENTITY_NO_FALLBACK not found in any report; compose: smoke-static/IDENTITY_NO_FALLBACK: /api/auth/me uses only cookie for identity, never falls back to env var; helm: check IDENTITY_N… |
| proxy-reachable | GET /api/vexa/meetings via cookie returns 200 | 10 | ⬜ missing | lite: no report for test=dashboard-auth; compose: no report for test=dashboard-auth; helm: no report for test=dashboard-auth |
| meetings-list | /api/vexa/meetings returns a meeting list through the dashboard proxy | 5 | ⬜ missing | compose: no report for test=dashboard-proxy; helm: no report for test=dashboard-proxy |
| pagination | limit/offset pagination works (no overlap between pages) | 5 | ⬜ missing | compose: no report for test=dashboard-proxy; helm: no report for test=dashboard-proxy |
| field-contract | Meeting records include native_meeting_id / platform_specific_id | 5 | ⬜ missing | compose: no report for test=dashboard-proxy; helm: no report for test=dashboard-proxy |
| transcript-proxy | Transcript reachable through dashboard proxy | 5 | ⬜ missing | compose: no report for test=dashboard-proxy; helm: no report for test=dashboard-proxy |
| bot-create-proxy | POST /api/vexa/bots reaches the gateway and creates a bot (or returns 403/409) | 5 | ⬜ missing | compose: no report for test=dashboard-proxy; helm: no report for test=dashboard-proxy |
| dashboard-up | Dashboard root page responds | 5 | ⬜ missing | lite: check DASHBOARD_UP not found in any report; compose: smoke-health/DASHBOARD_UP: dashboard serves pages — user can access the UI; helm: check DASHBOARD_UP not found in any report |
| dashboard-ws-url | NEXT_PUBLIC_WS_URL is set — live updates can connect | 5 | ⬜ missing | lite: check DASHBOARD_WS_URL not found in any report; compose: smoke-health/DASHBOARD_WS_URL: ws://localhost:3001/ws; helm: check DASHBOARD_WS_URL not found in any report |
| dashboard-admin-key-valid | Dashboard's VEXA_ADMIN_API_KEY is accepted by admin-api (login path works) | 5 | ⬜ missing | lite: check DASHBOARD_ADMIN_KEY_VALID not found in any report; compose: smoke-env/DASHBOARD_ADMIN_KEY_VALID: dashboard can authenticate to admin-api — user lookup and login will work; helm: check D… |
| packages-transcript-rendering-tests-pass | packages/transcript-rendering npm test passes — guards the dedup-prefers-confirmed fix + existing 76 tests | 5 | ⬜ missing | lite: check TRANSCRIPT_RENDERING_DEDUP_TESTS_PASS not found in any report |
| packages-ci-workflow-exists | .github/workflows/test-packages.yml exists and runs npm test per package in matrix | 5 | ⬜ missing | lite: check PACKAGES_CI_WORKFLOW_EXISTS not found in any report |
| download-returns-presigned-url-to-master | GET /recordings/{id}/media/{file}/download returns JSON with .url path ending at /audio/master.{webm\|wav} — browser-reachable via MINIO_PUBLIC_ENDPOINT (Pack D-3 Option B kept). (weight 3: runtime-fixture-dependent; static-grep DASHBOARD_AUDIO_STREAMS_FROM_BUCKET carries the structural proof at full weight) | 3 | ⬜ missing | lite: check DOWNLOAD_RETURNS_PRESIGNED_URL_TO_MASTER not found in any report; compose: check DOWNLOAD_RETURNS_PRESIGNED_URL_TO_MASTER not found in any report; helm: check DOWNLOAD_RETURNS_PRESIGNED… |
| dashboard-audio-streams-from-bucket | dashboard reads /recordings/.../download (NOT /raw); <audio src> binds to the presigned URL; native HTTP Range fires on user seek | 10 | ⬜ missing | lite: check DASHBOARD_AUDIO_STREAMS_FROM_BUCKET not found in any report; compose: v0.10.6-static-greps/DASHBOARD_AUDIO_STREAMS_FROM_BUCKET: dashboard reads /download → presigned URL; helm: check DA… |
| dashboard-meetings-pagination-tracks-unfiltered-offset | dashboard meetings-store.ts paginates by explicit _offset cursor + dedupes by meeting.id (closes GH #304 — duplicate rows when redacted shells filtered out) | 10 | ⬜ missing | lite: check DASHBOARD_MEETINGS_PAGINATION_TRACKS_UNFILTERED_OFFSET not found in any report; compose: v0.10.6-static-greps/DASHBOARD_MEETINGS_PAGINATION_TRACKS_UNFILTERED_OFFSET: meetings-store.ts u… |

### `infrastructure` (0% / gate 100%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|
| gateway-up | API gateway responds to /admin/users via valid admin token | 10 | ⬜ missing | lite: check GATEWAY_UP not found in any report; compose: smoke-health/GATEWAY_UP: API gateway accepts connections — all client requests can reach backend; helm: check GATEWAY_UP not found in any re… |
| admin-api-up | admin-api responds with a valid list | 10 | ⬜ missing | lite: check ADMIN_API_UP not found in any report; compose: smoke-health/ADMIN_API_UP: admin-api responds with valid token — user management and login work; helm: check ADMIN_API_UP not found in any… |
| dashboard-up | dashboard root page responds | 10 | ⬜ missing | lite: check DASHBOARD_UP not found in any report; compose: smoke-health/DASHBOARD_UP: dashboard serves pages — user can access the UI; helm: check DASHBOARD_UP not found in any report |
| runtime-api-up | runtime-api (bot orchestrator) is reachable / has ready replicas | 15 | ⬜ missing | lite: check RUNTIME_API_UP not found in any report; compose: smoke-health/RUNTIME_API_UP: runtime-api responds — bot container lifecycle management works; helm: check RUNTIME_API_UP not found in an… |
| transcription-up | transcription service /health returns ok + gpu_available | 15 | ❌ fail | lite: check TRANSCRIPTION_UP not found in any report; compose: smoke-health/TRANSCRIPTION_UP: HTTP 0 from http://transcription-service:8023/health; helm: check TRANSCRIPTION_UP not found in any report |
| redis-up | Redis responds to PING | 10 | ⬜ missing | lite: check REDIS_UP not found in any report; compose: smoke-health/REDIS_UP: Redis responds to PING — WebSocket pub/sub, session state, and caching work; helm: check REDIS_UP not found in any report |
| minio-up | MinIO is healthy / has ready replicas | 10 | ⬜ missing | compose: smoke-health/MINIO_UP: MinIO responds — recordings and browser state storage work; helm: check MINIO_UP not found in any report |
| db-schema | Database schema is aligned with the current model | 10 | ⬜ missing | lite: check DB_SCHEMA_ALIGNED not found in any report; compose: smoke-health/DB_SCHEMA_ALIGNED: all required columns present; helm: check DB_SCHEMA_ALIGNED not found in any report |
| gateway-timeout | Gateway proxy timeout is ≥30s (prevents premature 504s under load) | 10 | ⬜ missing | lite: check GATEWAY_TIMEOUT_ADEQUATE not found in any report; compose: smoke-static/GATEWAY_TIMEOUT_ADEQUATE: API gateway HTTP client timeout >= 15s — browser session creation needs time; helm: che… |
| chart-resources-tuned | every enabled service in values.yaml declares resources.requests + resources.limits for both cpu and memory | 10 | ⬜ missing | helm: check HELM_VALUES_RESOURCES_SET not found in any report |
| chart-security-hardened | global.securityContext sets allowPrivilegeEscalation: false and drops ALL capabilities | 10 | ⬜ missing | helm: check HELM_GLOBAL_SECURITY_HARDENED not found in any report |
| chart-redis-tuned | redis deployment args include --maxmemory and an eviction policy | 10 | ⬜ missing | helm: check HELM_REDIS_MAXMEMORY_SET not found in any report |
| chart-db-pool-tuned | every pool-holder service (admin-api, meeting-api, runtime-api) sets DB_POOL_SIZE — no silent framework defaults | 10 | ⬜ missing | helm: check HELM_ALL_SERVICES_DB_POOL_TUNED not found in any report |
| chart-pdb-available | PodDisruptionBudget template exists in chart (off by default via values toggle; on when podDisruptionBudgets.<svc>.enabled=true) | 10 | ⬜ missing | helm: check HELM_PDB_TEMPLATE_EXISTS not found in any report |
| chart-deployment-strategy-helper | _helpers.tpl defines vexa.deploymentStrategy — centralized rolling-update contract | 5 | ⬜ missing | helm: check HELM_DEPLOYMENT_STRATEGY_HELPER_DEFINED not found in any report |
| chart-rolling-update-zero-downtime | every app-facing Deployment in rendered chart has strategy.rollingUpdate.maxUnavailable: 0 — OLD pod stays Ready until NEW pod is Ready (zero-downtime, prevents v0.10.5.2 outage class) | 10 | ⬜ missing | helm: check HELM_ROLLING_UPDATE_ZERO_DOWNTIME not found in any report |
| chart-api-gateway-ha-replica-count | apiGateway.replicaCount default ≥ 2 — so maxUnavailable: 0 rollouts have surge headroom for the front door | 5 | ⬜ missing | helm: check HELM_API_GATEWAY_REPLICA_COUNT_HA not found in any report |
| chart-pgbouncer-optional-and-wired | chart supports optional PgBouncer (pgbouncer.enabled: false default); enabled=true rewires every service's DB_HOST to pgbouncer via vexa.dbHostEffective | 10 | ⬜ missing | helm: check HELM_PGBOUNCER_OPTIONAL_AND_WIRED not found in any report |
| helm-lke-setup-exposes-minio-nodeport | Pack D-3 helm wiring — tests3/lib/lke-setup-helm.sh sets minio.service.type=NodePort + nodePort + meetingApi.minioPublicEndpoint=http://<node>:<port> so dashboard browsers reach presigned URLs. Without it, audio playback hangs at 'Preparing audio' on every helm-deployed cluster. | 5 | ⬜ missing | helm: check HELM_LKE_SETUP_EXPOSES_MINIO_NODEPORT not found in any report |

### `meeting-chat` (0% / gate 0%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|

### `meeting-urls` (0% / gate 100%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|
| url-parser-exists | meeting-api has a URL parser module (url_parser.py) that handles platform detection | 10 | ⬜ missing | lite: check URL_PARSER_EXISTS not found in any report; compose: smoke-static/URL_PARSER_EXISTS: MeetingCreate schema has parse_meeting_url — accepts meeting_url field directly; helm: check URL_PARS… |
| gmeet-parsed | Google Meet URL (meet.google.com/xxx-xxxx-xxx) parses correctly | 15 | ⬜ missing | lite: check GMEET_URL_PARSED not found in any report; compose: smoke-contract/GMEET_URL_PARSED: Google Meet URL accepted by POST /bots — parser handles GMeet format; helm: check GMEET_URL_PARSED no… |
| invalid-rejected | Invalid meeting URL returns 400 (not 500) | 10 | ⬜ missing | lite: check INVALID_URL_REJECTED not found in any report; compose: smoke-contract/INVALID_URL_REJECTED: garbage URLs rejected with 400/422 — input validation works; helm: check INVALID_URL_REJECTED… |
| teams-standard | Teams standard link (teams.microsoft.com/l/meetup-join/...) parses | 15 | ⬜ missing | lite: check TEAMS_URL_STANDARD not found in any report; compose: smoke-contract/TEAMS_URL_STANDARD: Teams standard join URL accepted by POST /bots; helm: check TEAMS_URL_STANDARD not found in any r… |
| teams-shortlink | Teams shortlink (teams.live.com, teams.microsoft.com/meet) parses | 10 | ⬜ missing | lite: check TEAMS_URL_SHORTLINK not found in any report; compose: smoke-contract/TEAMS_URL_SHORTLINK: Teams /meet/ shortlink URL parsed and accepted by POST /bots (no explicit platform needed); hel… |
| teams-channel | Teams channel meeting URL parses | 10 | ⬜ missing | lite: check TEAMS_URL_CHANNEL not found in any report; compose: smoke-contract/TEAMS_URL_CHANNEL: Teams channel meeting URL accepted or known gap; helm: check TEAMS_URL_CHANNEL not found in any report |
| teams-enterprise | Teams enterprise-tenant URL parses (custom domain) | 15 | ⬜ missing | lite: check TEAMS_URL_ENTERPRISE not found in any report; compose: smoke-contract/TEAMS_URL_ENTERPRISE: Teams enterprise domain URL parsed and accepted by POST /bots (no explicit platform needed); … |
| teams-personal | Teams personal-account URL parses | 15 | ⬜ missing | lite: check TEAMS_URL_PERSONAL not found in any report; compose: smoke-contract/TEAMS_URL_PERSONAL: Teams personal (teams.live.com) URL parsed and accepted by POST /bots (no explicit platform neede… |

### `post-meeting-transcription` (0% / gate 60%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|
| server-side-master-finalizer-exists | services/meeting-api/meeting_api/recording_finalizer.py defines async finalize_recording_master(meeting_id, db) — single server-side function that builds master.{webm\|wav} from chunks in MinIO | 15 | ⬜ missing | lite: check SERVER_SIDE_MASTER_FINALIZER_EXISTS not found in any report; compose: v0.10.6-static-greps/SERVER_SIDE_MASTER_FINALIZER_EXISTS: recording_finalizer.py exports finalize_recording_master;… |
| finalizer-handles-meeting-data-mode | recording_finalizer.py has the meeting_data JSONB path (Pack U.5 followup, commit 5af580e). Pre-fix only handled SQL Recording table → silent no-op on every real meeting in production-default config. Caught when helm shipped with a stale image and 6 meetings landed status=completed but storage_path stuck at last chunk. | 15 | ⬜ missing | lite: check FINALIZER_HANDLES_MEETING_DATA_MODE not found in any report; compose: v0.10.6-static-greps/FINALIZER_HANDLES_MEETING_DATA_MODE: recording_finalizer.py has the meeting_data JSONB mode pa… |
| bot-exit-callback-invokes-finalizer | callbacks.py:bot_exit_callback awaits finalize_recording_master in all 3 exit branches (graceful, was-stopping, else/crash) BEFORE the corresponding update_meeting_status — closes the race where /transcribe could read stale storage_path | 15 | ⬜ missing | lite: check BOT_EXIT_CALLBACK_INVOKES_FINALIZER not found in any report |
| finalizer-before-status-flip | in bot_exit_callback every `await finalize_recording_master` line precedes the corresponding `await update_meeting_status` line — race-window check | 10 | ⬜ missing | lite: check FINALIZER_BEFORE_STATUS_FLIP not found in any report |
| finalizer-is-idempotent | second invocation of finalize_recording_master for the same recording is a no-op (HEAD-checks for existing master) — safe under idle_loop callback retry. (weight 3: fixture-dependent runtime smoke) | 3 | ⬜ missing | compose: check FINALIZER_IS_IDEMPOTENT not found in any report |
| master-at-storage-path | after a normal-completion meeting, media_file.storage_path points at /audio/master.{webm\|wav} (NOT at /audio/000000.{ext} which would mean the finalizer never ran). (weight 3: fixture-dependent runtime smoke; static-grep covers the structural shape — server-side-master-finalizer-exists + bot-exit-callback-invokes-finalizer) | 3 | ⬜ missing | compose: check MASTER_AT_STORAGE_PATH not found in any report; helm: check MASTER_AT_STORAGE_PATH not found in any report |
| deferred-transcribe-uses-master | POST /meetings/{id}/transcribe on a SIGKILL'd bot's recording succeeds with segments — proves deferred transcription works on crashed-bot recordings (didn't pre-Pack-U). (weight 3: fixture-dependent) | 3 | ⬜ missing | compose: check DEFERRED_TRANSCRIBE_USES_MASTER not found in any report; helm: check DEFERRED_TRANSCRIBE_USES_MASTER not found in any report |
| chunk-write-preserves-master-path | Pack U.7 — recordings.py chunk-write handler refuses to overwrite storage_path back to chunk path when prior media_file is at master OR is_final=True. Caught 2026-05-03 on helm: late-arriving chunk POST after bot graceful exit raced Pack U.5's master commit, dashboard audio stuck at 'Preparing audio'. | 10 | ⬜ missing | lite: check CHUNK_WRITE_PRESERVES_MASTER_PATH not found in any report; compose: check CHUNK_WRITE_PRESERVES_MASTER_PATH not found in any report; helm: check CHUNK_WRITE_PRESERVES_MASTER_PATH not fo… |
| recording-finalizer-sets-is-final | Pack U.7 — recording_finalizer.py sets mf['is_final']=True when writing master path, signaling chunk_write's defensive guard. Without it, late-chunk POST stomps the master. | 5 | ⬜ missing | lite: check RECORDING_FINALIZER_SETS_IS_FINAL not found in any report; compose: check RECORDING_FINALIZER_SETS_IS_FINAL not found in any report; helm: check RECORDING_FINALIZER_SETS_IS_FINAL not fo… |

### `realtime-transcription` (0% / gate 0%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|

### `realtime-transcription/gmeet` (0% / gate 0%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|

### `realtime-transcription/msteams` (0% / gate 0%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|

### `realtime-transcription/zoom` (0% / gate 0%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|

### `remote-browser` (0% / gate 95%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|
| cdp-ws-scheme-preserved | CDP proxy webSocketDebuggerUrl rewrite preserves the inbound scheme (wss:// on HTTPS gateways) | 10 | ⬜ missing | lite: check CDP_WS_SCHEME_PRESERVED not found in any report; compose: smoke-static/CDP_WS_SCHEME_PRESERVED: CDP proxy webSocketDebuggerUrl rewrite preserves inbound scheme (wss:// on HTTPS gateways… |
| cdp-no-slash-redirect | Bare /b/{token}/cdp (no trailing slash) is a first-class route — no 307 scheme downgrade | 10 | ⬜ missing | lite: check CDP_NO_SLASH_REDIRECT not found in any report; compose: smoke-static/CDP_NO_SLASH_REDIRECT: Bare /b/{token}/cdp (no trailing slash) is a first-class route — no 307 scheme downgrade |

### `security-hygiene` (10% / gate 95%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|
| h11-pinned-safe | Every service requirements*.txt with httpx/uvicorn pins h11>=0.16.0 (CVE-2025-43859) | 10 | ⬜ missing | lite: check H11_PINNED_SAFE_EVERYWHERE not found in any report; compose: smoke-static/H11_PINNED_SAFE_EVERYWHERE: every httpx/uvicorn requirements*.txt pins h11>=0.16.0 — CVE-2025-43859 closed tran… |
| docs-env-gated-everywhere | Every FastAPI app sets docs_url/redoc_url/openapi_url from VEXA_ENV — /docs default-deny on VEXA_ENV=production | 10 | ⬜ missing | lite: check DOCS_ENV_GATED_EVERYWHERE not found in any report; compose: smoke-static/DOCS_ENV_GATED_EVERYWHERE: every FastAPI app reads VEXA_ENV and passes docs_url/redoc_url/openapi_url derived fr… |
| vexa-bot-no-high-npm-vulns | services/vexa-bot + services/vexa-bot/core npm audit reports 0 HIGH + 0 CRITICAL | 5 | ⬜ missing | lite: check VEXA_BOT_NO_HIGH_NPM_VULNS not found in any report; compose: smoke-static/VEXA_BOT_NO_HIGH_NPM_VULNS: services/vexa-bot[basic-ftp=5.3.0] services/vexa-bot/core[basic-ftp=5.3.1] |
| chart-prod-secrets-via-secretkeyref | every prod secret (DB_PASSWORD, TRANSCRIPTION_SERVICE_TOKEN) sourced via secretKeyRef in rendered chart | 15 | ⬜ missing | helm: check HELM_PROD_SECRETS_SECRETREF_ONLY not found in any report |
| chart-prod-secrets-required-at-render | helm template exits non-zero when prod secrets are absent — fail loud at render, not silently at pod boot | 10 | ⬜ missing | helm: check HELM_PROD_SECRETS_REQUIRED_AT_RENDER not found in any report |
| engine-pool-reset-on-return-rollback-explicit | meeting-api database.py engine sets pool_reset_on_return='rollback' — regression guard for idle-in-transaction leak defense | 10 | ⬜ missing | lite: check ENGINE_POOL_RESET_ON_RETURN_ROLLBACK not found in any report; compose: smoke-static/ENGINE_POOL_RESET_ON_RETURN_ROLLBACK: meeting-api SQLAlchemy engine keeps pool_reset_on_return="rollb… |
| lite-postgres-not-public | deploy/lite/Makefile launches Postgres with listen_addresses=127.0.0.1 — not reachable from public internet | 15 | ⬜ missing | lite: check LITE_POSTGRES_NOT_PUBLIC not found in any report |
| lite-internal-services-loopback-only | deploy/lite/supervisord.conf binds every internal service (admin-api, runtime-api, meeting-api, agent-api, tts-service, mcp) to 127.0.0.1 | 10 | ⬜ missing | lite: check LITE_INTERNAL_SERVICES_LOOPBACK_ONLY not found in any report |
| lite-redis-not-public | deploy/lite/supervisord.conf Redis binds to 127.0.0.1 with protected-mode | 10 | ⬜ missing | lite: check LITE_REDIS_NOT_PUBLIC not found in any report |
| compose-ports-loopback-only | deploy/compose/docker-compose.yml dev-mode ports publish to 127.0.0.1 only (postgres, minio, admin-api, runtime-api, mcp) | 10 | ✅ pass | compose: smoke-static/COMPOSE_PORTS_LOOPBACK_ONLY: compose dev-mode ports (Postgres 5458, MinIO 9000/9001, admin-api 8057, runtime-api 8090, MCP 18888) publish to 127.0.0.1 only — only api-gateway … |

### `speaking-bot` (0% / gate 0%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|

### `webhooks` (9% / gate 95%)

| # | Label | Weight | Status | Evidence |
|---|-------|-------:|:------:|----------|
| events-meeting-completed | meeting.completed fires on every bot exit (default-enabled) | 10 | ⬜ missing | compose: no report for test=webhooks |
| events-status-webhooks | Status-change webhooks for non-meeting.completed events (meeting.started / meeting.status_change / bot.failed) fire when opted-in via webhook_events — proven by a delivery with event_type != meeting.completed, not by any entry in webhook_deliveries[]. | 10 | ⬜ missing | helm: no report for test=webhooks |
| envelope-shape | Every webhook carries envelope: event_id, event_type, api_version, created_at, data | 10 | ⬜ missing | compose: no report for test=webhooks |
| headers-hmac | X-Webhook-Signature = HMAC-SHA256(timestamp + '.' + payload) when secret is set | 10 | ⬜ missing | compose: no report for test=webhooks |
| security-spoof-protection | Client-supplied X-User-Webhook-* headers cannot override stored config | 10 | ⬜ missing | compose: no report for test=webhooks |
| security-secret-not-exposed | webhook_secret never appears in any API response (POST /bots, GET /bots/status) | 10 | ⬜ missing | compose: no report for test=webhooks |
| security-payload-hygiene | Internal fields (secret, url, container ids, delivery state) stripped from webhook payloads | 5 | ⬜ missing | compose: no report for test=webhooks |
| flow-user-config | PUT /user/webhook persists webhook_url + webhook_secret + webhook_events to User.data | 10 | ⬜ missing | compose: no report for test=webhooks |
| flow-gateway-inject | Gateway injects validated webhook config into meeting.data on POST /bots | 15 | ⬜ missing | compose: no report for test=webhooks |
| reliability-db-pool | DB connection pool doesn't exhaust under repeated status requests | 10 | ⬜ missing | lite: check DB_POOL_NO_EXHAUSTION not found in any report; compose: smoke-contract/DB_POOL_NO_EXHAUSTION: 10/10 requests returned 200 |
| security-ssrf-input-rejected | PUT /user/webhook rejects SSRF URLs (CVE-2026-25883 / GHSA-fhr6-8hff-cvg4) | 10 | ✅ pass | compose: smoke-contract/WEBHOOK_SSRF_INPUT_REJECTED: HTTP 400 (SSRF URL rejected) |

## Raw test results

### `compose`

| Test | Status | Duration | Steps (pass / total) |
|------|:------:|---------:|---------------------:|
| `smoke-contract` | ❌ fail | 8228 ms | 26 / 27 |
| `smoke-env` | ✅ pass | 542 ms | 7 / 7 |
| `smoke-health` | ❌ fail | 4693 ms | 12 / 17 |
| `smoke-static` | ❌ fail | 1301 ms | 94 / 96 |
| `v0.10.5.3-hallucination-corpus` | ✅ pass | 202 ms | 3 / 3 |
| `v0.10.6-static-greps` | ❌ fail | 810 ms | 13 / 15 |
