/**
 * @license
 * Copyright 2012 The Chromium Authors
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 *
 * Source: chromium/src/main/ui/gfx/color_utils.cc
 *
 * Ported by VannRR <https://github.com/vannrr> 2025
 */

import {
  alphaFromArgb,
  argbFromRgb,
  argbFromRgba,
  blueFromArgb,
  greenFromArgb,
  redFromArgb,
} from "@material/material-color-utilities";
import {
  ALPHA_OPAQUE,
  ALPHA_TRANSPARENT,
  ARGB_TRANSPARENT,
  ARGB_WHITE,
  argbSetA,
  argbToRgbaFloat,
} from "./argb";

/**
 * @typedef {Object} HSL
 * @property {number} h  Hue channel, 0.0–1.0
 * @property {number} s  Saturation channel, 0.0–1.0
 * @property {number} l  Lightness channel, 0.0–1.0
 */

/**
 * @typedef {Object} BlendResult
 * @property {number} alpha  Alpha as 0.0–1.0
 * @property {number} color  Packed ARGB result
 */

/** Darkest reference color */
const G_DARKEST_COLOR = argbFromRgb(0x20, 0x21, 0x24);

/** Luminance midpoint for deciding light/dark */
const G_LUMINANCE_MIDPOINT = 0.211692036;

/**
 * Round to nearest 0..255 integer and clamp.
 *
 * @param {number} n
 * @returns {number}
 */
function clampRoundU8(n) {
  n = Math.round(n);
  if (n > 0xff) return 0xff;
  if (n < 0x00) return 0x00;
  return n;
}

/**
 * sRGB linearization (assumes component in 0..1).
 *
 * @param {number} component
 * @returns {number}
 */
function linearize(component) {
  return component <= 0.04045
    ? component / 12.92
    : Math.pow((component + 0.055) / 1.055, 2.4);
}

/**
 * Computes one RGB channel from hue cycle.
 *
 * @param {number} temp1
 * @param {number} temp2
 * @param {number} hue  Hue value in 0..1 (may wrap)
 * @returns {number}    0..255 byte
 */
function calcHue(temp1, temp2, hue) {
  if (hue < 0.0) hue += 1.0;
  else if (hue > 1.0) hue -= 1.0;

  let result = temp1;
  if (hue * 6.0 < 1.0) {
    result = temp1 + (temp2 - temp1) * hue * 6.0;
  } else if (hue * 2.0 < 1.0) {
    result = temp2;
  } else if (hue * 3.0 < 2.0) {
    result = temp1 + (temp2 - temp1) * (2.0 / 3.0 - hue) * 6.0;
  }

  return clampRoundU8(result * 255);
}

/**
 * Converts packed ARGB to HSL.
 *
 * @param {number} c  Packed ARGB
 * @returns {HSL}
 */
export function argbToHSL(c) {
  const r = redFromArgb(c) / 255.0;
  const g = greenFromArgb(c) / 255.0;
  const b = blueFromArgb(c) / 255.0;

  const vmin = Math.min(r, g, b);
  const vmax = Math.max(r, g, b);
  const delta = vmax - vmin;

  const l = (vmin + vmax) / 2.0;
  let h = 0;
  let s = 0;

  if (delta !== 0) {
    const dr = ((vmax - r) / 6.0 + delta / 2.0) / delta;
    const dg = ((vmax - g) / 6.0 + delta / 2.0) / delta;
    const db = ((vmax - b) / 6.0 + delta / 2.0) / delta;

    if (r >= g && r >= b) {
      h = db - dg;
    } else if (g >= r && g >= b) {
      h = 1.0 / 3.0 + dr - db;
    } else {
      h = 2.0 / 3.0 + dg - dr;
    }

    if (h < 0.0) h += 1.0;
    else if (h > 1.0) h -= 1.0;

    s = delta / (l < 0.5 ? vmax + vmin : 2.0 - vmax - vmin);
  }

  return { h, s, l };
}

/**
 * Converts HSL plus alpha to packed ARGB.
 *
 * @param {HSL} hsl
 * @param {number} alpha  Alpha byte 0..255
 * @returns {number}      Packed ARGB
 */
export function hSLToArgb(hsl, alpha) {
  const hue = hsl.h;
  const saturation = hsl.s;
  const lightness = hsl.l;

  if (!saturation) {
    const light = clampRoundU8(lightness * 255);
    return argbFromRgba({ r: light, g: light, b: light, a: alpha });
  }

  const temp2 =
    lightness < 0.5
      ? lightness * (1.0 + saturation)
      : lightness + saturation - lightness * saturation;
  const temp1 = 2.0 * lightness - temp2;

  return argbFromRgba({
    r: calcHue(temp1, temp2, hue + 1.0 / 3.0),
    g: calcHue(temp1, temp2, hue),
    b: calcHue(temp1, temp2, hue - 1.0 / 3.0),
    a: alpha,
  });
}

/**
 * Computes relative luminance of an ARGB color.
 *
 * @param {number} argb
 * @returns {number}  Luminance
 */
export function getRelativeLuminance(argb) {
  const rgba = argbToRgbaFloat(argb);
  return (
    0.2126 * linearize(rgba.r) +
    0.7152 * linearize(rgba.g) +
    0.0722 * linearize(rgba.b)
  );
}

/**
 * Returns true if color is darker than midpoint.
 *
 * @param {number} argb
 * @returns {boolean}
 */
export function isDark(argb) {
  return getRelativeLuminance(argb) < G_LUMINANCE_MIDPOINT;
}

/**
 * Chooses white or dark reference for max contrast.
 *
 * @param {number} argb
 * @returns {number}
 */
export function getColorWithMaxContrast(argb) {
  return isDark(argb) ? ARGB_WHITE : G_DARKEST_COLOR;
}

/**
 * Contrast ratio between two ARGB values.
 *
 * @param {number} colorA
 * @param {number} colorB
 * @returns {number}
 */
export function getContrastRatioArgb(colorA, colorB) {
  return getContrastRatioFloat(
    getRelativeLuminance(colorA),
    getRelativeLuminance(colorB),
  );
}

/**
 * Contrast ratio from two luminance values.
 *
 * @param {number} luminanceA
 * @param {number} luminanceB
 * @returns {number}
 */
export function getContrastRatioFloat(luminanceA, luminanceB) {
  if (luminanceA < 0.0) throw new Error("luminanceA is less than 0");
  if (luminanceB < 0.0) throw new Error("luminanceB is less than 0");
  const a = luminanceA + 0.05;
  const b = luminanceB + 0.05;
  return a > b ? a / b : b / a;
}

/**
 * Alpha blend in 0..255 domain.
 *
 * @param {number} foreground
 * @param {number} background
 * @param {number} alpha  Byte-scaled alpha
 * @returns {number}
 */
function alphaBlendSkAlpha(foreground, background, alpha) {
  return alphaBlendFloat(foreground, background, alpha / 255.0);
}

/**
 * Alpha blend with float alpha multiplier.
 *
 * @param {number} foreground
 * @param {number} background
 * @param {number} alpha       0.0–1.0 multiplier
 * @returns {number}           Packed ARGB
 */
function alphaBlendFloat(foreground, background, alpha) {
  if (alpha <= 0.0) return background;
  if (alpha >= 1.0) return foreground;

  const fA = alphaFromArgb(foreground);
  const bA = alphaFromArgb(background);

  const normalizer = fA * alpha + bA * (1.0 - alpha);
  if (normalizer === 0.0) return ARGB_TRANSPARENT;

  const f_weight = (fA * alpha) / normalizer;
  const b_weight = (bA * (1.0 - alpha)) / normalizer;

  const r =
    redFromArgb(foreground) * f_weight + redFromArgb(background) * b_weight;
  const g =
    greenFromArgb(foreground) * f_weight + greenFromArgb(background) * b_weight;
  const b =
    blueFromArgb(foreground) * f_weight + blueFromArgb(background) * b_weight;

  return argbFromRgba({
    r: clampRoundU8(r),
    g: clampRoundU8(g),
    b: clampRoundU8(b),
    a: clampRoundU8(normalizer),
  });
}

/**
 * Treats foreground as fully opaque, then alpha-blends over background.
 *
 * @param {number} foreground
 * @param {number} background
 * @returns {number}
 */
function getResultingPaintColor(foreground, background) {
  return alphaBlendSkAlpha(
    argbSetA(foreground, ALPHA_OPAQUE),
    background,
    alphaFromArgb(foreground),
  );
}

/**
 * Finds minimal extra alpha and resulting color to meet contrast.
 *
 * @param {number} default_foreground  Packed ARGB
 * @param {number} background          Packed ARGB (must be opaque)
 * @param {number|null} high_contrast_foreground
 *   Optional override ARGB for better contrast
 * @param {number} contrast_ratio     Target WCAG-like ratio
 * @returns {BlendResult}
 */
export function blendForMinContrast(
  default_foreground,
  background,
  high_contrast_foreground,
  contrast_ratio,
) {
  if (alphaFromArgb(background) !== ALPHA_OPAQUE) {
    throw new Error("background is not opaque");
  }

  default_foreground = getResultingPaintColor(default_foreground, background);

  if (getContrastRatioArgb(default_foreground, background) >= contrast_ratio) {
    return { alpha: ALPHA_TRANSPARENT, color: default_foreground };
  }

  const target_foreground = getResultingPaintColor(
    high_contrast_foreground !== null
      ? high_contrast_foreground
      : getColorWithMaxContrast(background),
    background,
  );

  const background_luminance = getRelativeLuminance(background);

  let best_alpha = ALPHA_OPAQUE;
  let best_color = target_foreground;

  let low = ALPHA_TRANSPARENT;
  let high = ALPHA_OPAQUE + 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const color = alphaBlendSkAlpha(target_foreground, default_foreground, mid);
    const luminance = getRelativeLuminance(color);
    const contrast = getContrastRatioFloat(luminance, background_luminance);

    if (contrast >= contrast_ratio) {
      best_alpha = mid;
      best_color = color;
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return { alpha: best_alpha, color: best_color };
}
