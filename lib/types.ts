// 원본 CSV 데이터 (롱 포맷)
export interface FinancialData {
  year: number;
  month: number; // 1~12
  account: string;
  value: number;
}

// 테이블 행 데이터
export interface TableRow {
  account: string;
  level: number; // 인덴트 레벨 (0=최상위)
  isGroup: boolean; // 그룹(접기/펼치기 가능)인지
  isCalculated: boolean; // 계산된 값인지
  isHighlight?: 'sky' | 'yellow' | 'gray' | 'none'; // 배경색 강조
  isBold?: boolean; // 볼드 처리
  values: (number | null)[]; // 12개월 또는 13개(합계 포함)
  children?: TableRow[];
  format?: 'number' | 'percent'; // 표시 형식
  comparisons?: ComparisonData; // 비교 데이터 (FinancialTable 범용 지원용)
  year2024Value?: number | null; // CF용 2024년 값
  brandComparisons?: BrandComparisonData; // 브랜드별 비교 데이터 (FinancialTable 범용 지원용)
}

// 비교 데이터 (FinancialTable 범용 지원용)
export interface ComparisonData {
  prevYearMonth: number | null;
  currYearMonth: number | null;
  monthYoY: number | null;
  prevYearYTD: number | null;
  currYearYTD: number | null;
  ytdYoY: number | null;
  prevYearAnnual: number | null;
  currYearAnnual: number | null;
  annualYoY: number | null;
}

// 브랜드별 비교 데이터 (FinancialTable 범용 지원용)
export interface BrandComparisonData {
  month: {
    prevYear: { [brand: string]: number | null };
    currYear: { [brand: string]: number | null };
  };
  ytd: {
    prevYear: { [brand: string]: number | null };
    currYear: { [brand: string]: number | null };
  };
  annual: {
    prevYear: { [brand: string]: number | null };
    currYear: { [brand: string]: number | null };
  };
}

// 탭 타입
export type TabType = 'CF' | 'CREDIT' | 'WORKING_CAPITAL' | 'WORKING_CAPITAL_STATEMENT';

// 월 데이터 맵
export type MonthDataMap = Map<string, number[]>; // account -> [month1, month2, ..., month12]

// 여신사용현황 타입
export interface CreditDealer {
  name: string;
  외상매출금: number;
  선수금: number;
  순여신: number;
}

export interface CreditData {
  total: {
    외상매출금: number;
    선수금: number;
    순여신: number;
  };
  dealers: CreditDealer[];
  top17: CreditDealer[];
  others: {
    count: number;
    외상매출금: number;
    선수금: number;
    순여신: number;
  };
  othersList: CreditDealer[];
  analysis: {
    top17Ratio: number; // 상위 17개 비율
    top1Ratio: number; // 최대 거래처 비율
    riskLevel: '높음' | '낮음';
  };
}
