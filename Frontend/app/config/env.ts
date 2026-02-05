/**
 * 環境変数設定
 */

// ブラウザのホスト名を取得
function getHost(): string {
  if (typeof window !== "undefined") {
    return window.location.hostname;
  }
  return "localhost";
}

export const env = {
  appTitle: import.meta.env.VITE_APP_TITLE || "TSUNAGARU",
  appSubtitle: import.meta.env.VITE_APP_SUBTITLE || "デジタルサイネージ管理システム",
  appVersion: import.meta.env.VITE_APP_VERSION || "0.0.1",

  // API設定（getterで動的に取得）
  get apiUrl() {
    return import.meta.env.VITE_API_URL || `http://${getHost()}:3001`;
  },
  get hlsBaseUrl() {
    return import.meta.env.VITE_HLS_BASE_URL || `http://${getHost()}:8080/hls`;
  },
  get rtmpUrl() {
    return import.meta.env.VITE_RTMP_URL || `rtmp://${getHost()}:1935/live`;
  },

  weatherApiUrl: import.meta.env.VITE_WEATHER_API_URL || "https://jma-proxy.onrender.com",
  csvRendererApiUrl: import.meta.env.VITE_CSV_RENDERER_API_URL || "https://csv-renderer.onrender.com",

  devAdmin: {
    email: import.meta.env.VITE_DEV_ADMIN_EMAIL || "admin@example.com",
    password: import.meta.env.VITE_DEV_ADMIN_PASSWORD || "admin123",
  },
  devUser: {
    email: import.meta.env.VITE_DEV_USER_EMAIL || "user@example.com",
    password: import.meta.env.VITE_DEV_USER_PASSWORD || "user123",
  },

  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
