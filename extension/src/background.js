/**
 * @license MIT
 * Copyright 2025 VannRR <https://github.com/vannrr>
 *
 * see the LICENSE file for details
 */

import { NativePort } from "./NativePort";
import { createFirefoxTheme } from "./theme-creator";

const FALLBACK_COLOR = /** @type {RGB} */ ([28, 32, 39]);

/**
 * An RGB triplet with each channel in 0–255.
 * @typedef {[number, number, number]} RGB
 */

/**
 * The parsed shape of a native response.
 * @typedef {Object} ParsedMessage
 * @property {RGB|null} rgb     The color tuple or null if missing/invalid.
 * @property {string|null} error An error string if the host reported one.
 */

/**
 * Checks whether a value is an integer in the 0–255 range.
 *
 * @param {unknown} x  Any value to test.
 * @returns {boolean}  True if x is a number, integer, and between 0–255.
 */
function isIntegerByte(x) {
  return typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 255;
}

/**
 * Converts an RGB tuple into a stable string ID.
 *
 * @param {RGB} color  The [r, g, b] tuple.
 * @returns {string}    A JSON string like "[r,g,b]".
 */
function rgbToID(color) {
  return JSON.stringify(color);
}

/**
 * Parses the raw message from the native host.
 *
 * @param {unknown} raw
 * @returns {ParsedMessage}
 * @throws If raw is not a plain object.
 */
function parseMessage(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("message is not an object");
  }

  /** @type {Record<string, unknown>} */
  const anyRaw = raw;

  const rgb = parseRGB(anyRaw["rgb"]);

  const errVal = anyRaw.hasOwnProperty("error") ? anyRaw["error"] : null;
  if (typeof errVal === "string" || errVal === null) {
    return { rgb, error: errVal };
  }
  throw new Error("message.error is not a string or null");
}

/**
 * Validates and returns an RGB array.
 *
 * @param {unknown} raw
 * @returns {RGB}
 * @throws If raw is not a length-3 array of valid bytes.
 */
function parseRGB(raw) {
  if (!Array.isArray(raw)) {
    throw new Error(`'${raw}' is not an array`);
  }
  if (raw.length !== 3) {
    throw new Error(`'${raw}' must have length 3`);
  }
  if (isIntegerByte(raw[0]) && isIntegerByte(raw[1]) && isIntegerByte(raw[2])) {
    return /** @type {RGB} */ (raw);
  }
  throw new Error(`'${raw}' are not integers 0..255`);
}

const STORAGE_KEY = "themeRGB";

/**
 * Persists the current RGB theme to browser.storage.local.
 *
 * @param {RGB} state
 * @returns {Promise<void>}
 */
async function saveThemeRGB(state) {
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: state });
  } catch (e) {
    console.error("saveThemeRGB failed", e);
    throw e;
  }
}

/**
 * Loads the stored RGB theme or falls back on a default.
 *
 * @returns {Promise<RGB>}
 */
async function loadThemeRGB() {
  try {
    const res = await browser.storage.local.get(STORAGE_KEY);
    const stored = res[STORAGE_KEY];
    if (stored == null) return FALLBACK_COLOR;
    return parseRGB(stored);
  } catch (e) {
    console.error("loadThemeRGB failed, using fallback", e);
    return FALLBACK_COLOR;
  }
}

let lastAppliedID = /** @type {string|null} */ (null);

/**
 * Builds a theme from RGB and applies it if it’s new.
 *
 * @param {RGB} rgb
 * @returns {Promise<void>}
 */
async function buildAndApply(rgb) {
  const id = rgbToID(rgb);
  if (id === lastAppliedID) return;

  const theme = createFirefoxTheme(...rgb);

  try {
    browser.theme.update(theme);
  } catch (e) {
    console.error("browser.theme.update failed", e);
    throw e;
  }

  try {
    await saveThemeRGB(rgb);
  } catch (e) {
    console.warn("saving theme state failed, continuing", e);
  }

  lastAppliedID = id;
}

/**
 * Applies the last-saved or fallback theme.
 *
 * @returns {Promise<void>}
 */
async function applyFallback() {
  const rgb = await loadThemeRGB();
  try {
    await buildAndApply(rgb);
  } catch (e) {
    console.error("applyFallback failed", e);
  }
}

const native = new NativePort();

native.onMessage(async (raw) => {
  try {
    const msg = parseMessage(raw);
    if (msg.error) console.error("native reported error", msg.error);
    if (msg.rgb) {
      await buildAndApply(msg.rgb);
    }
  } catch (e) {
    console.error("failed to parse or apply native message", e);
  }
});

/**
 * Initializes native port and applies saved/fallback theme.
 *
 * @returns {Promise<void>}
 */
async function init() {
  try {
    native.start();
  } catch (e) {
    console.error("native.start failed", e);
  }
  await applyFallback();
}

if (
  typeof browser.runtime?.onSuspend === "object" &&
  browser.runtime.onSuspend
) {
  browser.runtime.onSuspend.addListener(() => native.stop());
}

if (typeof window !== "undefined") {
  window.addEventListener("unload", () => native.stop());
}

void init();
