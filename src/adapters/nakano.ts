import { chromium, type Page } from "playwright";
import type { LibraryAccount, LibraryItem } from "../types.js";
import {
  categorizeNakanoReservationStatus,
  parseNakanoLoans,
  parseNakanoReservations,
} from "./nakano-list.js";

const BASE_URL = "https://www.kn.licsre-saas.jp/tokyo-nakano/webopac";

async function login(page: Page, account: LibraryAccount): Promise<void> {
  await page.goto(`${BASE_URL}/usermenu.do`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("利用者番号").fill(account.id);
  await page.getByLabel("パスワード").fill(account.pw);
  await page.getByRole("button", { name: "ログインする" }).click();
  await page.waitForSelector("text=ログアウト", { timeout: 30_000 });
}

async function fetchLoans(
  page: Page,
  account: LibraryAccount,
  fetchedAt: string,
): Promise<LibraryItem[]> {
  await page.goto(`${BASE_URL}/userlist.do?type=2&page=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1000);

  const rows = await parseNakanoLoans(page);
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
  await page.goto(`${BASE_URL}/userlist.do?type=3&page=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1000);

  const rows = await parseNakanoReservations(page);
  return rows.map((row) => {
    const category = categorizeNakanoReservationStatus(row.status) ?? "reservation";
    return {
      library: account.library,
      user: account.user,
      category,
      title: row.title,
      queuePosition: category === "reservation" ? row.queuePosition : undefined,
      pickupLibrary: row.pickupLibrary,
      pickupDeadline: category === "hold_ready" ? row.pickupDeadline : undefined,
      status: row.status,
      fetchedAt,
    };
  });
}

export async function fetchNakano(account: LibraryAccount): Promise<LibraryItem[]> {
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
