import type { Category, DashboardData, LibraryItem } from "./types.js";

const VOLUME_PATTERN = /第[0-9０-９一二三四五六七八九十百千]+巻|上巻|中巻|下巻|上|中|下/;

function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[・･/／\\\-‐‑–—_:：,，.．!！?？「」『』（）()［］\[\]【】]/g, "")
    .toLowerCase();
}

function groupKey(item: LibraryItem): string {
  if (item.isbn) return `isbn:${item.isbn}`;

  const title = normalizeText(item.title);
  const author = normalizeText(item.author ?? "");
  const volume = (item.title.match(VOLUME_PATTERN) ?? []).join("|");
  return `title:${title}|author:${author}|volume:${volume}`;
}

export function detectDuplicates(items: LibraryItem[]): LibraryItem[] {
  const targets = items.filter(
    (item) => item.category === "hold_ready" || item.category === "reservation",
  );
  const groups = new Map<string, LibraryItem[]>();

  for (const item of targets) {
    const key = groupKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const duplicateGroups: LibraryItem[][] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    duplicateGroups.push(group);
    for (const item of group) {
      item.isDuplicate = true;
      item.duplicateGroup = key;
    }
  }

  return items;
}

export function buildDashboardData(items: LibraryItem[]): DashboardData {
  const merged = detectDuplicates([...items]);
  const duplicates = new Map<string, LibraryItem[]>();

  for (const item of merged) {
    if (!item.isDuplicate || !item.duplicateGroup) continue;
    const group = duplicates.get(item.duplicateGroup) ?? [];
    group.push(item);
    duplicates.set(item.duplicateGroup, group);
  }

  const fetchedAt =
    merged.reduce((latest, item) => (item.fetchedAt > latest ? item.fetchedAt : latest), "") ||
    new Date().toISOString();

  return {
    fetchedAt,
    items: merged,
    duplicates: [...duplicates.values()],
  };
}

export function itemsByCategory(items: LibraryItem[], category: Category): LibraryItem[] {
  return items.filter((item) => item.category === category);
}

export const LIBRARY_LABELS: Record<LibraryItem["library"], string> = {
  toshima: "豊島区",
  shinjuku: "新宿区",
  nakano: "中野区",
};
