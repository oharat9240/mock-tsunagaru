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
  hlsBaseUrl: string;
  rtmpUrl: string;

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

/**
 * 動的にAPI URLを取得
 * VITE_API_URLが空の場合、現在のホスト名を使用してBackendポート(3001)に接続
 */
function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl;
  }
  // ブラウザ環境でのみ動的にホスト名を取得
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:3001`;
  }
  return "http://localhost:3001";
}

/**
 * 動的にHLS Base URLを取得
 */
function getHlsBaseUrl(): string {
  const envUrl = import.meta.env.VITE_HLS_BASE_URL;
  if (envUrl) {
    return envUrl;
  }
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8080/hls`;
  }
  return "http://localhost:8080/hls";
}

/**
 * 動的にRTMP URLを取得
 */
function getRtmpUrl(): string {
  const envUrl = import.meta.env.VITE_RTMP_URL;
  if (envUrl) {
    return envUrl;
  }
  if (typeof window !== "undefined") {
    return `rtmp://${window.location.hostname}:1935/live`;
  }
  return "rtmp://localhost:1935/live";
}

export const env: EnvConfig = {
  // アプリケーション設定
  appTitle: import.meta.env.VITE_APP_TITLE || "TSUNAGARU",
  appSubtitle: import.meta.env.VITE_APP_SUBTITLE || "デジタルサイネージ管理システム",
  appVersion: import.meta.env.VITE_APP_VERSION || "0.0.1",

  // API設定（動的に取得）
  apiUrl: getApiUrl(),
  weatherApiUrl: import.meta.env.VITE_WEATHER_API_URL || "https://jma-proxy.onrender.com",
  csvRendererApiUrl: import.meta.env.VITE_CSV_RENDERER_API_URL || "https://csv-renderer.onrender.com",
  hlsBaseUrl: getHlsBaseUrl(),
  rtmpUrl: getRtmpUrl(),

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
