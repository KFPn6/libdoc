import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { itemsByCategory, LIBRARY_LABELS } from "./merge.js";
import type { DashboardData, LibraryItem } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, "../docs");

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMonthDay(value?: string): string {
  if (!value) return "";
  const match = value.replace(/\//g, "-").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return value;
  return `${Number(match[2])}/${Number(match[3])}`;
}

function daysUntil(value?: string): number | null {
  if (!value) return null;
  const normalized = value.replace(/\//g, "-");
  const target = new Date(normalized);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function deadlineClass(value?: string): string {
  const days = daysUntil(value);
  if (days === null) return "";
  if (days <= 0) return "deadline-today";
  if (days <= 3) return "deadline-soon";
  return "";
}

function renderMeta(item: LibraryItem): string {
  const library = LIBRARY_LABELS[item.library];
  return `${escapeHtml(library)}/${escapeHtml(item.user)}`;
}

function renderItem(item: LibraryItem, trailing = ""): string {
  return `
    <li class="item">
      <div class="item-title">${escapeHtml(item.title)} <span class="item-meta">${renderMeta(item)}</span>${trailing}</div>
    </li>`;
}

function renderDuplicateGroup(group: LibraryItem[]): string {
  const title = group[0]?.title ?? "";
  const locations = group
    .map((item) => `${LIBRARY_LABELS[item.library]}（${item.user}）`)
    .join(" + ");
  return `
    <li class="item duplicate">
      <div class="item-title">${escapeHtml(title)}</div>
      <div class="item-meta">${escapeHtml(locations)}</div>
    </li>`;
}

function renderSection(
  id: string,
  title: string,
  items: LibraryItem[] | LibraryItem[][],
  render: (item: LibraryItem | LibraryItem[]) => string,
  hiddenWhenEmpty = false,
  breakdown = "",
): string {
  const count = Array.isArray(items[0])
    ? (items as LibraryItem[][]).length
    : (items as LibraryItem[]).length;

  if (hiddenWhenEmpty && count === 0) return "";

  const body =
    count === 0
      ? `<p class="empty">なし</p>`
      : `<ul class="item-list">${(items as Array<LibraryItem | LibraryItem[]>).map(render).join("")}</ul>`;

  const breakdownHtml = breakdown
    ? ` <span class="breakdown">${breakdown}</span>`
    : "";

  return `
    <section class="panel" id="${id}">
      <h2>${title} <span class="count">(${count})</span>${breakdownHtml}</h2>
      ${body}
    </section>`;
}

const LIBRARY_ORDER: LibraryItem["library"][] = ["toshima", "shinjuku", "nakano"];

const RESERVATION_LIMITS: Record<LibraryItem["library"], number> = {
  toshima: 20,
  shinjuku: 10,
  nakano: 15,
};

function renderCountBreakdown(items: LibraryItem[]): string {
  return LIBRARY_ORDER.map((library) => {
    const count = items.filter((item) => item.library === library).length;
    return `${LIBRARY_LABELS[library]}(${count})`;
  }).join("、");
}

function renderReservationBreakdown(items: LibraryItem[]): string {
  return LIBRARY_ORDER.map((library) => {
    const used = items.filter(
      (item) =>
        item.library === library &&
        item.user === "本人" &&
        (item.category === "reservation" || item.category === "hold_ready"),
    ).length;
    const limit = RESERVATION_LIMITS[library];
    const full = used >= limit ? " reservation-full" : "";
    return `<span class="lib-stat${full}">${LIBRARY_LABELS[library]}(${used}/${limit})</span>`;
  }).join("、");
}

export async function buildDashboard(data: DashboardData): Promise<void> {
  await mkdir(DOCS_DIR, { recursive: true });

  const holdReady = itemsByCategory(data.items, "hold_ready");
  const loans = itemsByCategory(data.items, "loan");
  const reservations = itemsByCategory(data.items, "reservation");

  const duplicateSection = renderSection(
    "duplicates",
    "重複予約",
    data.duplicates,
    (group) => renderDuplicateGroup(group as LibraryItem[]),
    true,
  );

  const holdSection = renderSection(
    "hold-ready",
    "受取",
    holdReady,
    (item) => {
      const hold = item as LibraryItem;
      const deadline = formatMonthDay(hold.pickupDeadline);
      const cls = deadlineClass(hold.pickupDeadline);
      const trailing = deadline
        ? ` <span class="item-detail ${cls}">${escapeHtml(deadline)}</span>`
        : "";
      return renderItem(hold, trailing);
    },
    false,
    renderCountBreakdown(holdReady),
  );

  const loanSection = renderSection(
    "loans",
    "返却",
    loans,
    (item) => renderItem(item as LibraryItem),
    false,
    renderCountBreakdown(loans),
  );

  const reservationSection = renderSection(
    "reservations",
    "予約中",
    reservations,
    (item) => renderItem(item as LibraryItem),
    false,
    renderReservationBreakdown(data.items),
  );

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>図書館ダッシュボード</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f5f6f8;
      --card: #ffffff;
      --text: #1f2937;
      --muted: #6b7280;
      --border: #e5e7eb;
      --accent: #2563eb;
      --warn: #b45309;
      --danger: #dc2626;
      --soon: #ca8a04;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111827;
        --card: #1f2937;
        --text: #f9fafb;
        --muted: #9ca3af;
        --border: #374151;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN", "Hiragino Kaku Gothic Pro", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 16px;
    }
    header {
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 1.5rem;
    }
    .updated {
      color: var(--muted);
      font-size: 0.9rem;
    }
    .panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .panel h2 {
      margin: 0 0 8px;
      font-size: 1.1rem;
    }
    .count {
      color: var(--muted);
      font-weight: normal;
    }
    .breakdown {
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: normal;
    }
    .lib-stat.reservation-full {
      color: var(--danger);
      font-weight: 600;
    }
    .item-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .item {
      padding: 12px 0;
      border-top: 1px solid var(--border);
    }
    .item:first-child { border-top: none; padding-top: 0; }
    .item.duplicate { border-left: 3px solid var(--warn); padding-left: 10px; }
    .item-title {
      font-weight: 600;
    }
    .item-meta, .item-detail {
      color: var(--muted);
      font-weight: normal;
      font-size: 0.9rem;
    }
    .deadline-today { color: var(--danger); font-weight: 600; }
    .deadline-soon { color: var(--soon); font-weight: 600; }
    .empty {
      margin: 0;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>図書館ダッシュボード</h1>
      <div class="updated">最終更新: ${escapeHtml(formatDateTime(data.fetchedAt))}</div>
    </header>
    ${duplicateSection}
    ${holdSection}
    ${loanSection}
    ${reservationSection}
  </div>
</body>
</html>`;

  await writeFile(path.join(DOCS_DIR, "index.html"), html, "utf8");
  await writeFile(path.join(DOCS_DIR, "data.json"), JSON.stringify(data, null, 2), "utf8");
}
