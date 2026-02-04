/**
 * URLのiframe埋め込み可能性をチェックするユーティリティ
 */

// iframe埋め込みを拒否することが知られている主要なドメイン
const IFRAME_BLOCKED_DOMAINS = [
  // ソーシャルメディア
  "facebook.com",
  "www.facebook.com",
  "twitter.com",
  "www.twitter.com",
  "x.com",
  "www.x.com",
  "instagram.com",
  "www.instagram.com",
  "linkedin.com",
  "www.linkedin.com",

  // ニュースサイト
  "nytimes.com",
  "www.nytimes.com",
  "wsj.com",
  "www.wsj.com",
  "bloomberg.com",
  "www.bloomberg.com",

  // Eコマース
  "amazon.com",
  "www.amazon.com",
  "amazon.co.jp",
  "www.amazon.co.jp",

  // 金融サービス
  "paypal.com",
  "www.paypal.com",

  // その他
  "github.com",
  "www.github.com",
];

// iframe埋め込みが許可されているドメイン（明示的に許可）
const IFRAME_ALLOWED_DOMAINS = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "wikipedia.org",
  "en.wikipedia.org",
  "ja.wikipedia.org",
  "openstreetmap.org",
  "www.openstreetmap.org",
];

/**
 * URLがiframeに埋め込み可能かどうかをチェック
 */
export const checkIframeEmbeddability = async (
  url: string,
): Promise<{
  embeddable: boolean;
  reason?: string;
}> => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // HTTPSでないURLは埋め込み不可とする（セキュリティのため）
    if (urlObj.protocol !== "https:") {
      return {
        embeddable: false,
        reason: "HTTPSプロトコルが必要です",
      };
    }

    // ブロックリストに含まれているドメインをチェック
    if (IFRAME_BLOCKED_DOMAINS.includes(hostname)) {
      return {
        embeddable: false,
        reason: "このサイトはiframe埋め込みを許可していません",
      };
    }

    // 許可リストに含まれているドメインは即座に許可
    if (IFRAME_ALLOWED_DOMAINS.includes(hostname)) {
      return { embeddable: true };
    }

    // サーバーサイドでのチェックが必要な場合は、ここでAPIを呼び出す
    // 現時点では、上記のリスト以外は許可する（実際の実装では要検討）
    return { embeddable: true };
  } catch (_error) {
    return {
      embeddable: false,
      reason: "無効なURLです",
    };
  }
};

/**
 * iframe用のsandbox属性を生成
 * セキュリティを最大限に保ちつつ、必要最小限の権限のみを付与
 */
export const getIframeSandboxAttributes = (): string => {
  return [
    "allow-scripts", // スクリプトの実行を許可（多くのサイトで必要）
    "allow-same-origin", // 同一オリジンのリソースへのアクセスを許可
    "allow-popups", // ポップアップを許可（一部のサイトで必要）
    "allow-popups-to-escape-sandbox", // ポップアップがサンドボックスを回避することを許可
    "allow-forms", // フォームの送信を許可
  ].join(" ");
};

/**
 * URLを正規化（httpsに変換、末尾のスラッシュを削除など）
 */
export const normalizeUrl = (url: string): string => {
  try {
    // URLが有効かチェック
    const urlObj = new URL(url);

    // HTTPをHTTPSに変換
    if (urlObj.protocol === "http:") {
      urlObj.protocol = "https:";
    }

    // 末尾のスラッシュを削除（パスが'/'のみの場合を除く）
    if (urlObj.pathname !== "/" && urlObj.pathname.endsWith("/")) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }

    return urlObj.toString();
  } catch {
    // 無効なURLの場合はそのまま返す
    return url;
  }
};
