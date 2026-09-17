/**
 * Design tokens — typed access over the token tree.
 * Semantic token references ("brand.700") are resolved to hex values.
 */

import { tokens } from "./tokens.js";

export type ThemeName = "light" | "dark";

/** resolve a semantic token ref like "brand.700" → "#5D4037" */
export function resolveToken(ref: string): string {
  const [group, key] = ref.split(".");
  if (!group || !key) throw new Error(`invalid token ref: ${ref}`);
  const primitives = tokens.primitives as Record<string, Record<string, string>>;
  const value = primitives[group]?.[key];
  if (value === undefined) throw new Error(`unknown token ref: ${ref}`);
  return value;
}

function resolveDeep<T>(node: T): T {
  if (typeof node === "string" && /^[a-z]+\.[a-zA-Z0-9]+$/.test(node)) {
    return resolveToken(node) as T;
  }
  if (node !== null && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = resolveDeep(v);
    return out as T;
  }
  return node;
}

/** flatten a theme's semantic map to concrete hex values */
export function theme(themeName: ThemeName = "light") {
  return resolveDeep(tokens.themes[themeName]);
}

export const typography = tokens.typography;
export const spacing = tokens.spacing;
export const radius = tokens.radius;
export const elevation = tokens.elevation;
export const breakpoints = tokens.breakpoints;
export const primitives = tokens.primitives;

export { tokens };
export default tokens;
