/**
 * UUID v4を生成する
 * crypto.randomUUID()はセキュアコンテキスト（HTTPS/localhost）でのみ利用可能なため、
 * HTTP環境でも動作するフォールバックを提供する
 */
export function generateUUID(): string {
  // セキュアコンテキストでcrypto.randomUUIDが利用可能な場合はそれを使用
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // フォールバック: crypto.getRandomValuesを使用したUUID v4生成
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // UUID v4の形式に設定
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1

    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // 最終フォールバック: Math.randomを使用（非推奨だが動作保証）
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
