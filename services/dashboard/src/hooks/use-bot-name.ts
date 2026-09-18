import { useState, useCallback } from "react";

const STORAGE_KEY = "vexa-join-bot-name";

// "." is the server-side fallback the bot uses when no name is given. It is not
// a user choice, and older builds persisted it — which refilled the form with
// "." and then re-stored it on every submit, so once a bot joined as "." it
// stayed "." forever. Treat a stored "." as unset (heals poisoned browsers)
// and never write it back.
function readStoredName(): string {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && stored !== "." ? stored : "";
}

function persistName(name: string): void {
  if (typeof window === "undefined") return;
  const typed = name.trim();
  if (typed && typed !== ".") {
    localStorage.setItem(STORAGE_KEY, typed);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Bot-name field state shared by the join form and the join modal.
 *
 * Owns the one piece of logic both screens got subtly wrong: initializing from
 * localStorage without inheriting the "." fallback, and persisting only what
 * the user actually typed. `resolve()` returns the value to send to the API
 * (typed → configured default → ".") and persists as a side effect, so callers
 * can't reintroduce the "store the fallback" bug.
 */
export function useBotName() {
  const [botName, setBotName] = useState<string>(readStoredName);

  const resolve = useCallback(
    (configuredDefault?: string | null): string => {
      persistName(botName);
      return botName.trim() || configuredDefault || ".";
    },
    [botName]
  );

  return { botName, setBotName, resolve };
}
