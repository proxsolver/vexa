import { Page } from "playwright";
import { log } from "../../utils";

const MAX_CAPTION_RETRIES = 3;
const CAPTION_RETRY_DELAY_MS = 5000;

export async function enableTeamsLiveCaptions(page: Page): Promise<void> {
  log("[Captions] Attempting to enable Teams live captions...");

  for (let attempt = 1; attempt <= MAX_CAPTION_RETRIES; attempt++) {
    try {
      const success = await tryEnableCaptions(page);
      if (success) {
        log(`[Captions] ✅ Live captions enabled on attempt ${attempt}`);
        return;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(`[Captions] Attempt ${attempt}/${MAX_CAPTION_RETRIES} failed: ${message}`);
    }

    if (attempt < MAX_CAPTION_RETRIES) {
      log(`[Captions] Retrying in ${CAPTION_RETRY_DELAY_MS / 1000}s...`);
      await page.waitForTimeout(CAPTION_RETRY_DELAY_MS);
    }
  }

  log(`[Captions] ⚠️ All ${MAX_CAPTION_RETRIES} attempts failed — captions may not be available`);
}

async function tryEnableCaptions(page: Page): Promise<boolean> {
  await page.waitForTimeout(3000);

  const alreadyEnabled = await page.evaluate(() => {
    return !!document.querySelector('[data-tid="closed-caption-renderer-wrapper"]');
  });
  if (alreadyEnabled) {
    log("[Captions] Live captions already enabled");
    return true;
  }

  if (!await clickMoreButton(page)) return false;

  const result = await findAndClickCaptionItem(page);
  if (!result.clicked) {
    try { await page.keyboard.press('Escape'); } catch {}
    throw new Error(`Could not find captions menu item. Available: ${result.available ?? 'unknown'}`);
  }

  log(`[Captions] Clicked: "${result.clicked}" (${result.path})`);
  await page.waitForTimeout(1000);

  if (result.path === 'submenu') {
    await clickSubmenuItem(page);
  }

  return verifyCaptionsEnabled(page);
}

async function clickMoreButton(page: Page): Promise<boolean> {
  const moreSelectors = [
    '#callingButtons-showMoreBtn',
    'button[aria-label="More"]',
    'button[aria-label="More options"]',
    'button[data-tid="callingButtons-showMoreBtn"]',
  ].join(', ');

  const moreButton = page.locator(moreSelectors).first();
  const moreVisible = await moreButton.isVisible().catch(() => false);
  if (!moreVisible) {
    log("[Captions] More button not visible — captions may not be available yet");
    return false;
  }

  await moreButton.click({ timeout: 8000 });
  log("[Captions] Clicked More menu");
  await page.waitForTimeout(1000);
  return true;
}

interface CaptionMenuResult {
  clicked: string | null;
  path: string;
  available?: string;
}

async function findAndClickCaptionItem(page: Page): Promise<CaptionMenuResult> {
  const menuItems = await page.evaluate(() => {
    const items = document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]');
    return Array.from(items).map(el => ({
      text: (el.textContent || '').trim().substring(0, 60),
      role: el.getAttribute('role') || '',
      visible: (el as HTMLElement).offsetParent !== null
    })).filter(i => i.visible);
  });
  log(`[Captions] Menu items: ${menuItems.map(i => i.text).join(' | ')}`);

  return page.evaluate(() => {
    const getVisibleItems = () => {
      const items = document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]');
      return Array.from(items).filter(el => (el as HTMLElement).offsetParent !== null);
    };

    const items = getVisibleItems();
    const texts = items.map(el => (el.textContent || '').trim().toLowerCase());

    // Path A (guest): Direct "Captions" menu item
    for (const el of items) {
      const text = (el.textContent || '').trim().toLowerCase();
      if (text === 'captions' || text === 'show live captions' || text === 'turn on live captions') {
        (el as HTMLElement).click();
        return { clicked: (el.textContent || '').trim(), path: 'direct' };
      }
    }

    // Path B (host): "Language and speech" submenu
    for (const el of items) {
      const text = (el.textContent || '').toLowerCase();
      if (text.includes('language') && text.includes('speech')) {
        (el as HTMLElement).click();
        return { clicked: (el.textContent || '').trim(), path: 'submenu' };
      }
    }

    // Path C: Broader matching — any item with "caption" substring
    for (const el of items) {
      const text = (el.textContent || '').toLowerCase();
      if (text.includes('caption')) {
        (el as HTMLElement).click();
        return { clicked: (el.textContent || '').trim(), path: 'broad-match' };
      }
    }

    return { clicked: null, path: 'none', available: texts.join(' | ') };
  });
}

async function clickSubmenuItem(page: Page): Promise<void> {
  const clickedSub = await page.evaluate(() => {
    const items = document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]');
    for (const el of items) {
      const text = (el.textContent || '').toLowerCase();
      if (text.includes('live captions') && (el as HTMLElement).offsetParent) {
        (el as HTMLElement).click();
        return (el.textContent || '').trim();
      }
    }
    for (const el of items) {
      const text = (el.textContent || '').toLowerCase();
      if (text.includes('caption') && (el as HTMLElement).offsetParent) {
        (el as HTMLElement).click();
        return (el.textContent || '').trim();
      }
    }
    return null;
  });
  if (clickedSub) {
    log(`[Captions] Clicked submenu: "${clickedSub}"`);
  } else {
    log("[Captions] ⚠️ Could not find live captions in submenu");
  }
  await page.waitForTimeout(1500);
}

async function verifyCaptionsEnabled(page: Page): Promise<boolean> {
  const captionsEnabled = await page.evaluate(() => {
    return !!document.querySelector('[data-tid="closed-caption-renderer-wrapper"]');
  });
  if (captionsEnabled) {
    log("[Captions] ✅ Live captions enabled successfully");
    return true;
  }

  try { await page.keyboard.press('Escape'); } catch {}
  log("[Captions] ⚠️ Captions menu clicked but wrapper not found yet — will verify on retry");
  return false;
}
