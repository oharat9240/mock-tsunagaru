import { atom } from "jotai";
import type { PlaylistIndex } from "~/types/playlist";

/**
 * プレイリスト一覧の状態管理
 */
export const playlistsAtom = atom<PlaylistIndex[]>([]);

/**
 * プレイリスト読み込み中の状態
 */
export const playlistsLoadingAtom = atom<boolean>(false);

/**
 * プレイリストエラー状態
 */
export const playlistsErrorAtom = atom<string | null>(null);

/**
 * プレイリスト操作のatom
 */
export const playlistActionsAtom = atom(
  null,
  (
    _get,
    set,
    action:
      | { type: "SET_PLAYLISTS"; playlists: PlaylistIndex[] }
      | { type: "SET_LOADING"; loading: boolean }
      | { type: "SET_ERROR"; error: string | null }
      | { type: "ADD_PLAYLIST"; playlist: PlaylistIndex }
      | { type: "UPDATE_PLAYLIST"; playlist: PlaylistIndex }
      | { type: "REMOVE_PLAYLIST"; id: string },
  ) => {
    switch (action.type) {
      case "SET_PLAYLISTS":
        set(playlistsAtom, action.playlists);
        break;
      case "SET_LOADING":
        set(playlistsLoadingAtom, action.loading);
        break;
      case "SET_ERROR":
        set(playlistsErrorAtom, action.error);
        break;
      case "ADD_PLAYLIST":
        set(playlistsAtom, (prev) => [...prev, action.playlist]);
        break;
      case "UPDATE_PLAYLIST":
        set(playlistsAtom, (prev) => prev.map((item) => (item.id === action.playlist.id ? action.playlist : item)));
        break;
      case "REMOVE_PLAYLIST":
        set(playlistsAtom, (prev) => prev.filter((item) => item.id !== action.id));
        break;
    }
  },
);
