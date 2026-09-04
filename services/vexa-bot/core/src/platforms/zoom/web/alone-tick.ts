/**
 * Alone-timer decision logic for Zoom Web participant monitoring.
 *
 * Pure module (no imports) so the unit test (alone-tick.test.ts) runs without
 * pulling in playwright / the bot entrypoint.
 *
 * Decided design — scope 260904-zoom-alone-timeout, issue
 * zoom-alone-false-positive:
 * - Audio activity within the veto window is independent ground truth that
 *   the room is live: reset the timer no matter what the DOM says
 *   (#285 Layer-2 parity with Google Meet).
 * - An unreadable participant count FREEZES the timer. Missing data is not
 *   evidence of an empty room — the pre-fix visible-tile count turned exactly
 *   this signal loss into a guaranteed leave at 900 s (prod meetings
 *   40/41/42/44). A stuck-unreadable empty room is reaped by the server-side
 *   max_bot_time backstop (meeting-api meetings.py, max_bot_time_exceeded).
 * - A readable count > 1 resets; a readable count <= 1 (bot alone) accrues.
 */

export interface ZoomAloneTickInput {
  /** Participant count read from the Participants-button badge; null = unreadable this tick. */
  participantCount: number | null;
  /** Last Node-side audio activity (ms epoch); 0 = none seen yet. */
  lastAudioActivityTs: number;
  /** Current time (ms epoch). */
  nowTs: number;
  /** Seconds of alone-time accrued before this tick. */
  aloneTime: number;
}

/** Audio within this window vetoes alone-time accrual (#285 Layer 2). */
export const ZOOM_AUDIO_VETO_WINDOW_MS = 120_000;

/** Returns the alone-timer value (seconds) after one 1 s monitoring tick. */
export function computeZoomAloneTick(input: ZoomAloneTickInput): number {
  const { participantCount, lastAudioActivityTs, nowTs, aloneTime } = input;
  if (lastAudioActivityTs > 0 && nowTs - lastAudioActivityTs < ZOOM_AUDIO_VETO_WINDOW_MS) {
    return 0;
  }
  if (participantCount === null) {
    return aloneTime;
  }
  if (participantCount > 1) {
    return 0;
  }
  return aloneTime + 1;
}
