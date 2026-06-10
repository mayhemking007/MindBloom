import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const defaultDataDir = ".mindbloom-data";

export function isPersistenceEnabled(): boolean {
  return process.env.NODE_ENV !== "test";
}

export function dataFilePath(fileName: string): string {
  return resolve(process.env.MINDBLOOM_DATA_DIR ?? defaultDataDir, fileName);
}

export function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function writeJsonFile(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
