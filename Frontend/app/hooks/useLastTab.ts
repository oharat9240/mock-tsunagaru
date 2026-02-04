import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

const LAST_TAB_KEY = "lastAccessedTab";

// タブのパスとパスパターンのマッピング
const TAB_PATHS = {
  "/playlist": /^\/playlist/,
  "/schedule": /^\/schedule/,
  "/layout": /^\/layout/,
  "/contents": /^\/contents/,
};

export function useLastTab() {
  const location = useLocation();
  const navigate = useNavigate();

  // 現在のパスがタブのいずれかに該当するかチェック
  useEffect(() => {
    const currentPath = location.pathname;

    // タブのパスパターンにマッチするかチェック
    for (const [basePath, pattern] of Object.entries(TAB_PATHS)) {
      if (pattern.test(currentPath)) {
        // マッチしたらローカルストレージに保存
        localStorage.setItem(LAST_TAB_KEY, basePath);
        break;
      }
    }
  }, [location.pathname]);

  // 最後にアクセスしたタブにナビゲート
  const navigateToLastTab = useCallback(() => {
    const lastTab = localStorage.getItem(LAST_TAB_KEY);
    if (lastTab && lastTab !== "/") {
      navigate(lastTab);
    } else {
      // デフォルトはプレイリストタブ
      navigate("/playlist");
    }
  }, [navigate]);

  // 最後にアクセスしたタブのパスを取得
  const getLastTab = useCallback(() => {
    return localStorage.getItem(LAST_TAB_KEY) || "/playlist";
  }, []);

  return {
    navigateToLastTab,
    getLastTab,
  };
}
