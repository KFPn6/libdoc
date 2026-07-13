export type LibraryId = "toshima" | "shinjuku" | "nakano";
export type UserLabel = "本人" | "家族";
export type Category = "hold_ready" | "reservation" | "loan";

export type LibraryAccount = {
  library: LibraryId;
  user: UserLabel;
  id: string;
  pw: string;
};

export type LibraryItem = {
  library: LibraryId;
  user: UserLabel;
  category: Category;
  title: string;
  author?: string;
  isbn?: string;
  queuePosition?: number;
  pickupLibrary?: string;
  pickupDeadline?: string;
  returnDeadline?: string;
  loanLibrary?: string;
  status: string;
  isDuplicate?: boolean;
  duplicateGroup?: string;
  fetchedAt: string;
};

export type DashboardData = {
  fetchedAt: string;
  items: LibraryItem[];
  duplicates: LibraryItem[][];
};
