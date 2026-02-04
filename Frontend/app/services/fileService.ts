import { OPFSManager } from "~/utils/storage/opfs";

class FileService {
  private opfs = OPFSManager.getInstance();

  /**
   * ファイルをOPFSに保存
   */
  async saveFile(file: File): Promise<string> {
    const id = crypto.randomUUID();
    const extension = file.name.split(".").pop() || "";
    const fileName = `contents/${id}.${extension}`;

    await this.opfs.writeFile(fileName, await file.arrayBuffer());

    return fileName;
  }

  /**
   * ファイルを削除
   */
  async deleteFile(path: string): Promise<void> {
    await this.opfs.deleteFile(path);
  }

  /**
   * ファイルを読み込み
   */
  async readFile(path: string): Promise<ArrayBuffer> {
    return await this.opfs.readFile(path);
  }
}

export const fileService = new FileService();
