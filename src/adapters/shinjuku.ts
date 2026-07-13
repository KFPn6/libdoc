import { chromium, type Page } from "playwright";
import type { LibraryAccount, LibraryItem } from "../types.js";
import {
  categorizeWinjReservationStatus,
  parseWinjBookList,
} from "./winj-list.js";

const LOGIN_URL =
  "https://opc.library.shinjuku.tokyo.jp/winj/opac/login.do?lang=ja&dispatch=/opac/mylibrary.do";
const MYPAGE_URL = "https://opc.library.shinjuku.tokyo.jp/winj/opac/mylibrary.do";

async function login(page: Page, account: LibraryAccount): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
  await page.locator("#usercd").fill(account.id);
  await page.locator("#password").fill(account.pw);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForSelector("text=ライブラリ", { timeout: 30_000 });
}

async function fetchLoans(
  page: Page,
  account: LibraryAccount,
  fetchedAt: string,
): Promise<LibraryItem[]> {
  await page.getByRole("link", { name: "借りている資料" }).first().click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("text=貸出状況一覧", { timeout: 30_000 });

  const rows = await parseWinjBookList(page, "loan");
  return rows.map((row) => ({
    library: account.library,
    user: account.user,
    category: "loan" as const,
    title: row.title,
    returnDeadline: row.returnDeadline,
    status: row.status || "貸出中",
    fetchedAt,
  }));
}

async function fetchReservations(
  page: Page,
  account: LibraryAccount,
  fetchedAt: string,
): Promise<LibraryItem[]> {
  await page.goto(MYPAGE_URL, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "予約した資料" }).first().click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("text=予約状況一覧", { timeout: 30_000 });

  const rows = await parseWinjBookList(page, "reservation");
  return rows.map((row) => {
    const category = categorizeWinjReservationStatus(row.status) ?? "reservation";
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

export async function fetchShinjuku(account: LibraryAccount): Promise<LibraryItem[]> {
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
