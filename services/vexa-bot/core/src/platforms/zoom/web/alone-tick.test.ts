/**
 * Standalone test for computeZoomAloneTick — the alone-timer decision logic
 * behind Zoom Web's left-alone auto-leave. Covers release
 * 260904-zoom-alone-timeout (bot abandoned live meetings at exactly
 * max_time_left_alone because visible-tile counting saw an empty room).
 *
 * Run: npx tsx services/vexa-bot/core/src/platforms/zoom/web/alone-tick.test.ts
 */

import { computeZoomAloneTick, ZOOM_AUDIO_VETO_WINDOW_MS } from './alone-tick';

let passed = 0;
let failed = 0;

function expect(name: string, actual: any, expected: any) {
  if (actual === expected) {
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
    passed++;
  } else {
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}`);
    console.log(`        expected: ${JSON.stringify(expected)}`);
    console.log(`        actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

const NOW = 1_756_000_000_000;

console.log('\n=== computeZoomAloneTick — badge count governs ===');

expect(
  'count > 1 resets the timer',
  computeZoomAloneTick({ participantCount: 3, lastAudioActivityTs: 0, nowTs: NOW, aloneTime: 500 }),
  0,
);

expect(
  'count 1 (bot alone) accrues',
  computeZoomAloneTick({ participantCount: 1, lastAudioActivityTs: 0, nowTs: NOW, aloneTime: 41 }),
  42,
);

expect(
  'count 0 accrues',
  computeZoomAloneTick({ participantCount: 0, lastAudioActivityTs: 0, nowTs: NOW, aloneTime: 0 }),
  1,
);

console.log('\n=== unreadable count freezes (missing data ≠ empty room) ===');

expect(
  'null count freezes accrued time',
  computeZoomAloneTick({ participantCount: null, lastAudioActivityTs: 0, nowTs: NOW, aloneTime: 42 }),
  42,
);

expect(
  'null count does not reset either',
  computeZoomAloneTick({ participantCount: null, lastAudioActivityTs: 0, nowTs: NOW, aloneTime: 899 }),
  899,
);

console.log('\n=== audio veto (#285 Layer-2 parity) ===');

expect(
  'recent audio vetoes accrual even when count says alone',
  computeZoomAloneTick({ participantCount: 1, lastAudioActivityTs: NOW - 1_000, nowTs: NOW, aloneTime: 890 }),
  0,
);

expect(
  'recent audio vetoes accrual when count unreadable',
  computeZoomAloneTick({ participantCount: null, lastAudioActivityTs: NOW - 60_000, nowTs: NOW, aloneTime: 890 }),
  0,
);

expect(
  'audio at exactly the veto-window edge no longer vetoes',
  computeZoomAloneTick({ participantCount: 1, lastAudioActivityTs: NOW - ZOOM_AUDIO_VETO_WINDOW_MS, nowTs: NOW, aloneTime: 10 }),
  11,
);

expect(
  'zero timestamp (no audio ever) does not veto',
  computeZoomAloneTick({ participantCount: 1, lastAudioActivityTs: 0, nowTs: NOW, aloneTime: 0 }),
  1,
);

console.log('\n=== silent empty room still times out ===');

{
  // Readable count of 1, no audio: 900 ticks must reach the 900 s threshold.
  let aloneTime = 0;
  for (let i = 0; i < 900; i++) {
    aloneTime = computeZoomAloneTick({ participantCount: 1, lastAudioActivityTs: 0, nowTs: NOW + i * 1000, aloneTime });
  }
  expect('900 silent alone ticks reach the 900 s threshold', aloneTime, 900);
}

{
  // Regression shape of prod meeting 44: room is LIVE (audio flowing) but the
  // DOM count is stuck at 1 for the whole meeting. Timer must stay at 0.
  let aloneTime = 0;
  for (let i = 0; i < 1000; i++) {
    const now = NOW + i * 1000;
    aloneTime = computeZoomAloneTick({ participantCount: 1, lastAudioActivityTs: now - 5_000, nowTs: now, aloneTime });
  }
  expect('live meeting with stuck count never accrues (meeting-44 shape)', aloneTime, 0);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
