import { chromium, type Page } from "playwright";
import type { LibraryAccount, LibraryItem } from "../types.js";
import {
  categorizeToshimaReservationStatus,
  parseToshimaLoanList,
  parseToshimaReservationList,
} from "./toshima-list.js";

const LOGIN_URL = "https://www.library.toshima.tokyo.jp/login";

async function login(page: Page, account: LibraryAccount): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
  await page.locator("#textUserId").fill(account.id);
  await page.locator("#textPassword").fill(account.pw);
  await page.locator("#buttonLogin").click();
  await page.waitForSelector("text=貸出状況照会", { timeout: 30_000 });
}

async function fetchLoans(
  page: Page,
  account: LibraryAccount,
  fetchedAt: string,
): Promise<LibraryItem[]> {
  await page.getByRole("link", { name: "貸出状況照会へ" }).click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("text=貸出状況", { timeout: 30_000 });

  const rows = await parseToshimaLoanList(page);
  return rows.map((row) => ({
    library: account.library,
    user: account.user,
    category: "loan" as const,
    title: row.title,
    returnDeadline: row.returnDeadline,
    loanLibrary: row.loanLibrary,
    status: row.status,
    fetchedAt,
  }));
}

async function fetchReservations(
  page: Page,
  account: LibraryAccount,
  fetchedAt: string,
): Promise<LibraryItem[]> {
  await page.getByRole("link", { name: "利用者メニュー" }).first().click();
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("link", { name: "予約状況照会へ" }).click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("text=予約状況", { timeout: 30_000 });

  const rows = await parseToshimaReservationList(page);
  return rows.map((row) => {
    const category = categorizeToshimaReservationStatus(row.status) ?? "reservation";
    return {
      library: account.library,
      user: account.user,
      category,
      title: row.title,
      queuePosition: row.queuePosition,
      pickupLibrary: row.pickupLibrary,
      pickupDeadline: row.pickupDeadline,
      status: row.status,
      fetchedAt,
    };
  });
}

export async function fetchToshima(account: LibraryAccount): Promise<LibraryItem[]> {
  const fetchedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page, account);
    const loans = await fetchLoans(page, account, fetchedAt);
    const reservations = await fetchReservations(page, account, fetchedAt);
    return [...loans, ...reservations];
  } finally {
    await browser.close();
  }
}
