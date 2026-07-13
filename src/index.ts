import { fetchLibraryItems } from "./adapters/index.js";
import { buildDashboard } from "./build.js";
import { loadAccounts } from "./config.js";
import { buildDashboardData } from "./merge.js";
import type { LibraryAccount, LibraryItem } from "./types.js";

async function fetchAll(): Promise<LibraryItem[]> {
  const accounts = loadAccounts();
  const items: LibraryItem[] = [];

  for (const account of accounts) {
    console.log(`[fetch] ${account.library} / ${account.user} ...`);
    const result = await fetchLibraryItems(account);
    console.log(`[fetch] ${account.library} / ${account.user} — ${result.length} 件`);
    items.push(...result);
  }

  return items;
}

async function main(): Promise<void> {
  const items = await fetchAll();
  const data = buildDashboardData(items);
  await buildDashboard(data);

  console.log(`完了: ${data.items.length} 件 → docs/index.html, docs/data.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
