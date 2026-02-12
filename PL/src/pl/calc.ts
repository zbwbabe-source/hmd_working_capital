import { MonthKey } from './types';

export type Months = Record<MonthKey, number>;

export type CalcOut = {
  prevMonth: number | null;
  currMonth: number | null;
  prevYTD: number | null;
  currYTD: number | null;
  prevYearTotal: number | null;
  currYearTotal: number | null;
};

export type RateCalcOut = {
  prevMonth: number;
  currMonth: number;
  prevYTD: number;
  currYTD: number;
  prevYearTotal: number;
  currYearTotal: number;
};

/**
 * 월 데이터 합산
 * @param months - 월별 데이터 (m1~m12)
 * @param toMonthIndex - 합산 종료 월 (1~12), 없으면 12까지 합산
 * @returns 합산 값
 */
export function sumMonths(months: Months, toMonthIndex?: number): number {
  const endMonth = toMonthIndex ?? 12;
  
  // 범위 체크
  if (endMonth < 1 || endMonth > 12) {
    return 0;
  }
  
  let sum = 0;
  for (let i = 1; i <= endMonth; i++) {
    const key = `m${i}` as MonthKey;
    sum += months[key] || 0;
  }
  
  return sum;
}

/**
 * 특정 월 값 반환
 * @param months - 월별 데이터 (m1~m12)
 * @param monthIndex - 월 인덱스 (1~12)
 * @returns 해당 월 값, 범위 밖이면 0
 */
export function getMonthValue(months: Months, monthIndex: number): number {
  // 범위 체크
  if (monthIndex < 1 || monthIndex > 12) {
    return 0;
  }
  
  const key = `m${monthIndex}` as MonthKey;
  return months[key] || 0;
}

/**
 * 화면 표시용 컬럼 계산
 * @param monthIndex - 기준 월 (1~12)
 * @param prev - 전년도 월별 데이터
 * @param curr - 당년도 월별 데이터
 * @param isRateRow - 비율 행 여부
 * @returns 계산된 컬럼 값
 */
export function calcCols(
  monthIndex: number,
  prev: Months,
  curr: Months,
  isRateRow: boolean
): CalcOut {
  // 범위 체크
  if (monthIndex < 1 || monthIndex > 12) {
    return {
      prevMonth: null,
      currMonth: null,
      prevYTD: null,
      currYTD: null,
      prevYearTotal: null,
      currYearTotal: null
    };
  }
  
  const prevMonth = getMonthValue(prev, monthIndex);
  const currMonth = getMonthValue(curr, monthIndex);
  
  if (isRateRow) {
    // 비율 행: 당월/전월만 세팅, 나머지는 null
    return {
      prevMonth,
      currMonth,
      prevYTD: null,
      currYTD: null,
      prevYearTotal: null,
      currYearTotal: null
    };
  } else {
    // 금액 행: 모든 컬럼 계산
    return {
      prevMonth,
      currMonth,
      prevYTD: sumMonths(prev, monthIndex),
      currYTD: sumMonths(curr, monthIndex),
      prevYearTotal: sumMonths(prev, 12),
      currYearTotal: sumMonths(curr, 12)
    };
  }
}

/**
 * 비율 행의 컬럼 계산 (분자/분모 기반)
 * 
 * @param monthIndex - 기준 월 (1~12)
 * @param prevNumer - 전년도 분자 데이터
 * @param prevDenom - 전년도 분모 데이터
 * @param currNumer - 당년도 분자 데이터
 * @param currDenom - 당년도 분모 데이터
 * @returns 계산된 비율 컬럼 값 (%)
 */
export function calcRateColsFromNumerDenom(
  monthIndex: number,
  prevNumer: Months,
  prevDenom: Months,
  currNumer: Months,
  currDenom: Months
): RateCalcOut {
  // 범위 체크
  if (monthIndex < 1 || monthIndex > 12) {
    return {
      prevMonth: 0,
      currMonth: 0,
      prevYTD: 0,
      currYTD: 0,
      prevYearTotal: 0,
      currYearTotal: 0
    };
  }
  
  // 당월 계산
  const prevNumerMonth = getMonthValue(prevNumer, monthIndex);
  const prevDenomMonth = getMonthValue(prevDenom, monthIndex);
  const currNumerMonth = getMonthValue(currNumer, monthIndex);
  const currDenomMonth = getMonthValue(currDenom, monthIndex);
  
  const prevMonth = prevDenomMonth === 0 ? 0 : (prevNumerMonth / prevDenomMonth) * 100;
  const currMonth = currDenomMonth === 0 ? 0 : (currNumerMonth / currDenomMonth) * 100;
  
  // YTD 계산
  const prevNumerYTD = sumMonths(prevNumer, monthIndex);
  const prevDenomYTD = sumMonths(prevDenom, monthIndex);
  const currNumerYTD = sumMonths(currNumer, monthIndex);
  const currDenomYTD = sumMonths(currDenom, monthIndex);
  
  const prevYTD = prevDenomYTD === 0 ? 0 : (prevNumerYTD / prevDenomYTD) * 100;
  const currYTD = currDenomYTD === 0 ? 0 : (currNumerYTD / currDenomYTD) * 100;
  
  // 연간 계산
  const prevNumerYear = sumMonths(prevNumer, 12);
  const prevDenomYear = sumMonths(prevDenom, 12);
  const currNumerYear = sumMonths(currNumer, 12);
  const currDenomYear = sumMonths(currDenom, 12);
  
  const prevYearTotal = prevDenomYear === 0 ? 0 : (prevNumerYear / prevDenomYear) * 100;
  const currYearTotal = currDenomYear === 0 ? 0 : (currNumerYear / currDenomYear) * 100;
  
  return {
    prevMonth,
    currMonth,
    prevYTD,
    currYTD,
    prevYearTotal,
    currYearTotal
  };
}

