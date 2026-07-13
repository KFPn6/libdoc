import "dotenv/config";
import type { LibraryAccount } from "./types.js";

function normalizeAccountsJson(raw: string): string {
  let value = raw.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "")
    .replace(/\r?\n/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function loadAccounts(): LibraryAccount[] {
  const raw = process.env.LIBRARY_ACCOUNTS;
  if (!raw?.trim()) {
    throw new Error("LIBRARY_ACCOUNTS が設定されていません（.env または環境変数）");
  }

  const accounts = JSON.parse(normalizeAccountsJson(raw)) as LibraryAccount[];  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("LIBRARY_ACCOUNTS は空でない JSON 配列である必要があります");
  }

  for (const account of accounts) {
    if (!account.library || !account.user || !account.id || !account.pw) {
      throw new Error("各アカウントに library, user, id, pw が必要です");
    }
  }

  return accounts;
}
