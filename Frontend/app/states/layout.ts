import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { LayoutIndex } from "~/types/layout";

/**
 * レイアウト一覧の状態管理
 */
export const layoutsAtom = atom<LayoutIndex[]>([]);

/**
 * レイアウト読み込み中の状態
 */
export const layoutsLoadingAtom = atom<boolean>(false);

/**
 * レイアウトエラー状態
 */
export const layoutsErrorAtom = atom<string | null>(null);

/**
 * ビュー表示モード（テーブル or グリッド）
 */
export const layoutViewModeAtom = atomWithStorage<"table" | "grid">("layoutViewMode", "table");

/**
 * レイアウト操作のatom
 */
export const layoutActionsAtom = atom(
  null,
  (
    _get,
    set,
    action:
      | { type: "SET_LAYOUTS"; layouts: LayoutIndex[] }
      | { type: "SET_LOADING"; loading: boolean }
      | { type: "SET_ERROR"; error: string | null }
      | { type: "ADD_LAYOUT"; layout: LayoutIndex }
      | { type: "UPDATE_LAYOUT"; layout: LayoutIndex }
      | { type: "REMOVE_LAYOUT"; id: string },
  ) => {
    switch (action.type) {
      case "SET_LAYOUTS":
        set(layoutsAtom, action.layouts);
        break;
      case "SET_LOADING":
        set(layoutsLoadingAtom, action.loading);
        break;
      case "SET_ERROR":
        set(layoutsErrorAtom, action.error);
        break;
      case "ADD_LAYOUT":
        set(layoutsAtom, (prev) => [...prev, action.layout]);
        break;
      case "UPDATE_LAYOUT":
        set(layoutsAtom, (prev) => prev.map((item) => (item.id === action.layout.id ? action.layout : item)));
        break;
      case "REMOVE_LAYOUT":
        set(layoutsAtom, (prev) => prev.filter((item) => item.id !== action.id));
        break;
    }
  },
);
