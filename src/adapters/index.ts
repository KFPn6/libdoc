import type { LibraryAccount, LibraryItem } from "../types.js";
import { fetchNakano } from "./nakano.js";
import { fetchShinjuku } from "./shinjuku.js";
import { fetchToshima } from "./toshima.js";

export async function fetchLibraryItems(account: LibraryAccount): Promise<LibraryItem[]> {
  switch (account.library) {
    case "nakano":
      return fetchNakano(account);
    case "toshima":
      return fetchToshima(account);
    case "shinjuku":
      return fetchShinjuku(account);
    default:
      throw new Error(`未対応の図書館: ${account.library}`);
  }
}
