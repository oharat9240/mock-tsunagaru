import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { userAtom } from "~/states/user";

/**
 * 認証状態を管理するhook
 * 初期化が完了するまでisInitializedがfalseになる
 */
export const useAuth = () => {
  const [user, setUser] = useAtom(userAtom);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // atomWithStorageの初期化を検知
    // userAtomの値が読み込まれたら初期化完了とする
    setIsInitialized(true);
  }, []);

  return {
    user,
    setUser,
    isInitialized,
    isAuthenticated: user !== null,
  };
};
