import type { Page } from "playwright";

export type WinjRow = {
  title: string;
  status: string;
  queuePosition?: number;
  pickupLibrary?: string;
  pickupDeadline?: string;
  returnDeadline?: string;
};

function normalizeText(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function cleanTitle(raw: string): string {
  return normalizeText(raw).replace(/^\[[^\]]+\]\s*/, "");
}

function parseInfo(info: string, mode: "loan" | "reservation"): Omit<WinjRow, "title"> {
  const result: Omit<WinjRow, "title"> = { status: "" };

  const returnMatch = info.match(/返却予定日[:：]\s*([\d/]+)/);
  if (returnMatch) result.returnDeadline = returnMatch[1];

  const pickupDeadlineMatch = info.match(/取置期限日[:：]\s*([\d/]+)/);
  if (pickupDeadlineMatch) result.pickupDeadline = pickupDeadlineMatch[1];

  const pickupLibraryMatch = info.match(/受取館[:：]\s*([^\s：]+)/);
  if (pickupLibraryMatch) result.pickupLibrary = pickupLibraryMatch[1];

  const queueMatch = info.match(/(\d+)\s*番目/);
  if (queueMatch) result.queuePosition = Number(queueMatch[1]);

  if (mode === "loan") {
    result.status = "貸出中";
    return result;
  }

  if (/確保済|取置済|用意できました|貸出可能|受取可/.test(info)) {
    result.status = "確保済";
  } else if (/回送|配送/.test(info)) {
    result.status = "回送中";
  } else if (/確保待ち|予約数/.test(info)) {
    result.status = "予約中";
  } else {
    result.status = "予約中";
  }

  return result;
}

export async function parseWinjBookList(
  page: Page,
  mode: "loan" | "reservation",
): Promise<WinjRow[]> {
  const items = page.locator("ol.list-book > li");
  const count = await items.count();
  const rows: WinjRow[] = [];

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);

    const titleLocator = item.locator("span.title").first();
    if ((await titleLocator.count()) === 0) continue;
    const title = cleanTitle((await titleLocator.innerText()) ?? "");
    if (!title) continue;

    const infoLocator = item.locator("div.column.info").first();
    const info = normalizeText(
      (await infoLocator.count()) > 0 ? (await infoLocator.innerText()) : "",
    );

    rows.push({ title, ...parseInfo(info, mode) });
  }

  return rows;
}

export function categorizeWinjReservationStatus(
  status: string,
): "hold_ready" | "reservation" | null {
  if (/確保済|取置済|受取可|用意/.test(status)) {
    return "hold_ready";
  }
  if (/予約中|回送中|確保待ち/.test(status)) {
    return "reservation";
  }
  return null;
}
