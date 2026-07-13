import type { Locator, Page } from "playwright";

export type NakanoLoanRow = {
  title: string;
  loanLibrary?: string;
  returnDeadline?: string;
  status: string;
};

export type NakanoReservationRow = {
  title: string;
  status: string;
  queuePosition?: number;
  pickupLibrary?: string;
  pickupDeadline?: string;
};

function normalizeText(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

async function readClass(row: Locator, selector: string): Promise<string> {
  const target = row.locator(selector).first();
  if ((await target.count()) === 0) return "";
  return normalizeText((await target.innerText()) ?? "");
}

async function dataRows(page: Page, tableClass: string): Promise<Locator[]> {
  const table = page.locator(`table.${tableClass}`).first();
  if ((await table.count()) === 0) return [];

  const rows = table.locator("tbody tr");
  const count = await rows.count();
  const result: Locator[] = [];

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    if ((await row.locator(".colprttil").count()) > 0) {
      result.push(row);
    }
  }

  return result;
}

export async function parseNakanoLoans(page: Page): Promise<NakanoLoanRow[]> {
  const rows = await dataRows(page, "lendListTbl");
  const items: NakanoLoanRow[] = [];

  for (const row of rows) {
    const title = await readClass(row, ".colprttil a");
    if (!title) continue;

    items.push({
      title,
      loanLibrary: (await readClass(row, ".collndlcs")) || undefined,
      returnDeadline: (await readClass(row, ".collkigen")) || undefined,
      status: "貸出中",
    });
  }

  return items;
}

export async function parseNakanoReservations(
  page: Page,
): Promise<NakanoReservationRow[]> {
  const rows = await dataRows(page, "reserveListTbl");
  const items: NakanoReservationRow[] = [];

  for (const row of rows) {
    const title = await readClass(row, ".colprttil a");
    if (!title) continue;

    const queueRaw = await readClass(row, ".colrsvodr");
    const queueMatch = queueRaw.match(/(\d+)/);

    items.push({
      title,
      status: (await readClass(row, ".colstatus")) || "予約中",
      queuePosition: queueMatch ? Number(queueMatch[1]) : undefined,
      pickupLibrary: (await readClass(row, ".colutolcs")) || undefined,
      pickupDeadline: (await readClass(row, ".collimitdate")) || undefined,
    });
  }

  return items;
}

export function categorizeNakanoReservationStatus(
  status: string,
): "hold_ready" | "reservation" | null {
  if (/取置済|確保|用意|受取可/.test(status)) {
    return "hold_ready";
  }
  if (/予約中|回送|順番|準備中|キャンセル待ち/.test(status)) {
    return "reservation";
  }
  return null;
}
