// Lock-screen Live Activity for a running session (iOS 16.2+ only).
//
// The card shows the profit + venue as the title, buy-in and current stack as
// the subtitle, and a system-driven elapsed timer for the duration. The timer
// ticks on its own without app updates, so we only push a new state when the
// stack, buy-in or pause status actually changes.
//
// Every call is a no-op on non-iOS platforms and on builds where the native
// module is missing (e.g. Expo Go), so callers never need to branch.

import { Platform } from 'react-native';
import type { LiveActivityConfig, LiveActivityState } from 'expo-live-activity';
import type { LiveSession } from '@/db/schema';
import { activeElapsedMs, formatDuration, liveProfit } from '@/utils/liveSession';
import { formatMoney, formatPnL, type Currency } from '@/utils/formatters';
import { colors } from '@/theme/colors';

// Typed against the real package so an API drift is a compile error rather than
// a state field the native side silently drops.
type LiveActivityModule = Pick<
  typeof import('expo-live-activity'),
  'startActivity' | 'updateActivity' | 'stopActivity'
>;

// Resolved lazily: on Android/web (and any build without the native module)
// the require throws or returns nothing, and we degrade to a no-op.
let cached: LiveActivityModule | null | undefined;
function getModule(): LiveActivityModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS !== 'ios') {
    cached = null;
    return cached;
  }
  try {
    const mod = require('expo-live-activity') as LiveActivityModule;
    cached = typeof mod?.startActivity === 'function' ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function isLiveActivitySupported(): boolean {
  return getModule() !== null;
}

// The colours are the app's own — the card sits next to the app on the lock
// screen, so a different green reads as a different product.
const CONFIG: LiveActivityConfig = {
  backgroundColor: colors.bg,
  titleColor: colors.text,
  subtitleColor: colors.textMuted,
  // Also tints the elapsed timer, on the lock screen and in the Dynamic Island.
  progressViewTint: colors.profit,
  progressViewLabelColor: colors.text,
  // Tapping the lock-screen card opens the live session screen.
  deepLinkUrl: '/live',
  timerType: 'digital',
};

/**
 * Build the lock-screen state.
 *
 * A running session gets an elapsed timer that iOS renders and ticks itself, so
 * the duration stays live between our pushes. Its origin is the session start
 * pushed forward by the time spent paused, which makes the timer show *played*
 * time rather than wall-clock time since the session began.
 *
 * A paused session cannot use it — the native timer has no pause state and
 * would keep counting while the player is away from the table — so the frozen
 * duration goes into the subtitle as text instead.
 */
function buildState(session: LiveSession, currency: Currency): LiveActivityState {
  const where = session.venue || session.stakes || 'Live session';
  const title = `${formatPnL(liveProfit(session), currency)} · ${where}`;
  const stack = formatMoney(session.currentStack, currency);

  if (session.status === 'paused') {
    return {
      title,
      subtitle: `Paused · ${formatDuration(activeElapsedMs(session))} · Stack ${stack}`,
    };
  }

  return {
    title,
    subtitle: `Buy-in ${formatMoney(session.buyIn, currency)} · Stack ${stack}`,
    progressBar: { elapsedTimer: { startDate: session.startedAt + session.pausedMs } },
  };
}

// iOS budgets how often a Live Activity may be updated, and a throttled card
// goes stale. Pushing a state that renders identically to the last one — adding
// a note, say — only spends that budget, so we skip it.
let lastPushed = '';
const pushKey = (activityId: string, state: LiveActivityState) =>
  `${activityId}:${JSON.stringify(state)}`;

/** Start the lock-screen card; returns the activity id to store, or ''. */
export function startLiveActivity(session: LiveSession, currency: Currency): string {
  const mod = getModule();
  if (!mod) return '';
  try {
    const state = buildState(session, currency);
    const id = mod.startActivity(state, CONFIG) ?? '';
    lastPushed = id ? pushKey(id, state) : '';
    return id;
  } catch {
    return '';
  }
}

export function updateLiveActivity(session: LiveSession, currency: Currency): void {
  const mod = getModule();
  if (!mod || !session.activityId) return;
  const state = buildState(session, currency);
  const key = pushKey(session.activityId, state);
  if (key === lastPushed) return;
  try {
    mod.updateActivity(session.activityId, state);
    lastPushed = key;
  } catch {
    // A dismissed/stale activity can no longer be updated — not fatal.
  }
}

/** Dismiss the lock-screen card, showing the final result one last time. */
export function stopLiveActivity(session: LiveSession, currency: Currency): void {
  const mod = getModule();
  if (!mod || !session.activityId) return;
  lastPushed = '';
  try {
    mod.stopActivity(session.activityId, {
      title: `Session ended · ${formatPnL(liveProfit(session), currency)}`,
      subtitle: `${formatDuration(activeElapsedMs(session))} played`,
      progressBar: { progress: 1 },
    });
  } catch {
    // Already gone — nothing to clean up.
  }
}
