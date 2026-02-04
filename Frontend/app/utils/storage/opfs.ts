/**
 * OPFS (Origin Private File System) utility functions
 * ファイル分割方式: A案
 * - /playlists/index.json - プレイリスト一覧のメタデータ
 * - /playlists/playlist-{id}.json - 個別のプレイリスト詳細データ
 */

// File System Access API の型定義を拡張
declare global {
  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
  }
}

import { logger } from "~/utils/logger";

export class OPFSError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "OPFSError";
  }
}

export class OPFSManager {
  private static instance: OPFSManager;
  private root: FileSystemDirectoryHandle | null = null;

  static getInstance(): OPFSManager {
    if (!OPFSManager.instance) {
      OPFSManager.instance = new OPFSManager();
    }
    return OPFSManager.instance;
  }

  private async getRoot(): Promise<FileSystemDirectoryHandle> {
    if (!this.root) {
      if (!("getDirectory" in navigator.storage)) {
        throw new OPFSError("OPFS is not supported in this browser");
      }
      try {
        this.root = await navigator.storage.getDirectory();
        logger.debug("OPFS", "Successfully initialized root directory");
      } catch (error) {
        logger.error("OPFS", "Failed to get root directory", error);
        throw new OPFSError("Failed to access OPFS root directory", error);
      }
    }
    return this.root;
  }

  async readJSON<T>(filePath: string): Promise<T | null> {
    try {
      logger.debug("OPFS", `Reading JSON from: ${filePath}`);
      const root = await this.getRoot();

      // Handle nested paths
      const pathParts = filePath.split("/");
      let currentHandle: FileSystemDirectoryHandle = root;

      // Navigate to the directory containing the file
      for (let i = 0; i < pathParts.length - 1; i++) {
        try {
          currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
        } catch (error) {
          if (error instanceof DOMException && error.name === "NotFoundError") {
            logger.debug("OPFS", `Directory not found: ${pathParts[i]}`);
            return null;
          }
          throw error;
        }
      }

      // Get the file
      const fileName = pathParts[pathParts.length - 1];
      const fileHandle = await currentHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = JSON.parse(text) as T;
      logger.debug("OPFS", `Successfully read JSON from: ${filePath}`);
      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        logger.debug("OPFS", `File not found: ${filePath}`);
        return null;
      }
      logger.error("OPFS", `Failed to read JSON from ${filePath}:`, error);
      throw new OPFSError(`Failed to read JSON from ${filePath}`, error);
    }
  }

  async writeJSON<T>(filePath: string, data: T): Promise<void> {
    try {
      logger.debug("OPFS", `Writing JSON to: ${filePath}`);
      const root = await this.getRoot();

      // Handle nested paths
      const pathParts = filePath.split("/");
      let currentHandle: FileSystemDirectoryHandle = root;

      // Ensure all directories in the path exist
      for (let i = 0; i < pathParts.length - 1; i++) {
        const dirName = pathParts[i];
        try {
          currentHandle = await currentHandle.getDirectoryHandle(dirName);
          logger.debug("OPFS", `Directory exists: ${dirName}`);
        } catch (error) {
          if (error instanceof DOMException && error.name === "NotFoundError") {
            currentHandle = await currentHandle.getDirectoryHandle(dirName, { create: true });
            logger.debug("OPFS", `Created directory: ${dirName}`);
          } else {
            throw error;
          }
        }
      }

      // Create/write the file
      const fileName = pathParts[pathParts.length - 1];
      const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();

      logger.debug("OPFS", `Successfully wrote JSON to: ${filePath}`);
    } catch (error) {
      logger.error("OPFS", `Failed to write JSON to ${filePath}:`, error);
      throw new OPFSError(`Failed to write JSON to ${filePath}`, error);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      logger.debug("OPFS", `Deleting file: ${filePath}`);
      const root = await this.getRoot();

      // Handle nested paths
      const pathParts = filePath.split("/");
      let currentHandle: FileSystemDirectoryHandle = root;

      // Navigate to the directory containing the file
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
      }

      // Delete the file
      const fileName = pathParts[pathParts.length - 1];
      await currentHandle.removeEntry(fileName);

      logger.debug("OPFS", `Successfully deleted file: ${filePath}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        logger.debug("OPFS", `File not found for deletion: ${filePath}`);
        return; // File doesn't exist, which is fine for deletion
      }
      logger.error("OPFS", `Failed to delete file ${filePath}:`, error);
      throw new OPFSError(`Failed to delete file ${filePath}`, error);
    }
  }

  async readFile(filePath: string): Promise<ArrayBuffer> {
    try {
      logger.debug("OPFS", `Reading file: ${filePath}`);
      const root = await this.getRoot();

      // Handle nested paths
      const pathParts = filePath.split("/");
      let currentHandle: FileSystemDirectoryHandle = root;

      // Navigate to the directory containing the file
      for (let i = 0; i < pathParts.length - 1; i++) {
        try {
          currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
        } catch (error) {
          if (error instanceof DOMException && error.name === "NotFoundError") {
            logger.debug("OPFS", `Directory not found: ${pathParts[i]}`);
            throw new OPFSError(`Directory not found: ${pathParts[i]}`, error);
          }
          throw error;
        }
      }

      // Get the file
      const fileName = pathParts[pathParts.length - 1];
      const fileHandle = await currentHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const arrayBuffer = await file.arrayBuffer();
      logger.debug("OPFS", `Successfully read file: ${filePath} (${arrayBuffer.byteLength} bytes)`);
      return arrayBuffer;
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        logger.debug("OPFS", `File not found: ${filePath}`);
        throw new OPFSError(`File not found: ${filePath}`, error);
      }
      logger.error("OPFS", `Failed to read file ${filePath}:`, error);
      throw new OPFSError(`Failed to read file ${filePath}`, error);
    }
  }

  async writeFile(filePath: string, data: ArrayBuffer): Promise<void> {
    try {
      logger.debug("OPFS", `Writing file: ${filePath} (${data.byteLength} bytes)`);
      const root = await this.getRoot();

      // Handle nested paths
      const pathParts = filePath.split("/");
      let currentHandle: FileSystemDirectoryHandle = root;

      // Ensure all directories in the path exist
      for (let i = 0; i < pathParts.length - 1; i++) {
        const dirName = pathParts[i];
        try {
          currentHandle = await currentHandle.getDirectoryHandle(dirName);
          logger.debug("OPFS", `Directory exists: ${dirName}`);
        } catch (error) {
          if (error instanceof DOMException && error.name === "NotFoundError") {
            currentHandle = await currentHandle.getDirectoryHandle(dirName, { create: true });
            logger.debug("OPFS", `Created directory: ${dirName}`);
          } else {
            throw error;
          }
        }
      }

      // Create/write the file
      const fileName = pathParts[pathParts.length - 1];
      const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();

      logger.debug("OPFS", `Successfully wrote file: ${filePath}`);
    } catch (error) {
      logger.error("OPFS", `Failed to write file to ${filePath}:`, error);
      throw new OPFSError(`Failed to write file to ${filePath}`, error);
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const root = await this.getRoot();

      // Handle nested paths
      const pathParts = filePath.split("/");
      let currentHandle: FileSystemDirectoryHandle = root;

      // Navigate to the directory containing the file
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
      }

      // Check if file exists
      const fileName = pathParts[pathParts.length - 1];
      await currentHandle.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ディレクトリの内容を一覧取得
   */
  async listDirectory(dirPath: string): Promise<string[]> {
    try {
      logger.debug("OPFS", `Listing directory: ${dirPath}`);
      const root = await this.getRoot();

      // Handle nested paths
      const pathParts = dirPath.split("/").filter((p) => p.length > 0);
      let currentHandle: FileSystemDirectoryHandle = root;

      // Navigate to the target directory
      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }

      // List entries
      const entries: string[] = [];
      for await (const [name] of currentHandle.entries()) {
        entries.push(name);
      }

      logger.debug("OPFS", `Found ${entries.length} entries in ${dirPath}`);
      return entries;
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        logger.debug("OPFS", `Directory not found: ${dirPath}`);
        return [];
      }
      logger.error("OPFS", `Failed to list directory ${dirPath}:`, error);
      throw new OPFSError(`Failed to list directory ${dirPath}`, error);
    }
  }

  /**
   * OPFS全体をクリア（すべてのファイルとディレクトリを削除）
   */
  async clearAll(): Promise<void> {
    try {
      logger.info("OPFS", "Clearing all data...");
      const root = await this.getRoot();

      // ルートディレクトリ内のすべてのエントリを取得
      const entries: string[] = [];
      for await (const [name] of root.entries()) {
        entries.push(name);
      }

      // すべてのエントリを削除
      for (const name of entries) {
        try {
          await root.removeEntry(name, { recursive: true });
          logger.debug("OPFS", `Deleted: ${name}`);
        } catch (error) {
          logger.warn("OPFS", `Failed to delete ${name}`, error);
          // 個別のエラーは警告として記録し、続行する
        }
      }

      logger.debug("OPFS", `Successfully cleared ${entries.length} entries`);
    } catch (error) {
      logger.error("OPFS", "Failed to clear all data:", error);
      throw new OPFSError("Failed to clear OPFS data", error);
    }
  }

  /**
   * OPFSの使用状況を取得（再帰的にサブディレクトリも含む）
   */
  async getStorageInfo(): Promise<{
    directories: string[];
    files: string[];
    estimatedSize?: number;
  }> {
    try {
      const root = await this.getRoot();
      const directories: string[] = [];
      const files: string[] = [];

      // 再帰的にすべてのファイルとディレクトリを収集
      await this.collectEntriesRecursively(root, "", directories, files);

      let estimatedSize: number | undefined;
      try {
        // StorageManager.estimate() でストレージ使用量を取得
        if ("estimate" in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          estimatedSize = estimate.usage;
        }
      } catch (error) {
        console.warn("Could not get storage estimate:", error);
      }

      return {
        directories,
        files,
        estimatedSize,
      };
    } catch (error) {
      logger.error("OPFS", "Failed to get storage info:", error);
      throw new OPFSError("Failed to get OPFS storage info", error);
    }
  }

  /**
   * 再帰的にディレクトリを探索してファイルとディレクトリを収集
   */
  private async collectEntriesRecursively(
    directoryHandle: FileSystemDirectoryHandle,
    currentPath: string,
    directories: string[],
    files: string[],
  ): Promise<void> {
    for await (const [name, handle] of directoryHandle.entries()) {
      const fullPath = currentPath ? `${currentPath}/${name}` : name;

      if (handle.kind === "directory") {
        directories.push(fullPath);
        // 再帰的にサブディレクトリを探索
        await this.collectEntriesRecursively(handle as FileSystemDirectoryHandle, fullPath, directories, files);
      } else {
        files.push(fullPath);
      }
    }
  }
}
