---
services:
- dashboard
- admin-api
- api-gateway
---

# Dashboard

**DoDs:** see [`./dods.yaml`](./dods.yaml) · Gate: **confidence ≥ 90%**

## What

Next.js dashboard at `/meetings`. Shows meeting list, per-meeting transcript, live status updates via WebSocket, recordings, chat.

## User flows

```
Login (magic link or direct) → meetings list → click meeting → meeting detail page
  → transcript renders (REST bootstrap) → live updates via WS → status badge updates
```

## DoD


<!-- BEGIN AUTO-DOD -->
<!-- Auto-written by tests3/lib/aggregate.py from release tag `unknown`. Do not edit by hand — edit the sidecar `dods.yaml` + re-run `make -C tests3 report --write-features`. -->

**Confidence: 0%** (gate: 90%, status: ❌ below gate)

| # | Behavior | Weight | Status | Evidence (modes) |
|---|----------|-------:|:------:|------------------|
| login-flow | POST /api/auth/send-magic-link → 200 + success=true + sets vexa-token cookie | 10 | ⬜ missing | `lite`: no report for test=dashboard-auth; `compose`: no report for test=dashboard-auth; `helm`: no report for test=dashboard-auth |
| cookie-flags | vexa-token cookie Secure flag matches deployment (Secure iff https) | 10 | ⬜ missing | `lite`: no report for test=dashboard-auth; `compose`: no report for test=dashboard-auth; `helm`: no report for test=dashboard-auth |
| identity-me | GET /api/auth/me returns logged-in user's email (never falls back to env) | 10 | ⬜ missing | `lite`: no report for test=dashboard-auth; `compose`: no report for test=dashboard-auth; `helm`: no report for test=dashboard-auth |
| cookie-security | HttpOnly + SameSite cookies on magic-link send/verify + admin-verify + nextauth | 10 | ⬜ missing | `lite`: check SECURE_COOKIE_SEND_MAGIC_LINK not found in any report; `compose`: smoke-static/SECURE_COOKIE_SEND_MAGIC_LINK: cookie Secure flag based on actual protocol, not NODE_ENV (send-magic-link); `helm`: check SECURE_COOKIE_SEND_MAGIC_LINK not found in any report |
| login-redirect | Magic-link click redirects to /meetings (not disabled /agent) | 5 | ⬜ missing | `lite`: check LOGIN_REDIRECT not found in any report; `compose`: smoke-static/LOGIN_REDIRECT: login redirects to / (then /meetings), not to disabled /agent page; `helm`: check LOGIN_REDIRECT not found in any report |
| identity-no-fallback | /api/auth/me uses only the cookie for identity, never env fallback | 5 | ⬜ missing | `lite`: check IDENTITY_NO_FALLBACK not found in any report; `compose`: smoke-static/IDENTITY_NO_FALLBACK: /api/auth/me uses only cookie for identity, never falls back to env var; `helm`: check IDENTITY_NO_FALLBACK not found in any report |
| proxy-reachable | GET /api/vexa/meetings via cookie returns 200 | 10 | ⬜ missing | `lite`: no report for test=dashboard-auth; `compose`: no report for test=dashboard-auth; `helm`: no report for test=dashboard-auth |
| meetings-list | /api/vexa/meetings returns a meeting list through the dashboard proxy | 5 | ⬜ missing | `compose`: no report for test=dashboard-proxy; `helm`: no report for test=dashboard-proxy |
| pagination | limit/offset pagination works (no overlap between pages) | 5 | ⬜ missing | `compose`: no report for test=dashboard-proxy; `helm`: no report for test=dashboard-proxy |
| field-contract | Meeting records include native_meeting_id / platform_specific_id | 5 | ⬜ missing | `compose`: no report for test=dashboard-proxy; `helm`: no report for test=dashboard-proxy |
| transcript-proxy | Transcript reachable through dashboard proxy | 5 | ⬜ missing | `compose`: no report for test=dashboard-proxy; `helm`: no report for test=dashboard-proxy |
| bot-create-proxy | POST /api/vexa/bots reaches the gateway and creates a bot (or returns 403/409) | 5 | ⬜ missing | `compose`: no report for test=dashboard-proxy; `helm`: no report for test=dashboard-proxy |
| dashboard-up | Dashboard root page responds | 5 | ⬜ missing | `lite`: check DASHBOARD_UP not found in any report; `compose`: smoke-health/DASHBOARD_UP: dashboard serves pages — user can access the UI; `helm`: check DASHBOARD_UP not found in any report |
| dashboard-ws-url | NEXT_PUBLIC_WS_URL is set — live updates can connect | 5 | ⬜ missing | `lite`: check DASHBOARD_WS_URL not found in any report; `compose`: smoke-health/DASHBOARD_WS_URL: ws://localhost:3001/ws; `helm`: check DASHBOARD_WS_URL not found in any report |
| dashboard-admin-key-valid | Dashboard's VEXA_ADMIN_API_KEY is accepted by admin-api (login path works) | 5 | ⬜ missing | `lite`: check DASHBOARD_ADMIN_KEY_VALID not found in any report; `compose`: smoke-env/DASHBOARD_ADMIN_KEY_VALID: dashboard can authenticate to admin-api — user lookup and login will work; `helm`: check DASHBOARD_ADMIN_KEY_VALID not found in any report |
| packages-transcript-rendering-tests-pass | packages/transcript-rendering npm test passes — guards the dedup-prefers-confirmed fix + existing 76 tests | 5 | ⬜ missing | `lite`: check TRANSCRIPT_RENDERING_DEDUP_TESTS_PASS not found in any report |
| packages-ci-workflow-exists | .github/workflows/test-packages.yml exists and runs npm test per package in matrix | 5 | ⬜ missing | `lite`: check PACKAGES_CI_WORKFLOW_EXISTS not found in any report |
| download-returns-presigned-url-to-master | GET /recordings/{id}/media/{file}/download returns JSON with .url path ending at /audio/master.{webm\|wav} — browser-reachable via MINIO_PUBLIC_ENDPOINT (Pack D-3 Option B kept). (weight 3: runtime-fixture-dependent; static-grep DASHBOARD_AUDIO_STREAMS_FROM_BUCKET carries the structural proof at full weight) | 3 | ⬜ missing | `lite`: check DOWNLOAD_RETURNS_PRESIGNED_URL_TO_MASTER not found in any report; `compose`: check DOWNLOAD_RETURNS_PRESIGNED_URL_TO_MASTER not found in any report; `helm`: check DOWNLOAD_RETURNS_PRESIGNED_URL_TO_MASTER not found in any report |
| dashboard-audio-streams-from-bucket | dashboard reads /recordings/.../download (NOT /raw); <audio src> binds to the presigned URL; native HTTP Range fires on user seek | 10 | ⬜ missing | `lite`: check DASHBOARD_AUDIO_STREAMS_FROM_BUCKET not found in any report; `compose`: v0.10.6-static-greps/DASHBOARD_AUDIO_STREAMS_FROM_BUCKET: dashboard reads /download → presigned URL; `helm`: check DASHBOARD_AUDIO_STREAMS_FROM_BUCKET not found in any report |
| dashboard-meetings-pagination-tracks-unfiltered-offset | dashboard meetings-store.ts paginates by explicit _offset cursor + dedupes by meeting.id (closes GH #304 — duplicate rows when redacted shells filtered out) | 10 | ⬜ missing | `lite`: check DASHBOARD_MEETINGS_PAGINATION_TRACKS_UNFILTERED_OFFSET not found in any report; `compose`: v0.10.6-static-greps/DASHBOARD_MEETINGS_PAGINATION_TRACKS_UNFILTERED_OFFSET: meetings-store.ts uses explicit _offset cursor + dedupe-by-meeting.id (closes #304 duplicate-rows class); `helm`: c… |

<!-- END AUTO-DOD -->

