/**
 * 環境変数設定
 * Viteでは VITE_ プレフィックスの環境変数のみがクライアントに公開されます
 */

interface EnvConfig {
  // アプリケーション設定
  appTitle: string;
  appSubtitle: string;
  appVersion: string;

  // API設定
  apiUrl: string;
  weatherApiUrl: string;
  csvRendererApiUrl: string;

  // 開発用アカウント情報
  devAdmin: {
    email: string;
    password: string;
  };
  devUser: {
    email: string;
    password: string;
  };

  // 環境
  isDevelopment: boolean;
  isProduction: boolean;
}

export const env: EnvConfig = {
  // アプリケーション設定
  appTitle: import.meta.env.VITE_APP_TITLE || "TSUNAGARU",
  appSubtitle: import.meta.env.VITE_APP_SUBTITLE || "デジタルサイネージ管理システム",
  appVersion: import.meta.env.VITE_APP_VERSION || "0.0.1",

  // API設定
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:3001",
  weatherApiUrl: import.meta.env.VITE_WEATHER_API_URL || "https://jma-proxy.onrender.com",
  csvRendererApiUrl: import.meta.env.VITE_CSV_RENDERER_API_URL || "https://csv-renderer.onrender.com",

  // 開発用アカウント情報
  devAdmin: {
    email: import.meta.env.VITE_DEV_ADMIN_EMAIL || "admin@example.com",
    password: import.meta.env.VITE_DEV_ADMIN_PASSWORD || "admin123",
  },
  devUser: {
    email: import.meta.env.VITE_DEV_USER_EMAIL || "user@example.com",
    password: import.meta.env.VITE_DEV_USER_PASSWORD || "user123",
  },

  // 環境
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
