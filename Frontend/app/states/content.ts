import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { ContentIndex, ContentType } from "~/types/content";

// コンテンツ一覧の状態
export const contentsAtom = atom<ContentIndex[]>([]);

// コンテンツのローディング状態
export const contentsLoadingAtom = atom<boolean>(false);

// コンテンツのエラー状態
export const contentsErrorAtom = atom<string | null>(null);

// 選択されたコンテンツタイプフィルター
export const contentTypeFilterAtom = atomWithStorage<ContentType | "all" | "unused">("contentTypeFilter", "all");

// 検索クエリ
export const contentSearchQueryAtom = atom<string>("");

// 未使用コンテンツのIDを追跡する状態
export const unusedContentIdsAtom = atom<Set<string>>(new Set<string>());

// フィルター済みコンテンツの取得（派生状態）
export const filteredContentsAtom = atom((get) => {
  const contents = get(contentsAtom);
  const typeFilter = get(contentTypeFilterAtom);
  const searchQuery = get(contentSearchQueryAtom);
  const unusedContentIds = get(unusedContentIdsAtom);

  let filtered = contents;

  // タイプフィルター
  if (typeFilter === "unused") {
    // 未使用フィルター
    filtered = filtered.filter((content) => unusedContentIds.has(content.id));
  } else if (typeFilter !== "all") {
    // 通常のタイプフィルター
    filtered = filtered.filter((content) => content.type === typeFilter);
  }

  // 検索フィルター
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (content) =>
        content.name.toLowerCase().includes(query) ||
        content.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        content.url?.toLowerCase().includes(query),
    );
  }

  return filtered;
});

// コンテンツアクションの型定義
export type ContentAction =
  | { type: "SET_CONTENTS"; contents: ContentIndex[] }
  | { type: "ADD_CONTENT"; content: ContentIndex }
  | { type: "UPDATE_CONTENT"; id: string; content: Partial<ContentIndex> }
  | { type: "REMOVE_CONTENT"; id: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_UNUSED_CONTENT_IDS"; unusedIds: Set<string> };

// コンテンツアクションの処理
export const contentActionsAtom = atom(null, (_get, set, action: ContentAction) => {
  switch (action.type) {
    case "SET_CONTENTS":
      set(contentsAtom, action.contents);
      break;
    case "ADD_CONTENT":
      set(contentsAtom, (prev) => [...prev, action.content]);
      break;
    case "UPDATE_CONTENT":
      set(contentsAtom, (prev) =>
        prev.map((content) => (content.id === action.id ? { ...content, ...action.content } : content)),
      );
      break;
    case "REMOVE_CONTENT":
      set(contentsAtom, (prev) => prev.filter((content) => content.id !== action.id));
      break;
    case "SET_LOADING":
      set(contentsLoadingAtom, action.loading);
      break;
    case "SET_ERROR":
      set(contentsErrorAtom, action.error);
      break;
    case "SET_UNUSED_CONTENT_IDS":
      set(unusedContentIdsAtom, action.unusedIds);
      break;
  }
});

// ファイルアップロード用のモーダル状態
export const fileUploadModalAtom = atom<boolean>(false);

// URLコンテンツ追加用のモーダル状態
export const urlContentModalAtom = atom<boolean>(false);

// 統合コンテンツ追加モーダル状態
export const contentAddModalAtom = atom<boolean>(false);

// コンテンツ編集モーダル状態
export const contentEditModalAtom = atom<{ opened: boolean; content: ContentIndex | null }>({
  opened: false,
  content: null,
});

// ビュー表示モード（テーブル or グリッド）
export const contentViewModeAtom = atomWithStorage<"table" | "grid">("contentViewMode", "table");

// モーダル操作の型定義
export type ModalAction =
  | { type: "OPEN_FILE_UPLOAD" }
  | { type: "CLOSE_FILE_UPLOAD" }
  | { type: "OPEN_URL_CONTENT" }
  | { type: "CLOSE_URL_CONTENT" }
  | { type: "OPEN_CONTENT_EDIT"; content: ContentIndex }
  | { type: "CLOSE_CONTENT_EDIT" }
  | { type: "OPEN_CONTENT_ADD" }
  | { type: "CLOSE_CONTENT_ADD" };

// モーダルアクション処理（既存のmodalActionsAtomに追加）
export const contentModalActionsAtom = atom(null, (_get, set, action: ModalAction) => {
  switch (action.type) {
    case "OPEN_FILE_UPLOAD":
      set(fileUploadModalAtom, true);
      break;
    case "CLOSE_FILE_UPLOAD":
      set(fileUploadModalAtom, false);
      break;
    case "OPEN_URL_CONTENT":
      set(urlContentModalAtom, true);
      break;
    case "CLOSE_URL_CONTENT":
      set(urlContentModalAtom, false);
      break;
    case "OPEN_CONTENT_ADD":
      set(contentAddModalAtom, true);
      break;
    case "CLOSE_CONTENT_ADD":
      set(contentAddModalAtom, false);
      break;
    case "OPEN_CONTENT_EDIT":
      set(contentEditModalAtom, { opened: true, content: action.content });
      break;
    case "CLOSE_CONTENT_EDIT":
      set(contentEditModalAtom, { opened: false, content: null });
      break;
  }
});
