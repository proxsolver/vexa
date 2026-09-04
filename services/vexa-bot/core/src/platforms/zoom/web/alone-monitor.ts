/**
 * Zoom Web left-alone monitoring — release 260904-zoom-alone-timeout.
 *
 * Owns the participant-count polling + audio-activity tracking that decide
 * when the bot is genuinely alone. Split out of recording.ts to keep that
 * file within the Pack U line budget (selectors + DOM glue only).
 */
import { Page } from 'playwright';
import { BotConfig } from '../../../types';
import { log } from '../../../utils';
import { computeZoomAloneTick } from './alone-tick';
import { zoomParticipantsButtonSelector, zoomParticipantsCountBadgeSelector } from './selectors';

let monitoringInterval: NodeJS.Timeout | null = null;
let lastZoomAudioActivityTs = 0;

/**
 * Cheap peak scan per parecord burst — feeds the #285 Layer-2 audio
 * cross-validate veto in computeZoomAloneTick (same threshold + stride as
 * googlemeet/recording.ts). Runs Node-side because Zoom Web captures audio
 * via PulseAudio, not a browser MediaStream.
 */
const AUDIO_ACTIVITY_THRESHOLD = 0.005; // RMS above silence baseline
export function trackZoomAudioActivity(audioData: Float32Array): void {
  if (!audioData || audioData.length === 0) return;
  // 1-of-32 sample stride is plenty to detect non-silence
  for (let i = 0; i < audioData.length; i += 32) {
    if (Math.abs(audioData[i]) > AUDIO_ACTIVITY_THRESHOLD) {
      lastZoomAudioActivityTs = Date.now();
      return;
    }
  }
}

/**
 * Start monitoring participant count for automatic leave when everyone leaves.
 * Similar to Google Meet's setupGoogleMeetingMonitoring but adapted for Zoom Web.
 *
 * The count comes from the footer Participants-button badge, NOT from video
 * tiles: the Zoom Web client renders only VISIBLE tiles into the DOM, so
 * counting .video-avatar__avatar reported "1" for entire speaker-view /
 * cameras-off meetings and produced a guaranteed false left-alone leave at
 * exactly max_time_left_alone (prod meetings 40/41/42/44, release
 * 260904-zoom-alone-timeout). The badge counts the roster, not the viewport;
 * the button's aria-label is the second read of the same widget (decided in
 * scope 260904, issue zoom-alone-false-positive — not a fallback path).
 */
export function startZoomParticipantMonitoring(
  page: Page,
  botConfig: BotConfig,
  onTimeoutReached: () => void
): void {
  const leaveCfg = (botConfig.automaticLeave) || {};
  // Config values are in milliseconds, convert to seconds
  const everyoneLeftTimeoutMs = Number(leaveCfg.everyoneLeftTimeout ?? 60000); // Default 60s (60000ms)
  const everyoneLeftTimeoutSeconds = Math.floor(everyoneLeftTimeoutMs / 1000);

  let aloneTime = 0;
  let lastLoggedCount: number | null = null;
  let monitoringStopped = false;

  log(`[Zoom Web] Starting participant monitoring (timeout: ${everyoneLeftTimeoutSeconds}s)`);

  monitoringInterval = setInterval(async () => {
    if (monitoringStopped || !page || page.isClosed()) return;

    try {
      const participantCount = await page.evaluate(
        ({ badgeSelector, buttonSelector }) => {
          const badge = document.querySelector(badgeSelector);
          const badgeNum = parseInt(badge?.textContent?.trim() || '', 10);
          if (Number.isFinite(badgeNum) && badgeNum > 0) return badgeNum;
          const aria = document.querySelector(buttonSelector)?.getAttribute('aria-label') || '';
          const m = aria.match(/(\d+)/);
          const ariaNum = m ? parseInt(m[1], 10) : NaN;
          if (Number.isFinite(ariaNum) && ariaNum > 0) return ariaNum;
          return null; // unreadable this tick — freezes the alone timer
        },
        { badgeSelector: zoomParticipantsCountBadgeSelector, buttonSelector: zoomParticipantsButtonSelector }
      );

      if (participantCount !== lastLoggedCount) {
        log(`[Zoom Web] Participant count: ${lastLoggedCount ?? 'unreadable'} → ${participantCount ?? 'unreadable'}`);
        lastLoggedCount = participantCount;
      }

      const prevAloneTime = aloneTime;
      aloneTime = computeZoomAloneTick({
        participantCount,
        lastAudioActivityTs: lastZoomAudioActivityTs,
        nowTs: Date.now(),
        aloneTime,
      });

      if (aloneTime === 0 && prevAloneTime > 0) {
        log(`[Zoom Web] Presence detected (count or recent audio), resetting alone timer (was ${prevAloneTime}s)`);
      } else if (aloneTime > 0 && aloneTime % 10 === 0) {
        // Log every 10 seconds
        log(`[Zoom Web] Bot has been alone for ${aloneTime}s. Will leave in ${everyoneLeftTimeoutSeconds - aloneTime}s.`);
      }

      if (aloneTime >= everyoneLeftTimeoutSeconds) {
        monitoringStopped = true;
        log(`[Zoom Web] Timeout reached: bot alone for ${aloneTime}s. Leaving...`);
        onTimeoutReached();
      }
    } catch (e: any) {
      // Page may be navigating — ignore errors
    }
  }, 1000); // Check every second
}

export function stopZoomParticipantMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  lastZoomAudioActivityTs = 0;
}
