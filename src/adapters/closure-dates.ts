import { chromium } from "playwright";
import type { LibraryClosureDate } from "../types.js";

const LIBRARY_CALENDAR_URLS: Record<string, { pid?: string; url?: string; name: string }> = {
  // 豊島区
  "千早臨時窓口": {
    pid: "104",
    name: "千早図書館臨時窓口",
  },
  駒込: { pid: "101", name: "駒込図書館" },
  巣鴨: { pid: "102", name: "巣鴨図書館" },
  池袋: { pid: "105", name: "池袋図書館" },
  目白: { pid: "103", name: "目白図書館" },
  上池袋: { pid: "106", name: "上池袋図書館" },
  中央豊島: { pid: "100", name: "中央図書館" },

  // 新宿区
  西落合: {
    url: "https://www.library.shinjuku.tokyo.jp/facility/nishiochiai/calendar/index.html",
    name: "西落合図書館",
  },
  四谷: {
    url: "https://www.library.shinjuku.tokyo.jp/facility/yotsuya/calendar/index.html",
    name: "四谷図書館",
  },
  鶴巻: {
    url: "https://www.library.shinjuku.tokyo.jp/facility/tsurumaki/calendar/index.html",
    name: "鶴巻図書館",
  },
  戸山: {
    url: "https://www.library.shinjuku.tokyo.jp/facility/toyama/calendar/index.html",
    name: "戸山図書館",
  },

  // 中野区
  中野東: {
    url: "https://www.kn.licsre-saas.jp/tokyo-nakano/webopac/library.do?lib=08",
    name: "中野東図書館",
  },
  中央中野: {
    url: "https://www.kn.licsre-saas.jp/tokyo-nakano/webopac/library.do?lib=01",
    name: "中央図書館",
  },
};

async function fetchToshimaCalendar(
  pid: string,
  libraryName: string
): Promise<LibraryClosureDate[]> {
  const browser = await chromium.launch({ 
    headless: true,
    timeout: 30000
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const closureDates: LibraryClosureDate[] = [];

  try {
    await page.goto(`https://www.library.toshima.tokyo.jp/contents?pid=${pid}`, {
      waitUntil: "load",
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ページから年月情報を取得
    const pageContent = await page.content();
    const yearMonthRegex = /(\d{4})年(\d{1,2})月/g;
    const monthMatches = [...pageContent.matchAll(yearMonthRegex)];
    
    if (monthMatches.length === 0) {
      console.warn(`No month information found for ${libraryName}`);
      return closureDates;
    }

    // 最初の2つの月情報を使用（通常は当月と翌月）
    const months = monthMatches.slice(0, 2).map(m => ({
      year: parseInt(m[1]),
      month: parseInt(m[2])
    }));

    const tables = await page.locator("table").all();
    
    for (let i = 0; i < Math.min(tables.length, months.length); i++) {
      const { year, month } = months[i];
      const cells = await tables[i].locator("td").all();
      
      for (const cell of cells) {
        const text = (await cell.textContent()) || "";
        if (!text.includes("休館")) continue;

        const dayMatch = text.match(/^(\d{1,2})/);
        if (!dayMatch) continue;

        const day = parseInt(dayMatch[1]);
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const checkDate = new Date(dateStr);

        if (checkDate >= today && checkDate.getMonth() === month - 1) {
          closureDates.push({
            library: "toshima",
            libraryName,
            date: dateStr,
            reason: "休館日",
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching Toshima calendar for ${libraryName}:`, error);
  } finally {
    await browser.close();
  }

  return closureDates.sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchShinjukuCalendar(
  url: string,
  libraryName: string
): Promise<LibraryClosureDate[]> {
  const browser = await chromium.launch({ 
    headless: true,
    timeout: 30000
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const closureDates: LibraryClosureDate[] = [];

  try {
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 新宿区のカレンダーは現在月のみ表示されるようなので、現在月と翌月を想定
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    // 休館日のセルを取得（classにcloseを含む）
    const closeCells = await page.locator("td.p-open-schedule__calendar-item--close, td[class*='close']").all();
    
    for (const cell of closeCells) {
      const text = (await cell.textContent()) || "";
      
      // "3日月曜日 休館 休館" のような形式から日を抽出
      const dayMatch = text.match(/(\d{1,2})日/);
      if (!dayMatch) continue;

      const day = parseInt(dayMatch[1]);
      
      // 現在月で試す
      let dateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      let checkDate = new Date(dateStr);
      
      // 日付が現在月と合わない場合は翌月を試す
      if (checkDate.getMonth() !== currentMonth - 1) {
        dateStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        checkDate = new Date(dateStr);
      }

      if (checkDate >= today) {
        closureDates.push({
          library: "shinjuku",
          libraryName,
          date: dateStr,
          reason: "休館日",
        });
      }
    }
  } catch (error) {
    console.error(`Error fetching Shinjuku calendar for ${libraryName}:`, error);
  } finally {
    await browser.close();
  }

  return closureDates.sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchNakanoCalendar(
  url: string,
  libraryName: string
): Promise<LibraryClosureDate[]> {
  const browser = await chromium.launch({ 
    headless: true,
    timeout: 30000
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const closureDates: LibraryClosureDate[] = [];

  try {
    await page.goto(url, {
      waitUntil: "load",
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const calendarContent = await page.content();
    
    const yearMonthRegex = /(\d{4})年(\d{1,2})月/g;
    let match;
    const months: Array<{ year: number; month: number }> = [];
    
    while ((match = yearMonthRegex.exec(calendarContent)) !== null) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      if (!months.some(m => m.year === year && m.month === month)) {
        months.push({ year, month });
      }
    }

    const dayRegex = /(\d{1,2})[^>]*休/g;
    const allMatches = calendarContent.matchAll(dayRegex);
    const days = Array.from(new Set(Array.from(allMatches, m => parseInt(m[1]))));

    for (const { year, month } of months) {
      for (const day of days) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const checkDate = new Date(dateStr);
        
        if (checkDate >= today && checkDate.getMonth() === month - 1) {
          closureDates.push({
            library: "nakano",
            libraryName,
            date: dateStr,
            reason: "休館日",
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching Nakano calendar for ${libraryName}:`, error);
  } finally {
    await browser.close();
  }

  return closureDates.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchAllClosureDates(
  libraries: Array<{ library: "toshima" | "shinjuku" | "nakano"; name: string }>
): Promise<LibraryClosureDate[]> {
  const allClosureDates: LibraryClosureDate[] = [];

  for (const lib of libraries) {
    try {
      const config = LIBRARY_CALENDAR_URLS[lib.name];
      if (!config) {
        console.warn(`Unknown library: ${lib.name}`);
        continue;
      }

      let dates: LibraryClosureDate[] = [];

      if (lib.library === "toshima" && config.pid) {
        dates = await fetchToshimaCalendar(config.pid, config.name);
      } else if (lib.library === "shinjuku" && config.url) {
        dates = await fetchShinjukuCalendar(config.url, config.name);
      } else if (lib.library === "nakano" && config.url) {
        dates = await fetchNakanoCalendar(config.url, config.name);
      }

      allClosureDates.push(...dates);
    } catch (error) {
      console.error(`Failed to fetch closure dates for ${lib.library}/${lib.name}:`, error);
    }
  }

  return allClosureDates.sort((a, b) => a.date.localeCompare(b.date));
}
