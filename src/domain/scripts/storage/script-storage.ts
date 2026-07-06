import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../../config.js";

export class ScriptStorage {
  async write(arquivo: string, conteudo: string): Promise<void> {
    await this.ensureDir();
    const filePath = path.join(config.scriptsDir, arquivo);
    const conteudoNormalizado = conteudo
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    await fs.writeFile(filePath, conteudoNormalizado, "utf-8");
    if (process.platform !== "win32") {
      await fs.chmod(filePath, 0o755);
    }
  }

  async remove(arquivo: string): Promise<void> {
    try {
      const filePath = path.join(config.scriptsDir, arquivo);
      await fs.unlink(filePath);
    } catch {
      // ignora se arquivo não existir
    }
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(config.scriptsDir, { recursive: true });
  }
}

export const scriptStorage = new ScriptStorage();
