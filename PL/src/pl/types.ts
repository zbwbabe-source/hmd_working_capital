export type Source = "Total" | "HK_MLB" | "HK_Discovery" | "TW_MLB" | "TW_Discovery";
export type Year = 2025 | 2026;
export type MonthKey =
  | "m1"
  | "m2"
  | "m3"
  | "m4"
  | "m5"
  | "m6"
  | "m7"
  | "m8"
  | "m9"
  | "m10"
  | "m11"
  | "m12";

export type Row = {
  year: Year;
  source: Source;
  lvl1: string;
  lvl2: string;
  lvl3: string | null;
  months: Record<MonthKey, number>;
  isRateRow: boolean;
};
