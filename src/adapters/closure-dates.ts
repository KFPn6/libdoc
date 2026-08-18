import type { LibraryClosureDate } from "../types.js";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNthDayOfMonth(year: number, month: number, weekday: number, nth: number): Date | null {
  const firstDay = new Date(year, month - 1, 1);
  let count = 0;
  let current = new Date(firstDay);

  while (current.getMonth() === month - 1) {
    if (current.getDay() === weekday) {
      count++;
      if (count === nth) {
        return current;
      }
    }
    current = addDays(current, 1);
  }

  return null;
}

function getLastFridayOfMonth(year: number, month: number): Date | null {
  const lastDay = new Date(year, month, 0);
  let current = new Date(lastDay);

  while (current.getMonth() === month - 1) {
    if (current.getDay() === 5) {
      return current;
    }
    current = addDays(current, -1);
  }

  return null;
}

export function calculateToshimaClosureDates(
  libraryName: string,
  startDate: Date,
  months: number = 3
): LibraryClosureDate[] {
  const closureDates: LibraryClosureDate[] = [];
  const libraryFullName = `${libraryName}図書館`;

  if (libraryName === "千早") {
    closureDates.push({
      library: "toshima",
      libraryName: libraryFullName,
      date: "2026-03-16",
      reason: "改築のため2028年11月末まで長期休館",
    });
    return closureDates;
  }

  const endDate = addDays(startDate, months * 31);
  let current = new Date(startDate);

  while (current <= endDate) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;

    const firstTuesday = getNthDayOfMonth(year, month, 2, 1);
    if (firstTuesday && firstTuesday >= startDate && firstTuesday <= endDate) {
      closureDates.push({
        library: "toshima",
        libraryName: libraryFullName,
        date: formatDate(firstTuesday),
        reason: "定期休館日（第1火曜）",
      });
    }

    const fourthFriday = getNthDayOfMonth(year, month, 5, 4);
    if (fourthFriday && fourthFriday >= startDate && fourthFriday <= endDate) {
      closureDates.push({
        library: "toshima",
        libraryName: libraryFullName,
        date: formatDate(fourthFriday),
        reason: "館内整理日（第4金曜）",
      });
    }

    current = new Date(year, month, 1);
  }

  return closureDates.sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateShinjukuClosureDates(
  libraryName: string,
  startDate: Date,
  months: number = 3
): LibraryClosureDate[] {
  const closureDates: LibraryClosureDate[] = [];
  const libraryFullName = `${libraryName}図書館`;
  const endDate = addDays(startDate, months * 31);
  let current = new Date(startDate);

  while (current <= endDate) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;

    let day = 1;
    while (day <= 31) {
      const checkDate = new Date(year, month - 1, day);
      if (checkDate.getMonth() !== month - 1) break;

      if (checkDate >= startDate && checkDate <= endDate) {
        if (checkDate.getDay() === 1) {
          closureDates.push({
            library: "shinjuku",
            libraryName: libraryFullName,
            date: formatDate(checkDate),
            reason: "定期休館日（月曜）",
          });
        }
      }

      day++;
    }

    const thirdThursday = getNthDayOfMonth(year, month, 4, 3);
    if (thirdThursday && thirdThursday >= startDate && thirdThursday <= endDate) {
      closureDates.push({
        library: "shinjuku",
        libraryName: libraryFullName,
        date: formatDate(thirdThursday),
        reason: "館内整理日（第3木曜）",
      });
    }

    current = new Date(year, month, 1);
  }

  return closureDates.sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateNakanoClosureDates(
  libraryName: string,
  startDate: Date,
  months: number = 3
): LibraryClosureDate[] {
  const closureDates: LibraryClosureDate[] = [];
  const libraryFullName = `${libraryName}図書館`;
  const endDate = addDays(startDate, months * 31);
  let current = new Date(startDate);

  while (current <= endDate) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;

    const secondThursday = getNthDayOfMonth(year, month, 4, 2);
    if (secondThursday && secondThursday >= startDate && secondThursday <= endDate) {
      closureDates.push({
        library: "nakano",
        libraryName: libraryFullName,
        date: formatDate(secondThursday),
        reason: "定期休館日（第2木曜）",
      });
    }

    const lastFriday = getLastFridayOfMonth(year, month);
    if (lastFriday && lastFriday >= startDate && lastFriday <= endDate) {
      closureDates.push({
        library: "nakano",
        libraryName: libraryFullName,
        date: formatDate(lastFriday),
        reason: "館内整理日（最終金曜）",
      });
    }

    current = new Date(year, month, 1);
  }

  return closureDates.sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateAllClosureDates(
  libraries: Array<{ library: "toshima" | "shinjuku" | "nakano"; name: string }>,
  startDate: Date = new Date(),
  months: number = 3
): LibraryClosureDate[] {
  const allClosureDates: LibraryClosureDate[] = [];

  for (const lib of libraries) {
    let dates: LibraryClosureDate[] = [];
    
    if (lib.library === "toshima") {
      dates = calculateToshimaClosureDates(lib.name, startDate, months);
    } else if (lib.library === "shinjuku") {
      dates = calculateShinjukuClosureDates(lib.name, startDate, months);
    } else if (lib.library === "nakano") {
      dates = calculateNakanoClosureDates(lib.name, startDate, months);
    }
    
    allClosureDates.push(...dates);
  }

  return allClosureDates.sort((a, b) => a.date.localeCompare(b.date));
}
