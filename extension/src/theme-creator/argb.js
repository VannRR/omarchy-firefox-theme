/**
 * @license
 * Copyright 2006 The Android Open Source Project
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 *
 * Source: chromium/src/main/third_party/skia/include/core/SkColor.h
 *
 * Ported by VannRR <https://github.com/vannrr> 2025
 */

import { argbFromRgba } from "@material/material-color-utilities";

/**
 * RGBA channels as floats in the 0.0–1.0 range.
 *
 * @typedef {Object} RgbaFloat
 * @property {number} r Red channel (0.0–1.0)
 * @property {number} g Green channel (0.0–1.0)
 * @property {number} b Blue channel (0.0–1.0)
 * @property {number} a Alpha channel (0.0–1.0)
 */

/** @type {number} */
export const ALPHA_OPAQUE = 0xff >>> 0;

/** @type {number} */
export const ALPHA_TRANSPARENT = 0x00 >>> 0;

/** @type {number} */
export const ARGB_WHITE = argbFromRgba({
  r: 0xff,
  g: 0xff,
  b: 0xff,
  a: 0xff,
});

/** @type {number} */
export const ARGB_TRANSPARENT = argbFromRgba({
  r: 0x00,
  g: 0x00,
  b: 0x00,
  a: 0x00,
});

const INV_255 = 1 / 255;

/**
 * Validate byte inputs or throw in development; returns masked byte.
 *
 * @param {number} n    Value to clamp to 0..255
 * @param {string} [name="byte"]  Name for error messages
 * @returns {number}    Masked byte
 * @throws {TypeError} If n is not an integer in 0..255
 */
function toByte(n, name = "byte") {
  if (!(Number.isInteger(n) && n >= 0 && n <= 0xff)) {
    throw new TypeError(`${name} must be integer in 0..255, got ${n}`);
  }
  return n & 0xff;
}

/**
 * Replace the alpha byte of a packed ARGB color.
 *
 * @param {number} argb  Original packed ARGB (0xAARRGGBB)
 * @param {number} a     New alpha byte (0..255)
 * @returns {number}     New packed ARGB with replaced alpha
 * @throws {TypeError}   If a is not an integer in 0..255
 */
export function argbSetA(argb, a) {
  const A = toByte(a, "a");
  const packed = ((argb & 0x00ffffff) | ((A & 0xff) << 24)) >>> 0;
  return packed;
}

/**
 * Convert packed ARGB (0xAARRGGBB) into RGBA floats.
 *
 * @param {number} argb  Packed ARGB color
 * @returns {RgbaFloat}  Decomposed RGBA channels as floats
 */
export function argbToRgbaFloat(argb) {
  const a = ((argb >>> 24) & 0xff) * INV_255;
  const r = ((argb >>> 16) & 0xff) * INV_255;
  const g = ((argb >>> 8) & 0xff) * INV_255;
  const b = (argb & 0xff) * INV_255;
  return { r, g, b, a };
}
