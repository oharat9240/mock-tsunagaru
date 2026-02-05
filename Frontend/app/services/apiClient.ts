import { env } from "~/config/env";

const API_BASE_URL = env.apiUrl;

export interface FileUploadResult {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  thumbnailPath?: string;
}

export interface ThumbnailUploadResult {
  id: string;
  path: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * ファイルをアップロード
   */
  async uploadFile(file: File): Promise<FileUploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseUrl}/api/files/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "ファイルのアップロードに失敗しました");
    }

    return response.json();
  }

  /**
   * サムネイルをBase64形式でアップロード
   */
  async uploadThumbnailBase64(id: string, data: ArrayBuffer, mimeType: string): Promise<ThumbnailUploadResult> {
    const base64 = this.arrayBufferToBase64(data);

    const response = await fetch(`${this.baseUrl}/api/files/thumbnail-base64/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: base64, mimeType }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "サムネイルのアップロードに失敗しました");
    }

    return response.json();
  }

  /**
   * ファイルを削除
   */
  async deleteFile(filename: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/files/${filename}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "ファイルの削除に失敗しました");
    }
  }

  /**
   * サムネイルを削除
   */
  async deleteThumbnail(filename: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/thumbnails/${filename}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "サムネイルの削除に失敗しました");
    }
  }

  /**
   * ファイルのURLを取得
   */
  getFileUrl(path: string): string {
    if (path.startsWith("http")) {
      return path;
    }
    return `${this.baseUrl}${path}`;
  }

  /**
   * コンテンツIDからダウンロードURLを取得
   */
  getContentDownloadUrl(contentId: string): string {
    return `${this.baseUrl}/api/download/content/${contentId}`;
  }

  /**
   * ファイル名からダウンロードURLを取得
   */
  getFileDownloadUrl(filename: string, originalName?: string): string {
    const url = `${this.baseUrl}/api/download/file/${filename}`;
    if (originalName) {
      return `${url}?name=${encodeURIComponent(originalName)}`;
    }
    return url;
  }

  /**
   * コンテンツのファイルをダウンロード
   */
  async downloadContentFile(contentId: string): Promise<void> {
    const url = this.getContentDownloadUrl(contentId);
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * ファイルを直接ダウンロード
   */
  async downloadFile(filename: string, originalName?: string): Promise<void> {
    const url = this.getFileDownloadUrl(filename, originalName);
    const link = document.createElement("a");
    link.href = url;
    link.download = originalName || filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ========================================
  // コンテンツAPI
  // ========================================

  async getContentsIndex<T>(): Promise<T[]> {
    const response = await fetch(`${this.baseUrl}/api/contents`);
    if (!response.ok) {
      throw new Error("コンテンツ一覧の取得に失敗しました");
    }
    return response.json();
  }

  async saveContentsIndex<T>(data: T[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/contents`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("コンテンツ一覧の保存に失敗しました");
    }
  }

  async getContent<T>(id: string): Promise<T | null> {
    const response = await fetch(`${this.baseUrl}/api/contents/${id}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error("コンテンツの取得に失敗しました");
    }
    return response.json();
  }

  async saveContent<T>(id: string, data: T): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/contents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("コンテンツの保存に失敗しました");
    }
  }

  async deleteContent(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/contents/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("コンテンツの削除に失敗しました");
    }
  }

  // ========================================
  // プレイリストAPI
  // ========================================

  async getPlaylistsIndex<T>(): Promise<T[]> {
    const response = await fetch(`${this.baseUrl}/api/playlists`);
    if (!response.ok) {
      throw new Error("プレイリスト一覧の取得に失敗しました");
    }
    return response.json();
  }

  async savePlaylistsIndex<T>(data: T[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/playlists`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("プレイリスト一覧の保存に失敗しました");
    }
  }

  async getPlaylist<T>(id: string): Promise<T | null> {
    const response = await fetch(`${this.baseUrl}/api/playlists/${id}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error("プレイリストの取得に失敗しました");
    }
    return response.json();
  }

  async savePlaylist<T>(id: string, data: T): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/playlists/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("プレイリストの保存に失敗しました");
    }
  }

  async deletePlaylist(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/playlists/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("プレイリストの削除に失敗しました");
    }
  }

  // ========================================
  // レイアウトAPI
  // ========================================

  async getLayoutsIndex<T>(): Promise<T[]> {
    const response = await fetch(`${this.baseUrl}/api/layouts`);
    if (!response.ok) {
      throw new Error("レイアウト一覧の取得に失敗しました");
    }
    return response.json();
  }

  async saveLayoutsIndex<T>(data: T[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/layouts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("レイアウト一覧の保存に失敗しました");
    }
  }

  async getLayout<T>(id: string): Promise<T | null> {
    const response = await fetch(`${this.baseUrl}/api/layouts/${id}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error("レイアウトの取得に失敗しました");
    }
    return response.json();
  }

  async saveLayout<T>(id: string, data: T): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/layouts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("レイアウトの保存に失敗しました");
    }
  }

  async deleteLayout(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/layouts/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("レイアウトの削除に失敗しました");
    }
  }

  // ========================================
  // スケジュールAPI
  // ========================================

  async getSchedulesIndex<T>(): Promise<T[]> {
    const response = await fetch(`${this.baseUrl}/api/schedules`);
    if (!response.ok) {
      throw new Error("スケジュール一覧の取得に失敗しました");
    }
    return response.json();
  }

  async saveSchedulesIndex<T>(data: T[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/schedules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("スケジュール一覧の保存に失敗しました");
    }
  }

  async getSchedule<T>(id: string): Promise<T | null> {
    const response = await fetch(`${this.baseUrl}/api/schedules/${id}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error("スケジュールの取得に失敗しました");
    }
    return response.json();
  }

  async saveSchedule<T>(id: string, data: T): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/schedules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("スケジュールの保存に失敗しました");
    }
  }

  async deleteSchedule(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/schedules/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("スケジュールの削除に失敗しました");
    }
  }

  // ========================================
  // CSV関連API
  // ========================================

  async uploadCsvFile(contentId: string, file: File, type: "original" | "background" | "rendered"): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseUrl}/api/csv/${contentId}/upload?type=${type}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "CSVファイルのアップロードに失敗しました");
    }

    const result = await response.json();
    return result.path;
  }

  async uploadCsvRenderedBase64(contentId: string, data: ArrayBuffer, format: "png" | "jpeg"): Promise<string> {
    const base64 = this.arrayBufferToBase64(data);

    const response = await fetch(`${this.baseUrl}/api/csv/${contentId}/rendered-base64`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: base64, format }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "CSVレンダリング画像のアップロードに失敗しました");
    }

    const result = await response.json();
    return result.path;
  }

  async deleteCsvFiles(contentId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/csv/${contentId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "CSVファイルの削除に失敗しました");
    }
  }

  // ========================================
  // ストリームAPI（ライブ配信）
  // ========================================

  async getStreams<T>(): Promise<T[]> {
    const response = await fetch(`${this.baseUrl}/api/streams`);
    if (!response.ok) {
      throw new Error("ストリーム一覧の取得に失敗しました");
    }
    return response.json();
  }

  async createStream<T>(data: { name: string; description?: string }): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api/streams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "ストリームの作成に失敗しました");
    }
    return response.json();
  }

  async getStream<T>(id: string): Promise<T | null> {
    const response = await fetch(`${this.baseUrl}/api/streams/${id}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error("ストリームの取得に失敗しました");
    }
    return response.json();
  }

  async regenerateStreamKey<T>(id: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api/streams/${id}/regenerate-key`, {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "ストリームキーの再生成に失敗しました");
    }
    return response.json();
  }

  async deleteStream(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/streams/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("ストリームの削除に失敗しました");
    }
  }

  async getStreamStatus<T>(id: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api/streams/${id}/status`);
    if (!response.ok) {
      throw new Error("ストリーム状態の取得に失敗しました");
    }
    return response.json();
  }

  // ========================================
  // ユーティリティ
  // ========================================

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

export const apiClient = new ApiClient();
