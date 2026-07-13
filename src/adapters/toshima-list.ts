import type { Page } from "playwright";

export type ToshimaLoanRow = {
  title: string;
  loanLibrary?: string;
  returnDeadline?: string;
  status: string;
};

export type ToshimaReservationRow = {
  title: string;
  pickupLibrary?: string;
  pickupDeadline?: string;
  queuePosition?: number;
  status: string;
};

function normalizeJapaneseDate(value: string): string {
  const match = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${year}/${month.padStart(2, "0")}/${day.padStart(2, "0")}`;
}

async function readFields(
  item: ReturnType<Page["locator"]>,
): Promise<Record<string, string>> {
  const dls = item.locator("dl");
  const count = await dls.count();
  const fields: Record<string, string> = {};

  for (let i = 0; i < count; i++) {
    const dl = dls.nth(i);
    const key = ((await dl.locator("dt").textContent({ timeout: 1000 }).catch(() => "")) ?? "").trim();
    if (!key) continue;
    const value = ((await dl.locator("dd").textContent({ timeout: 1000 }).catch(() => "")) ?? "").trim();
    fields[key] = value;
  }

  return fields;
}

async function parseCells<T>(
  page: Page,
  mapRow: (title: string, fields: Record<string, string>) => T | null,
): Promise<T[]> {
  const cells = page.locator(".tablecell");
  const count = await cells.count();
  const items: T[] = [];

  for (let i = 0; i < count; i++) {
    const cell = cells.nth(i);
    const title = (await cell.locator(".cover img").getAttribute("alt"))?.trim() ?? "";
    if (!title) continue;

    const fields = await readFields(cell.locator(".item").first());
    const row = mapRow(title, fields);
    if (row) items.push(row);
  }

  return items;
}

export async function parseToshimaLoanList(page: Page): Promise<ToshimaLoanRow[]> {
  return parseCells(page, (title, fields) => ({
    title,
    loanLibrary: fields["貸出場所"],
    returnDeadline: fields["返却期限"]
      ? normalizeJapaneseDate(fields["返却期限"])
      : undefined,
    status: "貸出中",
  }));
}

export async function parseToshimaReservationList(
  page: Page,
): Promise<ToshimaReservationRow[]> {
  return parseCells(page, (title, fields) => {
    const queueMatch = (fields["順位"] ?? "").match(/(\d+)/);
    return {
      title,
      pickupLibrary: fields["受取場所"],
      pickupDeadline: fields["取置期限"]
        ? normalizeJapaneseDate(fields["取置期限"])
        : undefined,
      queuePosition: queueMatch ? Number(queueMatch[1]) : undefined,
      status: fields["予約状況"] || "",
    };
  });
}

export function categorizeToshimaReservationStatus(
  status: string,
): "hold_ready" | "reservation" | null {
  if (/用意できています|取置済|受取可/.test(status)) {
    return "hold_ready";
  }
  if (/予約中|回送中|順番|準備中|キャンセル待ち/.test(status)) {
    return "reservation";
  }
  return null;
}
