import { fetchLibraryItems } from "./adapters/index.js";
import { fetchAllClosureDates } from "./adapters/closure-dates.js";
import { buildDashboard } from "./build.js";
import { loadAccounts } from "./config.js";
import { buildDashboardData } from "./merge.js";
import type { LibraryAccount, LibraryId, LibraryItem, UserLabel } from "./types.js";

function libraryUsersFromAccounts(
  accounts: LibraryAccount[],
): Partial<Record<LibraryId, UserLabel[]>> {
  const result: Partial<Record<LibraryId, UserLabel[]>> = {};
  for (const account of accounts) {
    const list = result[account.library] ?? [];
    if (!list.includes(account.user)) list.push(account.user);
    result[account.library] = list;
  }
  return result;
}

async function fetchAll(accounts: LibraryAccount[]): Promise<LibraryItem[]> {
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
  const accounts = loadAccounts();
  const items = await fetchAll(accounts);

  console.log(`[fetch] 休館日情報を取得しています...`);
  const targetLibraries = [
    { library: "toshima" as const, name: "千早臨時窓口" },
    { library: "shinjuku" as const, name: "西落合" },
    { library: "nakano" as const, name: "中野東" },
  ];
  const closureDates = await fetchAllClosureDates(targetLibraries);
  console.log(`[fetch] 休館日情報 — ${closureDates.length} 件`);

  const data = buildDashboardData(items);
  data.closureDates = closureDates;
  data.libraryUsers = libraryUsersFromAccounts(accounts);

  await buildDashboard(data);

  console.log(`完了: ${data.items.length} 件 + 休館日 ${closureDates.length} 件 → docs/index.html, docs/data.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
