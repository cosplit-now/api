import { randomUUID } from "crypto";
import * as path from "path";

export function generateObjectKey(filename?: string) {
  const ext = filename ? path.extname(filename) : "";
  const uuid = randomUUID();

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");

  return `receipts/${yyyy}/${mm}/${uuid}${ext}`;
}
