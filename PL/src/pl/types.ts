export type Brand = "Total" | "MLB" | "Discovery";
export type Year = 2025 | 2026;
export type MonthKey = "m1" | "m2" | "m3" | "m4" | "m5" | "m6" | "m7" | "m8" | "m9" | "m10" | "m11" | "m12";

export type Row = {
  year: Year;
  brand: Brand;
  lvl1: string;        // 대분류
  lvl2: string;        // 중분류
  lvl3: string | null; // 소분류(없으면 null)
  months: Record<MonthKey, number>; // 금액은 정수, %는 소수(예: 33.0)
  isRateRow: boolean;  // % 포함 행이면 true
};
