import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type ColorScheme = "light" | "dark" | "auto";

// SSR対応のcolorSchemeAtom
export const colorSchemeAtom = atomWithStorage<ColorScheme>("tsunagaru-color-scheme", "auto");

// デフォルトのヘッダー色
export const DEFAULT_HEADER_COLOR = "#0A529C";

// ヘッダー色のatom（localStorageに保存）
export const headerColorAtom = atomWithStorage("headerColor", DEFAULT_HEADER_COLOR);

// デフォルトにリセットするアクション
export const resetHeaderColorAtom = atom(null, (_get, set) => {
  set(headerColorAtom, DEFAULT_HEADER_COLOR);
});
