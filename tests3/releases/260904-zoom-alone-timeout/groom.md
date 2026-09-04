# Groom — 260904-zoom-alone-timeout — Zoom Web bot leaves live meetings at exactly 15 min

> **Internal release ID:** `260904-zoom-alone-timeout`
> **Theme:** Zoom Web bot false-positive "left alone" detection — bot abandons
> live meetings with real participants at exactly `max_time_left_alone` (15 min).

| field       | value                                                        |
|-------------|--------------------------------------------------------------|
| release_id  | `260904-zoom-alone-timeout`                                  |
| stage       | `groom`                                                      |
| entered_at  | `2026-09-04` (see `.state/stage-log.ndjson`)                 |
| actor       | `AI:groom`                                                   |
| predecessor | `idle` (fresh bootstrap — main checkout was uninitialised)   |

> **Protocol deviation note:** stage doc `01-groom.md` step 0 calls for
> `make release-worktree ID=<id>`, but that target does not exist in
> `tests3/Makefile`. Running from the main checkout; no parallel release is
> active, so `.current-stage` collision risk (#229) does not apply.

---

## Inputs

### Market signal — direct user report (project owner, 2026-09-04)

User report (paraphrased): *"왜 중간에 나가졌는데"* — the bot left an ongoing
Zoom meeting mid-session today.

### Forensic evidence (vexa-postgres, production DB)

Meeting 44 (zoom, today 2026-09-04):

- `active` 10:02:42 → `completed` 10:17:53 = **911 s** after going active.
- `resolved_timeouts.max_time_left_alone` = 900 000 ms. 911 ≈ 900 s + monitor
  loop drift. Not a coincidence — see the pattern below.
- Meeting was live the whole time: 61 audio chunks uploaded (15 min), 3 chat
  messages from 2 distinct human senders (participant-B, participant-C),
  1 participant name harvested by speaker detection (participant-A).
- DB `participants` field contains exactly ONE name — the bot never saw more
  than 1 tile.
- Recorded exit: `reason: self_initiated_leave, exit_code: 1, source: user,
  completion_reason: stopped`. Misleading — no user requested a stop.
  `self_initiated_leave` is the **schema default** when the bot's exiting
  callback carries no reason (`meeting-api/callbacks.py:233`).

Same signature in every prior Zoom meeting on record:

| meeting | date       | active → end | duration |
|---------|------------|--------------|----------|
| 40      | 2026-07-09 | 15:47:09 → 16:02:21 | 912 s |
| 41      | 2026-07-27 | 10:30:26 → 10:45:39 | 913 s |
| 42      | 2026-08-10 | 10:32:42 → 10:47:54 | 912 s |
| 44      | 2026-09-04 | 10:02:42 → 10:17:53 | 911 s |

4/4 Zoom meetings ended at 900 s + ~12 s. Deterministic, not situational.

### Code-confirmed root cause

`services/vexa-bot/core/src/platforms/zoom/web/recording.ts:249-289`
(`startZoomParticipantMonitoring`): participant count =
`document.querySelectorAll('.video-avatar__avatar').length`, every 1 s;
`count <= 1` increments `aloneTime`; `aloneTime >= 900` → leave.

The Zoom Web client only renders **visible tiles** in the DOM. In speaker
view / cameras-off meetings the bot sees ≤1 avatar for the entire meeting →
the alone timer never resets → guaranteed leave at exactly
`everyoneLeftTimeout` in every meeting regardless of who is present.

### In-repo precedent

Google Meet had this exact bug class — fixed as **#285 Layer 2** ("audio
cross-validate", `googlemeet/recording.ts:620-637`): before incrementing
`aloneTime`, consult `__vexaLastAudioActivityTs`; audio activity within 120 s
vetoes the alone count. Two independent signals. Zoom never received this
guard. Zoom Web already exposes a Node-side raw-audio hook
(`PulseAudioCapture.onRawAudio`, already wired in `zoom/web/recording.ts:74`),
so the port is cheap.

---

## Pack Z1 — Zoom Web false left-alone leave (the only pack)

- **Symptom:** Zoom bot abandons live meetings at exactly 15 min; DB
  mislabels the exit as user-requested `stopped`.
- **Owner feature:** vexa-bot / zoom web platform (`services/vexa-bot/core/src/platforms/zoom/web/`).
- **Estimated scope:** small — 1 source file + unit test + 3-4 static
  registry locks. Plus a one-line reason-reporting fix so the exit is
  recorded as `left_alone_timeout` instead of the misleading default.
- **Reproducibility confidence:** high — 4/4 production Zoom meetings show
  the deterministic 900 s signature; root cause is code-confirmed.

`approved: true`
approval_source: project-owner explicit current-turn signal 2026-09-04 —
"ㅇㅇ" in reply to "수정 시작할까요?" for exactly this bug. Single pack;
nothing else was offered or deferred.

---

## PII note

Participant names + meeting URL/passcode exist in the production DB and in
the chat transcript quoted during diagnosis. They are anonymized here
(participant-A/B/C) per the `RELEASE_DOCS_NO_PII` rule; meeting referenced
by internal ID (44) only.

## Next

`plan` — draft `scope.yaml` + `plan-approval.yaml`; human signs line-by-line.
