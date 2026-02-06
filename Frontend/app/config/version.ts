import packageJson from "../../package.json";

// ビルド時の日時を環境変数から取得、なければ現在時刻を使用
const BUILD_DATE = import.meta.env.VITE_BUILD_DATE || new Date().toISOString();

// バージョン情報の設定
export const VERSION_INFO = {
  version: packageJson.version,
  buildDate: BUILD_DATE,
  environment: import.meta.env.MODE || "development",
} as const;

// ビルド時に環境変数から読み取れるようにする
export const getVersionInfo = () => {
  return {
    version: VERSION_INFO.version,
    buildDate: VERSION_INFO.buildDate,
    environment: VERSION_INFO.environment,
  };
};

// フォーマットされたバージョン文字列を取得
export const getFormattedVersion = () => {
  return `v${VERSION_INFO.version}`;
};

// フォーマットされたビルド日時を取得
export const getFormattedBuildDate = () => {
  const date = new Date(VERSION_INFO.buildDate);
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
