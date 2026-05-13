'use client';

import { ReactNode, useState, useEffect, useMemo, useRef } from 'react';
import Tabs from '@/components/Tabs';
import YearTabs from '@/components/YearTabs';
import FinancialTable from '@/components/FinancialTable';
import EditableAnalysis from '@/components/EditableAnalysis';
import PLPage from '@/components/PLPage';
import InventoryPage from '@/components/InventoryPage';
import * as XLSX from 'xlsx';
import { TableRow, TabType } from '@/lib/types';
import {
  analyzeCashFlowData,
  analyzeWorkingCapitalData,
  generateCashFlowInsights,
  generateCFOQA,
} from '@/lib/analysis';
import { formatNumber, formatMillionYuan } from '@/lib/utils';

type MonthlyWcItem = {
  label: string;
  previous: number;
  plan: number;
  current: number;
  delta: number;
  remark: string;
};

type MonthlyWcSection = {
  code: string;
  currencyLabel: string;
  items: MonthlyWcItem[];
};

const MONTHLY_WC_SECTIONS: Record<'HK' | 'TW', MonthlyWcSection> = {
  HK: {
    code: 'HKMC',
    currencyLabel: 'HKD',
    items: [
      {
        label: '재고자산',
        previous: 102404,
        plan: 100652,
        current: 101734,
        delta: 1082,
        remark: '계획비 재고입고 동일(3.1m), 계획비 매출감소로 출고 △1.1m',
      },
      {
        label: '매출채권',
        previous: 435,
        plan: 435,
        current: 422,
        delta: -13,
        remark: '전월 당월 컷오프 1일로 동일',
      },
      {
        label: '매입채무',
        previous: 88676,
        plan: 86369,
        current: 85060,
        delta: -1309,
        remark: '계획비 입고동일(3.1m), 당월 계획비 상환 +1.3m',
      },
    ],
  },
  TW: {
    code: 'TW',
    currencyLabel: 'HKD',
    items: [
      {
        label: '재고자산',
        previous: 50518,
        plan: 53418,
        current: 52169,
        delta: -1249,
        remark: '계획비 재고입고 △1.9m(전월계획비 +4.6m), 계획비 매출증가로 출고 +3.1m',
      },
      {
        label: '매출채권',
        previous: 21071,
        plan: 15966,
        current: 16744,
        delta: 778,
        remark: '계획대비 매출 0.3m 감소로 매출채권 감소',
      },
      {
        label: '매입채무',
        previous: 30315,
        plan: 25279,
        current: 21485,
        delta: -3794,
        remark: '계획비 입고감소로 채무 △1.9m, 계획비 상환 +1.3m',
      },
    ],
  },
};

const CF_DEFAULT_EXPANDED_ACCOUNTS = ['영업활동'];
const BASE_SALES_YOY_RATE = 122;

function NavIcon({ kind }: { kind: 'bs' | 'pl' | 'cf' | 'inventory' | 'fund' | 'perf' }) {
  const props = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  const icons: Record<typeof kind, ReactNode> = {
    bs: (
      <>
        <path d="M4 20h16" />
        <path d="M7 20V10h3v10" />
        <path d="M14 20V5h3v15" />
      </>
    ),
    pl: (
      <>
        <path d="M4 19h16" />
        <path d="M6 15l4-4 3 2 5-6" />
      </>
    ),
    cf: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M8 12h8" />
        <path d="M13 9l3 3-3 3" />
      </>
    ),
    inventory: (
      <>
        <path d="M12 3l8 4-8 4-8-4 8-4Z" />
        <path d="M4 7v7l8 4 8-4V7" />
      </>
    ),
    fund: (
      <>
        <path d="M12 3v18" />
        <path d="M16 7.5c0-1.8-1.8-3-4-3s-4 1.2-4 3 1.8 3 4 3 4 1.2 4 3-1.8 3-4 3-4-1.2-4-3" />
      </>
    ),
    perf: (
      <>
        <path d="M4 19h16" />
        <path d="M7 16V9" />
        <path d="M12 16V5" />
        <path d="M17 16v-4" />
      </>
    ),
  };

  return <svg {...props}>{icons[kind]}</svg>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [locale, setLocale] = useState<'ko' | 'en'>('ko');
  const [bsView, setBsView] = useState<'BS' | 'PL' | 'CF' | 'INVENTORY'>('PL');
  const [reportMode, setReportMode] = useState<'FUND_MONTHLY' | 'PERFORMANCE'>('PERFORMANCE');
  const [wcYear, setWcYear] = useState<number>(2026);
  const [salesYoYRate, setSalesYoYRate] = useState<number>(BASE_SALES_YOY_RATE);
  const [workingCapitalMonthsCollapsed, setWorkingCapitalMonthsCollapsed] = useState<boolean>(true);
  const [analysisPanelWidth, setAnalysisPanelWidth] = useState<number>(320);
  const [isResizingAnalysis, setIsResizingAnalysis] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const analysisResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [wcAllRowsCollapsed, setWcAllRowsCollapsed] = useState<boolean>(true);
  const [wcStatementAllRowsCollapsed, setWcStatementAllRowsCollapsed] = useState<boolean>(true);
  const [showMonthlyWcHongKong, setShowMonthlyWcHongKong] = useState<boolean>(false);
  const [showMonthlyWcTaiwan, setShowMonthlyWcTaiwan] = useState<boolean>(false);
  const [cfData, setCfData] = useState<TableRow[] | null>(null);
  const [cfPlanData, setCfPlanData] = useState<TableRow[] | null>(null);
  const [wcStatementData, setWcStatementData] = useState<TableRow[] | null>(null);
  const [wcStatementPlanData, setWcStatementPlanData] = useState<TableRow[] | null>(null);
  
  // B/S 상태
  const [bsFinancialData, setBsFinancialData] = useState<TableRow[] | null>(null);
  const [bsPlanData, setBsPlanData] = useState<TableRow[] | null>(null);
  const [bsMonthsCollapsed, setBsMonthsCollapsed] = useState<boolean>(true);
  const [bsFinancialCollapsed, setBsFinancialCollapsed] = useState<boolean>(true);
  const [bsRemarks, setBsRemarks] = useState<Map<string, string>>(new Map());
  
  // 운전자본표 비고
  const [wcRemarks, setWcRemarks] = useState<Map<string, string>>(new Map());
  const [cfRemarks, setCfRemarks] = useState<Map<string, string>>(new Map());
  
  // PL remarks skip 로그용 (한 번만 출력)
  const [plRemarksSkipLogged, setPlRemarksSkipLogged] = useState<boolean>(false);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const effectiveView: 'BS' | 'PL' | 'CF' | 'INVENTORY' = reportMode === 'FUND_MONTHLY' ? 'CF' : bsView;
  const isEnglish = locale === 'en';

  const tabs = [isEnglish ? 'HK F/S' : '홍콩법인 F/S'];
  const tabTypes: TabType[] = ['CF'];
  const unitLabel = isEnglish ? 'Unit: 1,000 HKD' : '단위: 1,000 HKD';
  const smallUnitLabel = isEnglish ? '(Unit: 1k HKD)' : '(단위: 1k HKD)';
  const currentClosingMonth = 4;
  const headerTitle = isEnglish
    ? `FNF HK Financial Report (${String(wcYear).slice(-2)}.${currentClosingMonth})`
    : `FNF HK 재무실적보고 (${String(wcYear).slice(-2)}. ${currentClosingMonth}월)`;
  const headerSubtitle = isEnglish
    ? 'F&F finance simulation dashboard'
    : 'F&F 재무 시뮬레이션 · 롤링/계획 기준';
  const basisLabel = isEnglish
    ? `Basis: ${String(wcYear).slice(-2)}.${currentClosingMonth} reconciliation`
    : `기준월: ${wcYear}년 ${currentClosingMonth}월`;
  const toggleRowsLabel = (collapsed: boolean) => (collapsed ? (isEnglish ? 'Expand ▼' : '펼치기 ▼') : (isEnglish ? 'Collapse ▲' : '접기 ▲'));
  const toggleMonthlyLabel = (collapsed: boolean) => (collapsed ? (isEnglish ? 'Show Mo. ▶' : '월별 데이터 펼치기 ▶') : (isEnglish ? 'Hide Mo. ◀' : '월별 데이터 접기 ◀'));
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatDelta = (value: number) => `${value >= 0 ? '+' : '△'}${formatNumber(Math.abs(value))}`;
  const translateMonthlyWcLabel = (label: string) => {
    if (!isEnglish) return label;
    const map: Record<string, string> = {
      재고자산: 'Inventory',
      매출채권: 'Accounts Receivable',
      매입채무: 'Accounts Payable',
      '운전자본 합계': 'Working Capital Total',
      합계: 'Total',
    };
    return map[label] ?? label;
  };
  const translateExportAccount = (label: string) => {
    if (!isEnglish) return label;
    const map: Record<string, string> = {
      영업활동: 'Operating Activities',
      입금: 'Receipts',
      매출수금: 'Sales Receipts',
      지출: 'Outflows',
      비용: 'Expenses',
      기타: 'Other',
      자산성지출: 'Capex',
      순현금흐름: 'Net Cash Flow',
      현금잔액: 'Cash Balance',
      잔액: 'Balance',
      기말잔액: 'Ending Balance',
      홍콩마카오: 'Hong Kong & Macau',
      대만: 'Taiwan',
      물품대: 'Merchandise Payment',
      매장임차료: 'Store Rent',
      재고자산: 'Inventory',
      매출채권: 'Accounts Receivable',
      매입채무: 'Accounts Payable',
      운전자본합계: 'Working Capital Total',
      '운전자본 합계': 'Working Capital Total',
      전월대비: 'MoM',
      전년대비: 'YoY',
      합계: 'Total',
    };
    return map[label] ?? translateMonthlyWcLabel(label);
  };
  const translateDashboardRemark = (value: string) => {
    if (!isEnglish || !value) return value;
    return value
      .replace(
        /계획비 재고입고 동일\(3\.1m\), 계획비 매출감소로 출고 △1\.1m/g,
        'vs plan inventory inbound same (3.1m), vs plan sales decrease reduced outbound by △1.1m',
      )
      .replace(
        /계획비 재고입고 △1\.9m\(전월계획비 \+4\.6m\), 계획비 매출증가로 출고 \+3\.1m/g,
        'vs plan inventory inbound △1.9m (previous plan +4.6m), vs plan sales increase drove outbound +3.1m',
      )
      .replace(
        /전월 당월 컷오프 1일로 동일/g,
        'previous month and current month cutoff are both 1 day',
      )
      .replace(
        /계획대비 매출 0\.3m 감소로 매출채권 감소/g,
        'vs plan sales decreased by 0.3m, reducing accounts receivable',
      )
      .replace(
        /계획비 입고동일\(3\.1m\), 당월 계획비 상환 \+1\.3m/g,
        'vs plan inbound same (3.1m), current month vs plan repayment +1.3m',
      )
      .replace(
        /계획비 입고감소로 채무 △1\.9m, 계획비 상환 \+1\.3m/g,
        'vs plan inbound decrease reduced payables by △1.9m, vs plan repayment +1.3m',
      )
      .replace(/홍콩 매장 2개 오픈 \(리테일1, 아울렛1\)/g, 'Hong Kong 2 store openings (Retail 1, Outlet 1)')
      .replace(/매출 수금증가/g, 'sales collection increase')
      .replace(/연간매출/g, 'annual sales')
      .replace(/계획대비/g, 'vs plan')
      .replace(/입고동일/g, 'inbound same')
      .replace(/입고감소/g, 'inbound decrease')
      .replace(/8개월/g, '8 months')
      .replace(/5개월/g, '5 months')
      .replace(/1.5개월/g, '1.5 months')
      .replace(/4개월/g, '4 months')
      .replace(/연말/g, 'year-end')
      .replace(/전체평균/g, 'average')
      .replace(/리테일/g, 'Retail')
      .replace(/아울렛/g, 'Outlet')
      .replace(/홍콩/g, 'Hong Kong')
      .replace(/대만/g, 'Taiwan')
      .replace(/전월계획비/g, 'vs previous plan')
      .replace(/계획비/g, 'vs plan')
      .replace(/전월/g, 'previous month')
      .replace(/당월/g, 'current month')
      .replace(/컷오프/g, 'cutoff')
      .replace(/동일/g, 'same')
      .replace(/(\d+)일로/g, '$1-day ')
      .replace(/감소로/g, 'decrease, ')
      .replace(/증가로/g, 'increase, ')
      .replace(/입고감소/g, 'inbound decrease')
      .replace(/입고증가/g, 'inbound increase')
      .replace(/재고입고/g, 'inventory inbound')
      .replace(/매출감소/g, 'sales decrease')
      .replace(/매출증가/g, 'sales increase')
      .replace(/매출채권/g, 'accounts receivable')
      .replace(/감소/g, 'decrease')
      .replace(/증가/g, 'increase')
      .replace(/출고/g, 'outbound')
      .replace(/채무/g, 'payables')
      .replace(/상환/g, 'repayment')
      .replace(/합계/g, 'total');
  };
  const isPayableLabel = (label: string) => label === '매입채무';
  const formatMonthlyWcAmount = (label: string, value: number) =>
    isPayableLabel(label) ? `(${formatNumber(Math.abs(value))})` : formatNumber(value);
  const getMonthlyWcAmountClass = (label: string) => (isPayableLabel(label) ? 'text-red-600' : '');
  const getSignedMonthlyWcValue = (label: string, value: number) => (isPayableLabel(label) ? -value : value);
  const calculateMonthlyWcTotal = (items: MonthlyWcItem[]) => {
    const previous = items.reduce((sum, item) => sum + getSignedMonthlyWcValue(item.label, item.previous), 0);
    const plan = items.reduce((sum, item) => sum + getSignedMonthlyWcValue(item.label, item.plan), 0);
    const current = items.reduce((sum, item) => sum + getSignedMonthlyWcValue(item.label, item.current), 0);
    return {
      previous,
      plan,
      current,
      delta: current - plan,
    };
  };
  const hkMonthlyWcTotal = calculateMonthlyWcTotal(MONTHLY_WC_SECTIONS.HK.items);
  const twMonthlyWcTotal = calculateMonthlyWcTotal(MONTHLY_WC_SECTIONS.TW.items);
  const monthlyWcCombinedItems: MonthlyWcItem[] = [
    {
      label: '재고자산',
      previous: MONTHLY_WC_SECTIONS.HK.items[0].previous + MONTHLY_WC_SECTIONS.TW.items[0].previous,
      plan: MONTHLY_WC_SECTIONS.HK.items[0].plan + MONTHLY_WC_SECTIONS.TW.items[0].plan,
      current: MONTHLY_WC_SECTIONS.HK.items[0].current + MONTHLY_WC_SECTIONS.TW.items[0].current,
      delta: MONTHLY_WC_SECTIONS.HK.items[0].delta + MONTHLY_WC_SECTIONS.TW.items[0].delta,
      remark: `홍콩 ${MONTHLY_WC_SECTIONS.HK.items[0].remark} / 대만 ${MONTHLY_WC_SECTIONS.TW.items[0].remark}`,
    },
    {
      label: '매출채권',
      previous: MONTHLY_WC_SECTIONS.HK.items[1].previous + MONTHLY_WC_SECTIONS.TW.items[1].previous,
      plan: MONTHLY_WC_SECTIONS.HK.items[1].plan + MONTHLY_WC_SECTIONS.TW.items[1].plan,
      current: MONTHLY_WC_SECTIONS.HK.items[1].current + MONTHLY_WC_SECTIONS.TW.items[1].current,
      delta: MONTHLY_WC_SECTIONS.HK.items[1].delta + MONTHLY_WC_SECTIONS.TW.items[1].delta,
      remark: `홍콩 ${MONTHLY_WC_SECTIONS.HK.items[1].remark} / 대만 ${MONTHLY_WC_SECTIONS.TW.items[1].remark}`,
    },
    {
      label: '매입채무',
      previous: MONTHLY_WC_SECTIONS.HK.items[2].previous + MONTHLY_WC_SECTIONS.TW.items[2].previous,
      plan: MONTHLY_WC_SECTIONS.HK.items[2].plan + MONTHLY_WC_SECTIONS.TW.items[2].plan,
      current: MONTHLY_WC_SECTIONS.HK.items[2].current + MONTHLY_WC_SECTIONS.TW.items[2].current,
      delta: MONTHLY_WC_SECTIONS.HK.items[2].delta + MONTHLY_WC_SECTIONS.TW.items[2].delta,
      remark: `홍콩 ${MONTHLY_WC_SECTIONS.HK.items[2].remark} / 대만 ${MONTHLY_WC_SECTIONS.TW.items[2].remark}`,
    },
  ];
  const monthlyWcCombined = {
    previous: hkMonthlyWcTotal.previous + twMonthlyWcTotal.previous,
    plan: hkMonthlyWcTotal.plan + twMonthlyWcTotal.plan,
    current: hkMonthlyWcTotal.current + twMonthlyWcTotal.current,
    delta: hkMonthlyWcTotal.delta + twMonthlyWcTotal.delta,
  };

  const renderMonthlyWorkingCapitalSection = () => {
    const renderTable = (title: string, section: MonthlyWcSection) => (
      <div className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
        <div className="border-b border-gray-300 bg-white px-4 py-3">
          <div className="font-semibold text-gray-800">{title}</div>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#34589a] text-white">
              <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'Division' : '구분'}</th>
              <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'Account' : '계정'}</th>
              <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'Prev.' : '전월'}</th>
              <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'Plan' : '계획'}</th>
              <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'Current' : '당월'}</th>
              <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'vs Plan' : '계획비'}</th>
              <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'Remarks' : '비고'}</th>
            </tr>
          </thead>
          <tbody>
            {section.items.map((item, index) => (
              <tr key={`${section.code}-${item.label}`} className="bg-[#d9edf9]">
                {index === 0 && (
                  <td rowSpan={section.items.length + 1} className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-800 align-middle">
                    <div>{section.code}</div>
                    <div>{section.currencyLabel}</div>
                  </td>
                )}
                <td className="border border-gray-300 px-3 py-2 font-medium text-gray-800">{translateMonthlyWcLabel(item.label)}</td>
                <td className={`border border-gray-300 px-3 py-2 text-right ${getMonthlyWcAmountClass(item.label)}`}>{formatMonthlyWcAmount(item.label, item.previous)}</td>
                <td className={`border border-gray-300 px-3 py-2 text-right ${getMonthlyWcAmountClass(item.label)}`}>{formatMonthlyWcAmount(item.label, item.plan)}</td>
                <td className={`border border-gray-300 px-3 py-2 text-right ${getMonthlyWcAmountClass(item.label)}`}>{formatMonthlyWcAmount(item.label, item.current)}</td>
                <td className={`border border-gray-300 px-3 py-2 text-right ${item.delta >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatDelta(item.delta)}</td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700">{translateDashboardRemark(item.remark)}</td>
              </tr>
            ))}
            <tr className="bg-[#f2f2f2] font-semibold text-gray-900">
              <td className="border border-gray-300 px-3 py-2">{isEnglish ? 'Total' : '합계'}</td>
              <td className="border border-gray-300 px-3 py-2 text-right">{formatNumber(calculateMonthlyWcTotal(section.items).previous)}</td>
              <td className="border border-gray-300 px-3 py-2 text-right">{formatNumber(calculateMonthlyWcTotal(section.items).plan)}</td>
              <td className="border border-gray-300 px-3 py-2 text-right">{formatNumber(calculateMonthlyWcTotal(section.items).current)}</td>
              <td className={`border border-gray-300 px-3 py-2 text-right ${calculateMonthlyWcTotal(section.items).delta >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatDelta(calculateMonthlyWcTotal(section.items).delta)}</td>
              <td className="border border-gray-300 px-3 py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>
    );

    return (
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">{isEnglish ? 'Current Month Working Capital' : '당월 운전자본'}</h3>
            <p className="text-sm text-gray-500">{smallUnitLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowMonthlyWcHongKong((prev) => !prev)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              {showMonthlyWcHongKong ? (isEnglish ? 'Hide Hong Kong ▲' : '홍콩 접기 ▲') : (isEnglish ? 'Show Hong Kong ▼' : '홍콩 펼치기 ▼')}
            </button>
            <button
              type="button"
              onClick={() => setShowMonthlyWcTaiwan((prev) => !prev)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              {showMonthlyWcTaiwan ? (isEnglish ? 'Hide Taiwan ▲' : '대만 접기 ▲') : (isEnglish ? 'Show Taiwan ▼' : '대만 펼치기 ▼')}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#34589a] text-white">
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'Account' : '계정과목'}</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'Prev.' : '전월'}</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'Plan' : '계획'}</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'Current' : '당월'}</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'vs Plan' : '계획비'}</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold">{isEnglish ? 'Remarks' : '비고'}</th>
              </tr>
            </thead>
            <tbody>
              {monthlyWcCombinedItems.map((item) => (
                <tr key={`combined-${item.label}`} className="bg-[#d9edf9] text-gray-900">
                  <td className="border border-gray-300 px-3 py-2 font-medium">{translateMonthlyWcLabel(item.label)}</td>
                  <td className={`border border-gray-300 px-3 py-2 text-right ${getMonthlyWcAmountClass(item.label)}`}>{formatMonthlyWcAmount(item.label, item.previous)}</td>
                  <td className={`border border-gray-300 px-3 py-2 text-right ${getMonthlyWcAmountClass(item.label)}`}>{formatMonthlyWcAmount(item.label, item.plan)}</td>
                  <td className={`border border-gray-300 px-3 py-2 text-right ${getMonthlyWcAmountClass(item.label)}`}>{formatMonthlyWcAmount(item.label, item.current)}</td>
                  <td className={`border border-gray-300 px-3 py-2 text-right ${item.delta >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatDelta(item.delta)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700">{translateDashboardRemark(item.remark)}</td>
                </tr>
              ))}
              <tr className="bg-[#fbf6dd] font-semibold text-gray-900">
                <td className="border border-gray-300 px-3 py-2">{isEnglish ? 'Working Capital Total' : '운전자본 합계'}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{formatNumber(monthlyWcCombined.previous)}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{formatNumber(monthlyWcCombined.plan)}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{formatNumber(monthlyWcCombined.current)}</td>
                <td className={`border border-gray-300 px-3 py-2 text-right ${monthlyWcCombined.delta >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatDelta(monthlyWcCombined.delta)}</td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700">
                  {isEnglish ? 'Hong Kong total' : '홍콩 합계'} {hkMonthlyWcTotal.delta >= 0 ? '+' : '△'}{formatNumber(Math.abs(hkMonthlyWcTotal.delta))} / {isEnglish ? 'Taiwan total' : '대만 합계'} {twMonthlyWcTotal.delta >= 0 ? '+' : '△'}{formatNumber(Math.abs(twMonthlyWcTotal.delta))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-4">
          {showMonthlyWcHongKong && renderTable(isEnglish ? 'Hong Kong' : '홍콩', MONTHLY_WC_SECTIONS.HK)}
          {showMonthlyWcTaiwan && renderTable(isEnglish ? 'Taiwan' : '대만', MONTHLY_WC_SECTIONS.TW)}
        </div>
      </div>
    );
  };

  const startAnalysisResize = (event: React.MouseEvent<HTMLDivElement>) => {
    analysisResizeRef.current = { startX: event.clientX, startWidth: analysisPanelWidth };
    setIsResizingAnalysis(true);
    event.preventDefault();
  };

  useEffect(() => {
    if (!isResizingAnalysis) return;

    const onMouseMove = (event: MouseEvent) => {
      if (!analysisResizeRef.current) return;
      const { startX, startWidth } = analysisResizeRef.current;
      const nextWidth = startWidth + (startX - event.clientX);
      const clamped = Math.max(168, Math.min(Math.floor(window.innerWidth * 0.4), nextWidth));
      setAnalysisPanelWidth(clamped);
    };

    const onMouseUp = () => {
      setIsResizingAnalysis(false);
      analysisResizeRef.current = null;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingAnalysis, analysisPanelWidth]);

  // 데이터 로딩: 현금흐름표=CF 폴더, 운전자본표=운전자본 폴더
  const loadData = async (type: TabType, year?: number) => {
    setLoading(true);
    setError(null);

    try {
      let url = '';
      if (type === 'CF') {
        url = `/api/fs/cf?year=${year}&mode=rolling`;
      } else if (type === 'WORKING_CAPITAL_STATEMENT') {
        url = `/api/fs/working-capital-statement?year=${year}&mode=rolling`;
      }

      if (!url) return;

      const response = await fetch(url, { cache: 'no-store' });
      const result = await response.json();

      if (!response.ok) {
        const message = result?.error || '데이터를 불러올 수 없습니다.';
        throw new Error(message);
      }

      if (type === 'CF') {
        setCfData(result.rows);
        if (year === 2026) {
          const planResponse = await fetch(`/api/fs/cf?year=${year}&mode=plan`, { cache: 'no-store' });
          const planResult = await planResponse.json();
          if (planResponse.ok) {
            setCfPlanData(planResult.rows);
          }
        } else {
          setCfPlanData(null);
        }
      } else if (type === 'WORKING_CAPITAL_STATEMENT') {
        setWcStatementData(result.rows);
        if (year === 2026) {
          const planResponse = await fetch(`/api/fs/working-capital-statement?year=${year}&mode=plan`, { cache: 'no-store' });
          const planResult = await planResponse.json();
          if (planResponse.ok) {
            setWcStatementPlanData(planResult.rows);
          }
        } else {
          setWcStatementPlanData(null);
        }
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // B/S 데이터 로딩
  const loadBSData = async (year: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/fs/bs?year=${year}&mode=rolling`);
      const result = await response.json();

      if (!response.ok) {
        const message = result?.error || 'B/S 데이터를 불러올 수 없습니다.';
        throw new Error(message);
      }

      setBsFinancialData(result.financialPosition);
      if (year === 2026) {
        const planResponse = await fetch(`/api/fs/bs?year=${year}&mode=plan`, { cache: 'no-store' });
        const planResult = await planResponse.json();
        if (planResponse.ok) {
          setBsPlanData(planResult.financialPosition);
        } else {
          setBsPlanData(null);
        }
      } else {
        setBsPlanData(null);
      }
      
      // 비고 데이터 로드
      await loadBSRemarks();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'B/S 데이터를 불러오는데 실패했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // B/S 비고 로드
  const loadBSRemarks = async () => {
    // PL 뷰에서는 비활성화
    if (effectiveView === 'PL') {
      if (!plRemarksSkipLogged) {
        console.log('remarks skipped (PL)');
        setPlRemarksSkipLogged(true);
      }
      return;
    }
    
    try {
      const response = await fetch('/api/remarks?type=BS');
      const result = await response.json();
      
      if (response.ok && result.remarks) {
        const remarksMap = new Map<string, string>(Object.entries(result.remarks));
        setBsRemarks(remarksMap);
      }
    } catch (err) {
      console.error('비고 로드 에러:', err);
    }
  };

  // B/S 비고 저장 (debounce)
  const saveBSRemark = async (account: string, remark: string) => {
    // PL 뷰에서는 비활성화
    if (effectiveView === 'PL') {
      return;
    }
    
    try {
      await fetch('/api/remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, remark, type: 'BS' }),
      });
      
      // 로컬 상태 업데이트
      setBsRemarks(prev => {
        const newMap = new Map(prev);
        newMap.set(account, remark);
        return newMap;
      });
    } catch (err) {
      console.error('비고 저장 에러:', err);
    }
  };

  // 운전자본표 비고 로드
  const loadCFRemarks = async () => {
    if (effectiveView === 'PL') {
      if (!plRemarksSkipLogged) {
        console.log('remarks skipped (PL)');
        setPlRemarksSkipLogged(true);
      }
      return;
    }

    try {
      const response = await fetch('/api/remarks?type=cf');
      const result = await response.json();

      if (response.ok) {
        const remarksMap = new Map<string, string>(Object.entries(result.remarks ?? {}));
        setCfRemarks(remarksMap);
      }
    } catch (err) {
      console.error('CF remarks load error:', err);
    }
  };

  const saveCFRemark = async (account: string, remark: string) => {
    if (effectiveView === 'PL') {
      return;
    }

    try {
      await fetch('/api/remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, remark, type: 'cf' }),
      });

      setCfRemarks(prev => {
        const newMap = new Map(prev);
        newMap.set(account, remark);
        return newMap;
      });
    } catch (err) {
      console.error('CF remarks save error:', err);
    }
  };

  const loadWCRemarks = async () => {
    // P/L 뷰에서는 비활성화
    if (effectiveView === 'PL') {
      if (!plRemarksSkipLogged) {
        console.log('remarks skipped (PL)');
        setPlRemarksSkipLogged(true);
      }
      return;
    }
    
    try {
      const response = await fetch('/api/remarks?type=wc');
      const result = await response.json();

      if (response.ok) {
        const remarksMap = new Map<string, string>(Object.entries(result.remarks ?? {}));
        setWcRemarks(remarksMap);
        return;
      }
      
      if (response.ok && result.remarks) {
        const remarksMap = new Map<string, string>(Object.entries(result.remarks));
        
        // 기본 비고 내용 설정 (비어있는 항목만)
        const defaultRemarks: { [key: string]: string } = {
          '매출채권': '매출채권의 전년 대비 △1,572 K HKD 감소하여 현금 유입에 기여. 연중 굿해치게 개선되어 구조적 변화로 판단.',
          '재고자산': '재고자산의 △46,935 K HKD 감소하여 현금 유입 기여. 264월 재고자산 122M 수준으로 Target 달성 (재고일수 개선), 연금출로 매입채무 상환 및 리스료 수준 유지.',
          '매입채무': '매입채무가 +22,718K HKD 감소하여 현금 유출 요인. 본사 물품대재무 추가 상환으로 연세료 감소 발생.'
        };
        
        // 기존 비고가 없는 항목에만 기본값 설정
        for (const [key, value] of Object.entries(defaultRemarks)) {
          if (!remarksMap.has(key)) {
            remarksMap.set(key, value);
            // 각 항목을 개별적으로 저장
            try {
              await fetch('/api/remarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account: key, remark: value, type: 'wc' }),
              });
            } catch (saveErr) {
              console.error(`비고 저장 실패 (${key}):`, saveErr);
            }
          }
        }
        
        setWcRemarks(remarksMap);
      }
    } catch (err) {
      console.error('운전자본표 비고 로드 에러:', err);
    }
  };

  // 운전자본표 비고 저장
  const saveWCRemark = async (account: string, remark: string) => {
    // PL 뷰에서는 비활성화
    if (effectiveView === 'PL') {
      return;
    }
    
    try {
      await fetch('/api/remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, remark, type: 'wc' }),
      });
      
      // 로컬 상태 업데이트
      setWcRemarks(prev => {
        const newMap = new Map(prev);
        newMap.set(account, remark);
        return newMap;
      });
    } catch (err) {
      console.error('운전자본표 비고 저장 에러:', err);
    }
  };

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab === 0) {
      if (effectiveView === 'CF') {
      if (!cfData) loadData('CF', wcYear);
        if (cfRemarks.size === 0) {
          loadCFRemarks();
        }
        if (!wcStatementData) {
          loadData('WORKING_CAPITAL_STATEMENT', wcYear).then(() => {
            loadWCRemarks();
          });
        } else if (wcRemarks.size === 0) {
          loadWCRemarks();
        }
      } else if (effectiveView === 'BS') {
        if (!bsFinancialData) loadBSData(wcYear);
        if (!wcStatementData) {
          loadData('WORKING_CAPITAL_STATEMENT', wcYear).then(() => {
            loadWCRemarks();
          });
        } else if (wcRemarks.size === 0) {
          loadWCRemarks();
        }
      } else if (effectiveView === 'PL') {
        // PL 뷰: WC 데이터 로드하지 않음
      }
    }
  }, [activeTab, effectiveView]);

  useEffect(() => {
    if (activeTab === 0) {
      if (effectiveView === 'CF') {
      loadData('CF', wcYear);
        loadCFRemarks();
        loadData('WORKING_CAPITAL_STATEMENT', wcYear).then(() => {
          loadWCRemarks();
        });
      } else if (effectiveView === 'BS') {
        loadBSData(wcYear);
        loadData('WORKING_CAPITAL_STATEMENT', wcYear).then(() => {
          loadWCRemarks();
        });
      } else if (effectiveView === 'PL') {
        // PL 뷰: WC 데이터 로드하지 않음
      }
    }
  }, [wcYear]);

  // PL 뷰로 전환 시 remarks skip 로그 플래그 리셋
  useEffect(() => {
    if (effectiveView === 'PL') {
      setPlRemarksSkipLogged(false);
    }
  }, [effectiveView]);

  // 월 컬럼 (1~4월 실적, 5~12월 계획)
  const monthColumns = [
    isEnglish ? 'Account' : '계정과목',
    isEnglish ? 'Jan (Act)' : '1월(실적)',
    isEnglish ? 'Feb (Act)' : '2월(실적)',
    isEnglish ? 'Mar (Act)' : '3월(실적)',
    isEnglish ? 'Apr (Act)' : '4월(실적)',
    isEnglish ? 'May (Plan)' : '5월(계획)',
    isEnglish ? 'Jun (Plan)' : '6월(계획)',
    isEnglish ? 'Jul (Plan)' : '7월(계획)',
    isEnglish ? 'Aug (Plan)' : '8월(계획)',
    isEnglish ? 'Sep (Plan)' : '9월(계획)',
    isEnglish ? 'Oct (Plan)' : '10월(계획)',
    isEnglish ? 'Nov (Plan)' : '11월(계획)',
    isEnglish ? 'Dec (Plan)' : '12월(계획)',
  ];

  const adjustedCfData = useMemo(() => {
    if (!cfData || wcYear !== 2026) return cfData;

    const delta = (salesYoYRate - BASE_SALES_YOY_RATE) / 100;
    if (delta === 0) return cfData;

    const ACC_OPERATING = '\uC601\uC5C5\uD65C\uB3D9';
    const ACC_INFLOW = '\uC785\uAE08';
    const ACC_OUTFLOW = '\uC9C0\uCD9C';
    const ACC_COST = '\uBE44\uC6A9';
    const ACC_SALES_RECEIPT = '\uB9E4\uCD9C\uC218\uAE08';
    const ACC_GOODS_PAYMENT = '\uBB3C\uD488\uB300';
    const ACC_STORE_RENT = '\uB9E4\uC7A5 \uC784\uCC28\uB8CC';
    const ACC_HK = '\uD64D\uCF69\uB9C8\uCE74\uC624';
    const ACC_TW = '\uB300\uB9CC';
    const ACC_CASH_BALANCE = '\uD604\uAE08\uC794\uC561';
    const ACC_BALANCE = '\uC794\uC561';
    const ACC_END_BALANCE = '\uAE30\uB9D0\uC794\uC561';
    const norm = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, '').trim();
    const isNetCashAccount = (v: string | null | undefined) => {
      const n = norm(v);
      return n === 'NetCash' || n.includes('\uC21C\uD604\uAE08') || n.includes('\uC21C\uD604\uAE08\uD750\uB984');
    };

    const clonedRows: TableRow[] = cfData.map((row) => ({
      ...row,
      values: [...row.values],
    }));

    const hkNetDeltaByMonth = new Array(12).fill(0);
    const twNetDeltaByMonth = new Array(12).fill(0);
    const hkAdjustedSalesByMonth = new Array(12).fill(0);
    const twSalesFactorByMonth = new Array(12).fill(1);
    const parentByLevel: string[] = [];

    clonedRows.forEach((row) => {
      parentByLevel[row.level] = row.account;
      parentByLevel.length = row.level + 1;

      const inSalesReceiptPath =
        row.level >= 3 &&
        norm(parentByLevel[0]) === norm(ACC_OPERATING) &&
        norm(parentByLevel[1]) === norm(ACC_INFLOW) &&
        norm(parentByLevel[2]) === norm(ACC_SALES_RECEIPT);

      if (inSalesReceiptPath) {
        let factor: number | null = null;
        if (norm(row.account) === norm(ACC_HK)) factor = 1 + delta;
        if (norm(row.account) === norm(ACC_TW)) factor = 1 + (delta * 0.8);
        if (factor === null) return;

        for (let monthIdx = 4; monthIdx <= 11; monthIdx++) {
          const current = row.values[monthIdx];
          if (typeof current !== 'number') continue;

          const updated = current * factor;
          const diff = updated - current;
          row.values[monthIdx] = updated;

          if (norm(row.account) === norm(ACC_HK)) {
            hkAdjustedSalesByMonth[monthIdx] = updated;
            hkNetDeltaByMonth[monthIdx] += diff;
          }
          if (norm(row.account) === norm(ACC_TW)) {
            twSalesFactorByMonth[monthIdx] = factor;
            twNetDeltaByMonth[monthIdx] += diff;
          }
        }
      }

      const level1 = norm(parentByLevel[1]);
      const inHongKongRentPath =
        row.level >= 3 &&
        norm(parentByLevel[0]) === norm(ACC_OPERATING) &&
        (level1 === norm(ACC_OUTFLOW) || level1 === norm(ACC_COST)) &&
        norm(parentByLevel[2]) === norm(ACC_HK) &&
        norm(row.account) === norm(ACC_STORE_RENT);

      if (inHongKongRentPath) {
        for (let monthIdx = 4; monthIdx <= 11; monthIdx++) {
          const current = row.values[monthIdx];
          const adjustedSales = hkAdjustedSalesByMonth[monthIdx];
          if (typeof current !== 'number' || adjustedSales <= 0) continue;

          const fixedMinimumRent = Math.abs(current);
          const variableRentBySales = adjustedSales * 0.2;
          const adjustedRentAbs = Math.max(fixedMinimumRent, variableRentBySales);
          const updatedRent = -adjustedRentAbs;
          const diff = updatedRent - current;

          row.values[monthIdx] = updatedRent;
          hkNetDeltaByMonth[monthIdx] += diff;
        }
      }

      const inTaiwanRentPath =
        row.level >= 3 &&
        norm(parentByLevel[0]) === norm(ACC_OPERATING) &&
        (level1 === norm(ACC_OUTFLOW) || level1 === norm(ACC_COST)) &&
        norm(parentByLevel[2]) === norm(ACC_TW) &&
        norm(row.account) === norm(ACC_STORE_RENT);

      if (inTaiwanRentPath) {
        for (let monthIdx = 4; monthIdx <= 11; monthIdx++) {
          const current = row.values[monthIdx];
          if (typeof current !== 'number') continue;

          const factor = twSalesFactorByMonth[monthIdx];
          if (factor <= 0) continue;

          const updatedRent = current * factor;
          const diff = updatedRent - current;

          row.values[monthIdx] = updatedRent;
          twNetDeltaByMonth[monthIdx] += diff;
        }
      }
    });

    // 물품대 지출을 버퍼로 사용해 현금잔액(기준 115%)이 유지되도록 월별 증감 상쇄
    parentByLevel.length = 0;
    clonedRows.forEach((row) => {
      parentByLevel[row.level] = row.account;
      parentByLevel.length = row.level + 1;

      const inGoodsPaymentPath =
        row.level >= 3 &&
        norm(parentByLevel[0]) === norm(ACC_OPERATING) &&
        norm(parentByLevel[1]) === norm(ACC_OUTFLOW) &&
        norm(parentByLevel[2]) === norm(ACC_GOODS_PAYMENT) &&
        (norm(row.account) === norm(ACC_HK) || norm(row.account) === norm(ACC_TW));

      if (!inGoodsPaymentPath) return;

      const deltaByMonth = norm(row.account) === norm(ACC_HK) ? hkNetDeltaByMonth : twNetDeltaByMonth;

      for (let monthIdx = 4; monthIdx <= 11; monthIdx++) {
        const current = row.values[monthIdx];
        if (typeof current !== 'number') continue;

        const offset = deltaByMonth[monthIdx];
        if (offset === 0) continue;

        // 순증감(offset)을 반대로 적용해 해당 월 현금 증감을 0으로 맞춤
        const updated = current - offset;
        const diff = updated - current;
        row.values[monthIdx] = updated;
        deltaByMonth[monthIdx] += diff;
      }
    });

    const toCumulative = (arr: number[]): number[] => {
      const result = new Array(arr.length).fill(0);
      let running = 0;
      for (let i = 0; i < arr.length; i++) {
        running += arr[i];
        result[i] = running;
      }
      return result;
    };

    const hkCumulative = toCumulative(hkNetDeltaByMonth);
    const twCumulative = toCumulative(twNetDeltaByMonth);

    parentByLevel.length = 0;
    clonedRows.forEach((row) => {
      parentByLevel[row.level] = row.account;
      parentByLevel.length = row.level + 1;

      const inCashBalancePath =
        row.level >= 3 &&
        norm(parentByLevel[0]) === norm(ACC_CASH_BALANCE) &&
        norm(parentByLevel[1]) === norm(ACC_BALANCE) &&
        norm(parentByLevel[2]) === norm(ACC_END_BALANCE) &&
        (norm(row.account) === norm(ACC_HK) || norm(row.account) === norm(ACC_TW));

      if (!inCashBalancePath) return;

      const cumulative = norm(row.account) === norm(ACC_HK) ? hkCumulative : twCumulative;
      for (let monthIdx = 4; monthIdx <= 11; monthIdx++) {
        const current = row.values[monthIdx];
        if (typeof current === 'number') {
          row.values[monthIdx] = current + cumulative[monthIdx];
        }
      }
    });

    for (let i = clonedRows.length - 1; i >= 0; i--) {
      const row = clonedRows[i];
      if (!row.isGroup) continue;

      const summed = new Array(row.values.length).fill(0);
      for (let j = i + 1; j < clonedRows.length; j++) {
        const child = clonedRows[j];
        if (child.level <= row.level) break;
        if (child.level !== row.level + 1) continue;

        for (let k = 0; k < summed.length; k++) {
          const value = child.values[k];
          summed[k] += typeof value === 'number' ? value : 0;
        }
      }
      row.values = summed;
    }

    clonedRows.forEach((row) => {
      if (row.values.length < 13) return;
      const annual = norm(row.account) === norm(ACC_CASH_BALANCE)
        ? (typeof row.values[11] === 'number' ? row.values[11] : 0)
        : row.values
            .slice(0, 12)
            .reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);
      row.values[12] = annual;

      if (row.values.length >= 14 && row.year2024Value !== null && row.year2024Value !== undefined) {
        row.values[13] = annual - row.year2024Value;
      }
    });

    const netCashRow = clonedRows.find((r) => r.level === 0 && isNetCashAccount(r.account));

    if (netCashRow) {
      const operatingRow = clonedRows.find((r) => r.level === 0 && norm(r.account) === norm(ACC_OPERATING));
      const capexRow = clonedRows.find((r) => r.level === 0 && norm(r.account) === norm('\uC790\uC0B0\uC131\uC9C0\uCD9C'));
      const otherRow = clonedRows.find(
        (r) => r.level === 0 && (norm(r.account) === norm('\uAE30\uD0C0\uC218\uC775') || norm(r.account) === norm('\uAE30\uD0C0'))
      );

      for (let i = 0; i < netCashRow.values.length; i++) {
        const op = operatingRow?.values[i];
        const capex = capexRow?.values[i];
        const other = otherRow?.values[i];
        netCashRow.values[i] =
          (typeof op === 'number' ? op : 0) +
          (typeof capex === 'number' ? capex : 0) +
          (typeof other === 'number' ? other : 0);
      }

      if (netCashRow.values.length >= 14 && netCashRow.year2024Value !== null && netCashRow.year2024Value !== undefined) {
        const annual = netCashRow.values[12];
        netCashRow.values[13] = (typeof annual === 'number' ? annual : 0) - netCashRow.year2024Value;
      }
    }

    // 1~4월은 실적 고정: 슬라이더 영향 완전 차단
    for (let i = 0; i < clonedRows.length; i++) {
      const source = cfData[i];
      if (!source) continue;
      if (typeof source.values[0] === 'number') clonedRows[i].values[0] = source.values[0];
      if (typeof source.values[1] === 'number') clonedRows[i].values[1] = source.values[1];
      if (typeof source.values[2] === 'number') clonedRows[i].values[2] = source.values[2];
      if (typeof source.values[3] === 'number') clonedRows[i].values[3] = source.values[3];
    }

    return clonedRows;
  }, [cfData, wcYear, salesYoYRate]);

  const cfDataForView = adjustedCfData ?? cfData;

  const adjustedWcStatementData = useMemo(() => {
    if (!wcStatementData || wcYear !== 2026) return wcStatementData;

    const delta = (salesYoYRate - BASE_SALES_YOY_RATE) / 100;

    const AR_SENSITIVITY = 1 - 0.2; // 매출 증감률의 80%만 매출채권에 반영
    const COGS_RATE = 0.43; // 2025년 연간 매출원가율
    const norm = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, '').trim();
    const ACC_AR = '매출채권';
    const ACC_TW = '대만';
    const ACC_OPERATING = '영업활동';
    const ACC_INFLOW = '입금';
    const ACC_SALES_RECEIPT = '매출수금';
    const ACC_HK = '홍콩마카오';
    const ACC_INVENTORY = '재고자산';
    const ACC_OUTFLOW = '지출';
    const ACC_GOODS_PAYMENT = '물품대';
    const ACC_AP = '매입채무';
    const ACC_WC_TOTAL = '운전자본합계';
    const ACC_MOM = '전년대비';

    const clonedRows: TableRow[] = wcStatementData.map((row) => ({
      ...row,
      values: [...row.values],
    }));

    const recalcEndingAndYoy = (row: TableRow) => {
      if (row.values.length < 13) return;
      const endingValue = typeof row.values[11] === 'number' ? row.values[11] : 0;
      row.values[12] = endingValue;
      if (row.values.length >= 14 && row.year2024Value !== null && row.year2024Value !== undefined) {
        row.values[13] = endingValue - row.year2024Value;
      }
    };

    const findBsEndingValue = (rows: TableRow[] | null, account: string): number | null => {
      if (!rows) return null;

      for (const row of rows) {
        if (norm(row.account) === norm(account)) {
          const endingValue = row.values[13];
          return typeof endingValue === 'number' ? endingValue : null;
        }

        if (row.children) {
          const childMatch = findBsEndingValue(row.children, account);
          if (childMatch !== null) return childMatch;
        }
      }

      return null;
    };

    const totalSalesDeltaByMonth = new Array(12).fill(0);
    if (cfData) {
      const cfParentByLevel: string[] = [];
      cfData.forEach((row) => {
        cfParentByLevel[row.level] = row.account;
        cfParentByLevel.length = row.level + 1;

        const inSalesReceiptPath =
          row.level >= 3 &&
          norm(cfParentByLevel[0]) === norm(ACC_OPERATING) &&
          norm(cfParentByLevel[1]) === norm(ACC_INFLOW) &&
          norm(cfParentByLevel[2]) === norm(ACC_SALES_RECEIPT);

        if (!inSalesReceiptPath) return;

        let factor: number | null = null;
        if (norm(row.account) === norm(ACC_HK)) factor = 1 + delta;
        if (norm(row.account) === norm(ACC_TW)) factor = 1 + (delta * 0.8);
        if (factor === null) return;

        for (let monthIdx = 4; monthIdx <= 11; monthIdx++) {
          const current = row.values[monthIdx];
          if (typeof current !== 'number') continue;
          totalSalesDeltaByMonth[monthIdx] += (current * factor) - current;
        }
      });
    }

    const goodsPaymentDeltaByMonth = new Array(12).fill(0);
    if (cfData && cfDataForView) {
      const collectGoodsPaymentByMonth = (rows: TableRow[]): number[] => {
        const monthly = new Array(12).fill(0);
        const parentByLevelInCf: string[] = [];

        rows.forEach((row) => {
          parentByLevelInCf[row.level] = row.account;
          parentByLevelInCf.length = row.level + 1;

          const inGoodsPaymentPath =
            row.level >= 3 &&
            norm(parentByLevelInCf[0]) === norm(ACC_OPERATING) &&
            norm(parentByLevelInCf[1]) === norm(ACC_OUTFLOW) &&
            norm(parentByLevelInCf[2]) === norm(ACC_GOODS_PAYMENT) &&
            (norm(row.account) === norm(ACC_HK) || norm(row.account) === norm(ACC_TW));

          if (!inGoodsPaymentPath) return;

          for (let monthIdx = 4; monthIdx <= 11; monthIdx++) {
            const value = row.values[monthIdx];
            monthly[monthIdx] += typeof value === 'number' ? value : 0;
          }
        });

        return monthly;
      };

      const baseGoodsPaymentByMonth = collectGoodsPaymentByMonth(cfData);
      const adjustedGoodsPaymentByMonth = collectGoodsPaymentByMonth(cfDataForView);
      for (let i = 0; i < 12; i++) {
        goodsPaymentDeltaByMonth[i] = adjustedGoodsPaymentByMonth[i] - baseGoodsPaymentByMonth[i];
      }
    }

    const parentByLevel: string[] = [];
    clonedRows.forEach((row) => {
      parentByLevel[row.level] = row.account;
      parentByLevel.length = row.level + 1;

      const isTaiwanArLeaf =
        row.level >= 1 &&
        norm(parentByLevel[0]) === norm(ACC_AR) &&
        norm(row.account).includes(norm(ACC_TW));

      if (!isTaiwanArLeaf) return;

      const factor = 1 + (delta * AR_SENSITIVITY);
      for (let monthIdx = 4; monthIdx <= 11; monthIdx++) {
        const current = row.values[monthIdx];
        if (typeof current !== 'number') continue;
        row.values[monthIdx] = current * factor;
      }

      recalcEndingAndYoy(row);
    });

    parentByLevel.length = 0;
    const apLeafRows: TableRow[] = [];
    clonedRows.forEach((row) => {
      parentByLevel[row.level] = row.account;
      parentByLevel.length = row.level + 1;

      const isApLeaf = row.level >= 1 && norm(parentByLevel[0]) === norm(ACC_AP) && !row.isGroup;
      if (isApLeaf) apLeafRows.push(row);
    });

    if (apLeafRows.length > 0) {
      for (let monthIdx = 4; monthIdx <= 11; monthIdx++) {
        // 물품대 증감과 동일금액, 반대방향으로 매입채무 반영
        const apTotalDelta = -goodsPaymentDeltaByMonth[monthIdx];
        if (apTotalDelta === 0) continue;

        const weights = apLeafRows.map((row) => {
          const value = row.values[monthIdx];
          const numericValue = typeof value === 'number' ? value : 0;
          return Math.abs(numericValue);
        });
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);

        let distributed = 0;
        for (let i = 0; i < apLeafRows.length; i++) {
          const row = apLeafRows[i];
          const current = row.values[monthIdx];
          if (typeof current !== 'number') continue;

          let deltaShare = 0;
          if (i === apLeafRows.length - 1) {
            deltaShare = apTotalDelta - distributed;
          } else if (totalWeight > 0) {
            deltaShare = apTotalDelta * (weights[i] / totalWeight);
            distributed += deltaShare;
          } else if (i === 0) {
            deltaShare = apTotalDelta;
            distributed += deltaShare;
          }

          row.values[monthIdx] = current + deltaShare;
        }
      }

      apLeafRows.forEach(recalcEndingAndYoy);
    }

    parentByLevel.length = 0;
    clonedRows.forEach((row) => {
      parentByLevel[row.level] = row.account;
      parentByLevel.length = row.level + 1;

      const isInventoryLeaf =
        row.level >= 1 &&
        norm(parentByLevel[0]) === norm(ACC_INVENTORY) &&
        !row.isGroup;

      if (!isInventoryLeaf) return;

      for (let monthIdx = 4; monthIdx <= 11; monthIdx++) {
        const current = row.values[monthIdx];
        if (typeof current !== 'number') continue;

        const salesDelta = totalSalesDeltaByMonth[monthIdx];
        const inventoryDelta = -(salesDelta * COGS_RATE); // 매출과 반대방향
        row.values[monthIdx] = current + inventoryDelta;
      }

      recalcEndingAndYoy(row);
    });

    for (let i = clonedRows.length - 1; i >= 0; i--) {
      const row = clonedRows[i];
      if (row.level !== 0 || !row.isGroup) continue;

      const summed = new Array(row.values.length).fill(0);
      let hasChild = false;
      for (let j = i + 1; j < clonedRows.length; j++) {
        const child = clonedRows[j];
        if (child.level <= row.level) break;
        if (child.level !== row.level + 1) continue;
        hasChild = true;
        for (let k = 0; k < 12; k++) {
          summed[k] += typeof child.values[k] === 'number' ? child.values[k] : 0;
        }
      }

      if (!hasChild) continue;
      for (let k = 0; k < 12; k++) row.values[k] = summed[k];
      recalcEndingAndYoy(row);
    }

    const arRow = clonedRows.find((r) => r.level === 0 && norm(r.account) === norm(ACC_AR));
    const inventoryRow = clonedRows.find((r) => r.level === 0 && norm(r.account) === norm('재고자산'));
    const apRow = clonedRows.find((r) => r.level === 0 && norm(r.account) === norm(ACC_AP));
    const totalRow = clonedRows.find((r) => r.level === 0 && norm(r.account) === norm(ACC_WC_TOTAL));

    if (arRow && inventoryRow && apRow && totalRow) {
      const arValues = arRow.values;
      const inventoryValues = inventoryRow.values;
      const apValues = apRow.values;
      for (let i = 0; i < 12; i++) {
        const arValue = arValues[i] ?? 0;
        const inventoryValue = inventoryValues[i] ?? 0;
        const apValue = apValues[i] ?? 0;
        totalRow.values[i] =
          (typeof arValue === 'number' ? arValue : 0) +
          (typeof inventoryValue === 'number' ? inventoryValue : 0) +
          (typeof apValue === 'number' ? apValue : 0);
      }
      recalcEndingAndYoy(totalRow);

      const momRow = clonedRows.find((r) => r.level === 0 && norm(r.account) === norm(ACC_MOM));
      if (momRow) {
        const prevYear = totalRow.year2024Value;
        momRow.values[0] =
          typeof totalRow.values[0] === 'number' && prevYear !== null && prevYear !== undefined
            ? totalRow.values[0] - prevYear
            : null;
        for (let i = 1; i < 12; i++) {
          const curr = totalRow.values[i];
          const prev = totalRow.values[i - 1];
          momRow.values[i] = typeof curr === 'number' && typeof prev === 'number' ? curr - prev : null;
        }
        momRow.values[12] =
          typeof totalRow.values[12] === 'number' && prevYear !== null && prevYear !== undefined
            ? totalRow.values[12] - prevYear
            : null;
      if (momRow.values.length >= 14) momRow.values[13] = null;
      }
    }

    const bsAlignedAccounts = [ACC_AR, ACC_INVENTORY, ACC_AP];
    for (const account of bsAlignedAccounts) {
      const bsEndingValue = findBsEndingValue(bsFinancialData, account);
      if (bsEndingValue === null) continue;

      clonedRows.forEach((row) => {
        if (norm(row.account) !== norm(account)) return;
        row.values[11] = bsEndingValue;
        recalcEndingAndYoy(row);
      });
    }

    if (arRow && inventoryRow && apRow && totalRow) {
      totalRow.values[11] =
        (typeof arRow.values[11] === 'number' ? arRow.values[11] : 0) +
        (typeof inventoryRow.values[11] === 'number' ? inventoryRow.values[11] : 0) +
        (typeof apRow.values[11] === 'number' ? apRow.values[11] : 0);
      recalcEndingAndYoy(totalRow);

      const momRow = clonedRows.find((r) => r.level === 0 && norm(r.account) === norm(ACC_MOM));
      if (momRow) {
        const prevYear = totalRow.year2024Value;
        momRow.values[11] =
          typeof totalRow.values[11] === 'number' && typeof totalRow.values[10] === 'number'
            ? totalRow.values[11] - totalRow.values[10]
            : null;
        momRow.values[12] =
          typeof totalRow.values[12] === 'number' && prevYear !== null && prevYear !== undefined
            ? totalRow.values[12] - prevYear
            : null;
        if (momRow.values.length >= 14) momRow.values[13] = null;
      }
    }

    // 1~4월은 실적 고정: 슬라이더 영향 완전 차단
    for (let i = 0; i < clonedRows.length; i++) {
      const source = wcStatementData[i];
      if (!source) continue;
      if (typeof source.values[0] === 'number') clonedRows[i].values[0] = source.values[0];
      if (typeof source.values[1] === 'number') clonedRows[i].values[1] = source.values[1];
      if (typeof source.values[2] === 'number') clonedRows[i].values[2] = source.values[2];
    }

    return clonedRows;
  }, [wcStatementData, cfData, cfDataForView, wcYear, salesYoYRate, bsFinancialData]);

  const wcStatementDataForView = adjustedWcStatementData ?? wcStatementData;

  const withPlanMetrics = useMemo(() => {
    const attach = (
      rollingRows: TableRow[] | null,
      planRows: TableRow[] | null,
      config?: { previousValueIndex?: number; targetValueIndex?: number }
    ): TableRow[] | null => {
      if (!rollingRows) return null;
      if (wcYear !== 2026 || !planRows) return rollingRows;

      const planMap = new Map<string, TableRow>();
      for (const row of planRows) {
        planMap.set(`${row.level}__${row.account}`, row);
      }

      const previousValueIndex = config?.previousValueIndex ?? null;
      const targetValueIndex = config?.targetValueIndex ?? 12;

      return rollingRows.map((row, index) => {
        const isYoYRow = row.account === '전월대비' || row.account === '전년대비';
        const planRow = planRows[index] ?? planMap.get(`${row.level}__${row.account}`);
        const prev =
          row.year2024Value ??
          (typeof previousValueIndex === 'number' && typeof row.values[previousValueIndex] === 'number'
            ? row.values[previousValueIndex]
            : null);
        const rollingValue = row.values[targetValueIndex];
        const planValue = planRow?.values[targetValueIndex];

        const planYoYAmount = isYoYRow
          ? null
          : (typeof planValue === 'number' && typeof prev === 'number'
              ? planValue - prev
              : null);
        const planYoY = isYoYRow
          ? null
          : (typeof planValue === 'number' && typeof prev === 'number' && prev !== 0
              ? planValue / prev
              : null);
        const rollingYoYAmount = isYoYRow
          ? null
          : (typeof rollingValue === 'number' && typeof prev === 'number'
              ? rollingValue - prev
              : null);
        const rollingYoY = isYoYRow
          ? null
          : (typeof rollingValue === 'number' && typeof prev === 'number' && prev !== 0
              ? rollingValue / prev
              : null);
        const planDelta = typeof rollingValue === 'number' && typeof planValue === 'number'
          ? rollingValue - planValue
          : null;
        const planDeltaRate = typeof rollingValue === 'number' && typeof planValue === 'number' && planValue !== 0
          ? rollingValue / planValue
          : null;

        return {
          ...row,
          year2024Value: typeof prev === 'number' ? prev : row.year2024Value ?? null,
          planValue: typeof planValue === 'number' ? planValue : null,
          rollingValue: typeof rollingValue === 'number' ? rollingValue : null,
          planYoYAmount,
          planYoY,
          rollingYoYAmount,
          rollingYoY,
          planDelta,
          planDeltaRate,
        } as TableRow;
      });
    };

    const fillChildMetrics = (
      rows: TableRow[] | null,
      planRows: TableRow[] | null,
      config: { previousValueIndex: number; targetValueIndex: number }
    ): TableRow[] | null => {
      if (!rows) return null;
      const { previousValueIndex, targetValueIndex } = config;

      return rows.map((row, index) => {
        const planRow = planRows?.[index];
        const isYoYRow = /대비/.test(row.account);
        const prev =
          row.year2024Value ??
          (typeof row.values[previousValueIndex] === 'number' ? row.values[previousValueIndex] : null);
        const rollingValue =
          row.rollingValue ??
          (typeof row.values[targetValueIndex] === 'number' ? row.values[targetValueIndex] : null);
        const planValue =
          row.planValue ??
          (planRow && typeof planRow.values[targetValueIndex] === 'number' ? planRow.values[targetValueIndex] : null);

        const planYoYAmount = isYoYRow ? null : (typeof planValue === 'number' && typeof prev === 'number' ? planValue - prev : null);
        const planYoY = isYoYRow ? null : (typeof planValue === 'number' && typeof prev === 'number' && prev !== 0 ? planValue / prev : null);
        const rollingYoYAmount = isYoYRow ? null : (typeof rollingValue === 'number' && typeof prev === 'number' ? rollingValue - prev : null);
        const rollingYoY = isYoYRow ? null : (typeof rollingValue === 'number' && typeof prev === 'number' && prev !== 0 ? rollingValue / prev : null);
        const planDelta = typeof rollingValue === 'number' && typeof planValue === 'number' ? rollingValue - planValue : null;
        const planDeltaRate = typeof rollingValue === 'number' && typeof planValue === 'number' && planValue !== 0 ? rollingValue / planValue : null;

        return {
          ...row,
          year2024Value: typeof prev === 'number' ? prev : row.year2024Value ?? null,
          rollingValue: typeof rollingValue === 'number' ? rollingValue : row.rollingValue ?? null,
          planValue: typeof planValue === 'number' ? planValue : row.planValue ?? null,
          planYoYAmount: row.planYoYAmount ?? planYoYAmount,
          planYoY: row.planYoY ?? planYoY,
          rollingYoYAmount: row.rollingYoYAmount ?? rollingYoYAmount,
          rollingYoY: row.rollingYoY ?? rollingYoY,
          planDelta: row.planDelta ?? planDelta,
          planDeltaRate: row.planDeltaRate ?? planDeltaRate,
          children: row.children ? fillChildMetrics(row.children, planRow?.children ?? null, config) ?? row.children : row.children,
        } as TableRow;
      });
    };

    const extendBsRowsForDisplay = (rows: TableRow[] | null): TableRow[] | null => {
      if (!rows) return null;

      return rows.map((row) => ({
        ...row,
        values: [
          ...row.values,
          row.planValue ?? null,
          row.planDelta ?? null,
          row.planDeltaRate ?? null,
        ],
        children: row.children ? extendBsRowsForDisplay(row.children) ?? row.children : row.children,
      }));
    };

    const alignWcRowsWithBs = (rows: TableRow[] | null): TableRow[] | null => {
      if (!rows) return null;
      if (!bsFinancialData || !bsPlanData) return rows;

      const norm = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, '').trim();
      const normalizeBsValueForWc = (account: string, value: number | null): number | null => {
        if (value === null) return null;
        return norm(account) === norm('매입채무') ? -Math.abs(value) : value;
      };
      const findBsEndingValue = (tree: TableRow[] | null, account: string): number | null => {
        if (!tree) return null;

        for (const row of tree) {
          if (norm(row.account) === norm(account)) {
            const endingValue = row.values[13];
            return typeof endingValue === 'number' ? endingValue : null;
          }

          if (row.children) {
            const childMatch = findBsEndingValue(row.children, account);
            if (childMatch !== null) return childMatch;
          }
        }

        return null;
      };

      const accountKeys = ['매출채권', '재고자산', '매입채무'] as const;
      const metrics = new Map<string, { prev: number | null; plan: number | null; rolling: number | null }>();

      for (const account of accountKeys) {
        const wcRow = rows.find((row) => row.level === 0 && norm(row.account) === norm(account));
        metrics.set(account, {
          prev: wcRow?.year2024Value ?? null,
          plan: normalizeBsValueForWc(account, findBsEndingValue(bsPlanData, account)),
          rolling: normalizeBsValueForWc(account, findBsEndingValue(bsFinancialData, account)),
        });
      }

      const hasAllBsMetrics = Array.from(metrics.values()).every(
        (item) => typeof item.plan === 'number' && typeof item.rolling === 'number'
      );
      if (!hasAllBsMetrics) return rows;

      const totalPrev = Array.from(metrics.values()).reduce((sum, item) => sum + (item.prev ?? 0), 0);
      const totalPlan = Array.from(metrics.values()).reduce((sum, item) => sum + (item.plan ?? 0), 0);
      const totalRolling = Array.from(metrics.values()).reduce((sum, item) => sum + (item.rolling ?? 0), 0);

      return rows.map((row) => {
        const account = norm(row.account);

        if (accountKeys.some((key) => norm(key) === account)) {
          const metric = metrics.get(row.account) ?? metrics.get(accountKeys.find((key) => norm(key) === account) ?? '');
          if (!metric) return row;

          const planYoY = typeof metric.plan === 'number' && typeof metric.prev === 'number' && metric.prev !== 0 ? metric.plan / metric.prev : null;
          const rollingYoY = typeof metric.rolling === 'number' && typeof metric.prev === 'number' && metric.prev !== 0 ? metric.rolling / metric.prev : null;
          const planDelta = typeof metric.rolling === 'number' && typeof metric.plan === 'number' ? metric.rolling - metric.plan : null;
          const planDeltaRate = typeof metric.rolling === 'number' && typeof metric.plan === 'number' && metric.plan !== 0 ? metric.rolling / metric.plan : null;

          const nextValues = [...row.values];
          nextValues[12] = metric.rolling;
          if (nextValues.length >= 14) {
            nextValues[13] = typeof metric.rolling === 'number' && typeof metric.prev === 'number' ? metric.rolling - metric.prev : null;
          }

          return {
            ...row,
            values: nextValues,
            planValue: metric.plan,
            rollingValue: metric.rolling,
            planYoYAmount: typeof metric.plan === 'number' && typeof metric.prev === 'number' ? metric.plan - metric.prev : null,
            planYoY,
            rollingYoYAmount: typeof metric.rolling === 'number' && typeof metric.prev === 'number' ? metric.rolling - metric.prev : null,
            rollingYoY,
            planDelta,
            planDeltaRate,
          } as TableRow;
        }

        if (account === norm('운전자본합계')) {
          const planYoY = totalPrev !== 0 ? totalPlan / totalPrev : null;
          const rollingYoY = totalPrev !== 0 ? totalRolling / totalPrev : null;
          const planDelta = totalRolling - totalPlan;
          const planDeltaRate = totalPlan !== 0 ? totalRolling / totalPlan : null;
          const nextValues = [...row.values];
          nextValues[12] = totalRolling;
          if (nextValues.length >= 14) nextValues[13] = totalRolling - totalPrev;

          return {
            ...row,
            values: nextValues,
            year2024Value: totalPrev,
            planValue: totalPlan,
            rollingValue: totalRolling,
            planYoYAmount: totalPlan - totalPrev,
            planYoY,
            rollingYoYAmount: totalRolling - totalPrev,
            rollingYoY,
            planDelta,
            planDeltaRate,
          } as TableRow;
        }

        if (account === norm('전년대비')) {
          const planValue = totalPlan - totalPrev;
          const rollingValue = totalRolling - totalPrev;
          const planDelta = rollingValue - planValue;
          const planDeltaRate = planValue !== 0 ? rollingValue / planValue : null;
          const nextValues = [...row.values];
          nextValues[12] = rollingValue;
          if (nextValues.length >= 14) nextValues[13] = null;

          return {
            ...row,
            values: nextValues,
            year2024Value: totalPrev,
            planValue,
            rollingValue,
            planYoYAmount: planValue,
            planYoY: null,
            rollingYoYAmount: rollingValue,
            rollingYoY: null,
            planDelta,
            planDeltaRate,
          } as TableRow;
        }

        return row;
      });
    };

    return {
      cf: attach(cfDataForView, cfPlanData),
      wc: alignWcRowsWithBs(attach(wcStatementDataForView, wcStatementPlanData)),
      bs: extendBsRowsForDisplay(
        fillChildMetrics(
          attach(bsFinancialData, bsPlanData, { previousValueIndex: 1, targetValueIndex: 13 }),
          bsPlanData,
          { previousValueIndex: 1, targetValueIndex: 13 }
        )
      ),
    };
  }, [cfDataForView, cfPlanData, wcStatementDataForView, wcStatementPlanData, bsFinancialData, bsPlanData, wcYear]);

  const dynamicWcRemarks = useMemo(() => {
    const remarksMap = new Map<string, string>(wcRemarks);
    if (!wcStatementDataForView) return remarksMap;

    const buildRemark = (account: string, narrative: string) => {
      const row = wcStatementDataForView.find((r) => r.level === 0 && r.account === account);
      if (!row) return;

      const ending = row.values[12];
      const yoy = row.values[13];
      if (typeof ending !== 'number' || typeof yoy !== 'number') return;

      const direction = yoy > 0 ? '증가' : yoy < 0 ? '감소' : '유지';
      const yoyText = yoy === 0 ? '0 K HKD' : formatMillionYuan(yoy, true);
      remarksMap.set(
        account,
        `${account} ${yoyText} ${direction} (기말 ${Math.round(ending).toLocaleString('ko-KR')} K HKD). ${narrative}`
      );
    };

    buildRemark('매출채권', '매출 연동 시나리오에 따라 대만 AR이 자동 조정됨.');
    buildRemark('재고자산', '매출 증감분의 43%를 매출과 반대방향으로 반영.');
    buildRemark('매입채무', '물품대 지출 증감과 동일금액 반대방향으로 반영.');

    return remarksMap;
  }, [wcRemarks, wcStatementDataForView]);

  // 분석 결과 계산 (useMemo로 캐싱): 현금흐름표=cfData(CF 폴더), 운전자본표=wcStatementData(운전자본 폴더)
  const analysisResults = useMemo(() => {
    if (!cfDataForView && !wcStatementDataForView) {
      return null;
    }

    const cfAnalysis = analyzeCashFlowData(cfDataForView, wcYear);
    const wcAnalysis = analyzeWorkingCapitalData(wcStatementDataForView, wcYear);
    const insights = generateCashFlowInsights(cfDataForView, wcStatementDataForView, wcYear);
    const cfoQA = generateCFOQA(cfDataForView, wcStatementDataForView, wcYear);

    return { cfAnalysis, wcAnalysis, insights, cfoQA };
  }, [cfDataForView, wcStatementDataForView, wcYear]);

  const buildMetricExportRows = (rows: TableRow[] | null, remarks: Map<string, string>) => {
    if (!rows) return [];

    const formatPlanDeltaRateExport = (ratio: number | null | undefined) => {
      if (ratio === null || ratio === undefined || isNaN(ratio) || !isFinite(ratio)) return null;
      const deltaRate = ratio - 1;
      const absValue = Math.abs(deltaRate * 100).toFixed(1);
      if (deltaRate > 0) return `+${absValue}%`;
      if (deltaRate < 0) return `△${absValue}%`;
      return '+0.0%';
    };

    return rows.map((row) => {
      const previous = row.year2024Value ?? row.values[1] ?? null;
      const plan = row.planValue ?? null;
      const rolling = row.rollingValue ?? row.values[12] ?? null;
      const accountKey = isEnglish ? 'Account' : '계정과목';
      const previousKey = isEnglish ? '25 Total' : '25년';
      const planKey = isEnglish ? '26 Prev Plan' : '26년 전월계획';
      const planGapKey = isEnglish ? 'Prev Gap Plan' : '전년대비 전월계획';
      const planYoYKey = isEnglish ? '26 Prev Plan YoY' : '26년 전월계획 YoY';
      const rollingKey = isEnglish ? '26 Rolling' : '26년 롤링';
      const rollingGapKey = isEnglish ? 'Prev Gap Rolling' : '전년대비 롤링';
      const rollingYoYKey = isEnglish ? '26 Rolling YoY' : '26년 롤링 YoY';
      const deltaKey = isEnglish ? 'vs Prev Plan' : '전월계획대비';
      const deltaRateKey = isEnglish ? 'vs Prev Plan%' : '전월계획대비%';
      const remarksKey = isEnglish ? 'Remarks' : '비고';

      return {
        [accountKey]: `${'  '.repeat(Math.max(0, row.level))}${translateExportAccount(row.account)}`,
        [previousKey]: previous,
        [planKey]: plan,
        [planGapKey]: row.planYoYAmount ?? null,
        [planYoYKey]: row.planYoY !== null && row.planYoY !== undefined ? `${Math.round(row.planYoY * 100)}%` : null,
        [rollingKey]: rolling,
        [rollingGapKey]: row.rollingYoYAmount ?? null,
        [rollingYoYKey]: row.rollingYoY !== null && row.rollingYoY !== undefined ? `${Math.round(row.rollingYoY * 100)}%` : null,
        [deltaKey]: row.planDelta ?? null,
        [deltaRateKey]: formatPlanDeltaRateExport(row.planDeltaRate),
        [remarksKey]: translateDashboardRemark(remarks.get(row.account) ?? ''),
      };
    });
  };

  const buildMonthlyWcExportRows = () => {
    const toRow = (section: string, item: MonthlyWcItem) => ({
      [isEnglish ? 'Division' : '구분']: section,
      [isEnglish ? 'Account' : '계정과목']: translateMonthlyWcLabel(item.label),
      [isEnglish ? 'Prev.' : '전월']: getSignedMonthlyWcValue(item.label, item.previous),
      [isEnglish ? 'Plan' : '계획']: getSignedMonthlyWcValue(item.label, item.plan),
      [isEnglish ? 'Current' : '당월']: getSignedMonthlyWcValue(item.label, item.current),
      [isEnglish ? 'vs Plan' : '계획비']: item.delta,
      [isEnglish ? 'Remarks' : '비고']: translateDashboardRemark(item.remark),
    });

    const combinedRows = monthlyWcCombinedItems.map((item) => toRow(isEnglish ? 'Hong Kong + Taiwan' : '홍콩+대만', item));
    const hkRows = MONTHLY_WC_SECTIONS.HK.items.map((item) => toRow('HKMC HKD', item));
    const twRows = MONTHLY_WC_SECTIONS.TW.items.map((item) => toRow('TW HKD', item));
    const divisionKey = isEnglish ? 'Division' : '구분';
    const accountKey = isEnglish ? 'Account' : '계정과목';
    const previousKey = isEnglish ? 'Prev.' : '전월';
    const planKey = isEnglish ? 'Plan' : '계획';
    const currentKey = isEnglish ? 'Current' : '당월';
    const deltaKey = isEnglish ? 'vs Plan' : '계획비';
    const remarksKey = isEnglish ? 'Remarks' : '비고';

    return [
      ...combinedRows,
      {
        [divisionKey]: isEnglish ? 'Hong Kong + Taiwan' : '홍콩+대만',
        [accountKey]: isEnglish ? 'Working Capital Total' : '운전자본 합계',
        [previousKey]: monthlyWcCombined.previous,
        [planKey]: monthlyWcCombined.plan,
        [currentKey]: monthlyWcCombined.current,
        [deltaKey]: monthlyWcCombined.delta,
        [remarksKey]: `${isEnglish ? 'Hong Kong total' : '홍콩 합계'} ${formatDelta(hkMonthlyWcTotal.delta)} / ${isEnglish ? 'Taiwan total' : '대만 합계'} ${formatDelta(twMonthlyWcTotal.delta)}`,
      },
      ...hkRows,
      {
        [divisionKey]: 'HKMC HKD',
        [accountKey]: isEnglish ? 'Total' : '합계',
        [previousKey]: hkMonthlyWcTotal.previous,
        [planKey]: hkMonthlyWcTotal.plan,
        [currentKey]: hkMonthlyWcTotal.current,
        [deltaKey]: hkMonthlyWcTotal.delta,
        [remarksKey]: '',
      },
      ...twRows,
      {
        [divisionKey]: 'TW HKD',
        [accountKey]: isEnglish ? 'Total' : '합계',
        [previousKey]: twMonthlyWcTotal.previous,
        [planKey]: twMonthlyWcTotal.plan,
        [currentKey]: twMonthlyWcTotal.current,
        [deltaKey]: twMonthlyWcTotal.delta,
        [remarksKey]: '',
      },
    ];
  };

  const appendJsonSheet = (workbook: XLSX.WorkBook, sheetName: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = Object.keys(rows[0]).map((key) => ({
      wch: key === '계정과목' || key === 'Account' ? 28 : key === '비고' || key === 'Remarks' ? 56 : 14,
    }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  };

  const exportDashboardExcel = (target: 'all' | 'bs' | 'pl' | 'cf' | 'wc' | 'monthlyWc') => {
    if (target === 'pl') {
      setIsExportMenuOpen(false);
      if (effectiveView !== 'PL') {
        alert(isEnglish ? 'Open the Profit & Loss tab first, then export P/L.' : '손익(PL) 탭을 연 뒤 PL을 다운로드해주세요.');
        return;
      }
      window.dispatchEvent(new CustomEvent('dashboard:export-pl-excel'));
      return;
    }

    const workbook = XLSX.utils.book_new();

    if (target === 'all' || target === 'cf') {
      appendJsonSheet(workbook, isEnglish ? 'Cash Flow' : '현금흐름표', buildMetricExportRows(withPlanMetrics.cf, cfRemarks));
    }
    if (target === 'all' || target === 'wc') {
      appendJsonSheet(workbook, isEnglish ? 'Working Capital' : '운전자본표', buildMetricExportRows(withPlanMetrics.wc, wcRemarks));
    }
    if (target === 'all' || target === 'bs') {
      appendJsonSheet(workbook, isEnglish ? 'Balance Sheet' : '재무상태', buildMetricExportRows(withPlanMetrics.bs, bsRemarks));
    }
    if (target === 'all' || target === 'monthlyWc') {
      appendJsonSheet(workbook, isEnglish ? 'Monthly WC' : '당월운전자본', buildMonthlyWcExportRows());
    }

    if (workbook.SheetNames.length === 0) {
      alert(isEnglish ? 'No data to export.' : '내보낼 데이터가 없습니다.');
      return;
    }

    setIsExportMenuOpen(false);
    const targetLabel = target === 'all' ? 'all' : target;
    XLSX.writeFile(workbook, `fnf_dashboard_${targetLabel}_${wcYear}_${salesYoYRate}pct.xlsx`);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eef4ff_0%,#f7f9fc_42%,#edf2f7_100%)]">
      {/* 상단 탭 */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        title={headerTitle}
        subtitle={headerSubtitle}
        tabSideContent={
          <div className="inline-flex overflow-hidden rounded-xl border border-white/15 bg-white/10 backdrop-blur">
            <button
              onClick={() => setLocale('ko')}
              className={`w-[48px] py-2 text-sm font-semibold transition-colors ${
                locale === 'ko' ? 'bg-white text-slate-900' : 'bg-transparent text-white hover:bg-white/10'
              }`}
            >
              KR
            </button>
            <button
              onClick={() => setLocale('en')}
              className={`w-[48px] py-2 text-sm font-semibold transition-colors ${
                locale === 'en' ? 'bg-white text-slate-900' : 'bg-transparent text-white hover:bg-white/10'
              }`}
            >
              EN
            </button>
          </div>
        }
        afterTabsContent={
          effectiveView === 'CF' ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
              <label htmlFor="sales-yoy-slider" className="whitespace-nowrap text-sm font-medium text-white">
                {isEnglish ? 'Sales YoY' : '매출 YoY'}
              </label>
              <input
                id="sales-yoy-slider"
                type="range"
                min={100}
                max={130}
                step={1}
                value={salesYoYRate}
                onChange={(e) => setSalesYoYRate(Number(e.target.value))}
                className="w-32 accent-yellow-400"
              />
              <span className="text-sm font-semibold text-white whitespace-nowrap">{salesYoYRate}%</span>
            </div>
          ) : null
        }
        rightContent={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90">
              {basisLabel}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/18"
              >
                Excel ▾
              </button>
              {isExportMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-[70] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl">
                  {[
                    { label: isEnglish ? 'All sheets' : '전체 항목', target: 'all' as const },
                    { label: isEnglish ? 'Cash Flow' : '현금흐름표', target: 'cf' as const },
                    { label: isEnglish ? 'Working Capital' : '운전자본표', target: 'wc' as const },
                    { label: isEnglish ? 'Profit & Loss' : '손익(PL)', target: 'pl' as const },
                    { label: isEnglish ? 'Balance Sheet' : '재무상태(BS)', target: 'bs' as const },
                    { label: isEnglish ? 'Monthly WC' : '당월 운전자본', target: 'monthlyWc' as const },
                  ].map((item) => (
                    <button
                      key={item.target}
                      type="button"
                      onClick={() => exportDashboardExcel(item.target)}
                      className="block w-full px-4 py-2 text-left font-medium text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setReportMode('FUND_MONTHLY')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                reportMode === 'FUND_MONTHLY'
                  ? 'bg-[#6d63ff] text-white shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/18'
              }`}
            >
              <span className="mr-1.5 inline-flex align-[-2px] text-white/90"><NavIcon kind="fund" /></span>
              {isEnglish ? 'Fund Mly' : '자금월보'}
            </button>
            <button
              onClick={() => setReportMode('PERFORMANCE')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                reportMode === 'PERFORMANCE'
                  ? 'bg-[#16a34a] text-white shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/18'
              }`}
            >
              <span className="mr-1.5 inline-flex align-[-2px] text-white/90"><NavIcon kind="perf" /></span>
              {isEnglish ? 'Perf.' : '실적보고'}
            </button>
          </div>
        }
      />

      {/* 내용 - 상단 탭 높이만큼 패딩 추가 */}
      <div className="p-0 pt-[154px]">
        {/* 홍콩법인 F/S - 현금흐름표 */}
        {activeTab === 0 && (
          <div>
            <div className="fixed left-0 right-0 top-[74px] z-40 px-4 py-2">
              <div className="flex items-center gap-3 rounded-[18px] border border-slate-200/80 bg-white/92 px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.08)] backdrop-blur-md">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/92 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  {reportMode === 'PERFORMANCE' ? (
                    <>
                      <button
                        onClick={() => setBsView('BS')}
                        className={`inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl border px-5 py-2 text-sm font-semibold transition-colors ${
                          effectiveView === 'BS'
                            ? 'border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fb_100%)] text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.12)]'
                            : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-[13px] leading-none"><NavIcon kind="bs" /></span>
                        {isEnglish ? 'Financial Position' : '재무상태 (BS)'}
                      </button>
                      <button
                        onClick={() => setBsView('PL')}
                        className={`inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl border px-5 py-2 text-sm font-semibold transition-colors ${
                          effectiveView === 'PL'
                            ? 'border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fb_100%)] text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.12)]'
                            : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-[13px] leading-none"><NavIcon kind="pl" /></span>
                        {isEnglish ? 'Profit & Loss' : '손익 (PL)'}
                      </button>
                      <button
                        onClick={() => setBsView('CF')}
                        className={`inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl border px-5 py-2 text-sm font-semibold transition-colors ${
                          effectiveView === 'CF'
                            ? 'border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fb_100%)] text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.12)]'
                            : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-[13px] leading-none"><NavIcon kind="cf" /></span>
                        {isEnglish ? 'Cash Flow' : '자금 (CF)'}
                      </button>
                      <button
                        onClick={() => setBsView('INVENTORY')}
                        className={`inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl border px-5 py-2 text-sm font-semibold transition-colors ${
                          effectiveView === 'INVENTORY'
                            ? 'border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fb_100%)] text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.12)]'
                            : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-[13px] leading-none"><NavIcon kind="inventory" /></span>
                        {isEnglish ? 'HC / Inventory' : 'HC / 재고'}
                      </button>
                    </>
                  ) : (
                    <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fb_100%)] px-4 py-2 text-sm font-semibold text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.10)]">
                      <span className="text-[13px] leading-none"><NavIcon kind="cf" /></span>
                      C/F
                    </button>
                  )}
                </div>
                <div className="flex-1" />
                {effectiveView !== 'INVENTORY' && (
                  <button
                    onClick={() => {
                      if (effectiveView === 'BS') {
                        setBsMonthsCollapsed(!bsMonthsCollapsed);
                      } else {
                        setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed);
                      }
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                  >
                    {toggleMonthlyLabel(effectiveView === 'BS' ? bsMonthsCollapsed : workingCapitalMonthsCollapsed)}
                  </button>
                )}
                {false && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white">
                    <label htmlFor="sales-yoy-slider" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      {isEnglish ? 'Sales YoY' : '매출 YoY'}
                    </label>
                    <input
                      id="sales-yoy-slider"
                      type="range"
                      min={100}
                      max={130}
                      step={1}
                      value={salesYoYRate}
                      onChange={(e) => setSalesYoYRate(Number(e.target.value))}
                      className="w-36 accent-navy"
                    />
                    <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{salesYoYRate}%</span>
                  </div>
                )}
                <span className="ml-auto rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600">{unitLabel}</span>
              </div>
            </div>
            {loading && <div className="p-6 text-center">{isEnglish ? 'Loading...' : '로딩 중...'}</div>}
            {error && <div className="p-6 text-center text-red-500">{error}</div>}
            
            {/* B/S 화면 */}
            {effectiveView === 'BS' && (bsFinancialData || wcStatementDataForView) && !loading && (
              <div className="px-4 pt-5 pb-8 lg:px-4">
                {bsFinancialData && (
                  <>
                    {/* 재무비율 분석 */}
                    {(() => {
                      // 2026년 기말(e) 데이터 (values[13] = 2612)
                      const 자산 = bsFinancialData.find(r => r.account === '자산');
                      const 부채 = bsFinancialData.find(r => r.account === '부채');
                      const 자본 = bsFinancialData.find(r => r.account === '자본');
                      
                      if (!자산 || !부채 || !자본) return null;
                      
                      const 총자산26 = 자산.values[13] || 0;
                      const 총부채26 = 부채.values[13] || 0;
                      const 총자본26 = 자본.values[13] || 0;
                      const 총자산25 = 자산.values[1] || 0;
                      const 총부채25 = 부채.values[1] || 0;
                      const 총자본25 = (자산.values[1] || 0) - (부채.values[1] || 0);
                      
                      // TP채무 찾기
                      const 부채Children = 부채.children || [];
                      const 유동부채 = 부채Children.find(r => r.account === '유동부채');
                      const 유동부채Children = 유동부채?.children || [];
                      const TP채무 = 유동부채Children.find(r => r.account === '매입채무(TP)');
                      const TP채무26 = TP채무?.values[13] || 0;
                      const TP채무25 = TP채무?.values[1] || 0;
                      
                      // TP채무 제외 부채비율
                      const 부채제외TP26 = 총부채26 - TP채무26;
                      const 자본제외TP26 = 총자본26 + TP채무26;
                      const 부채비율제외TP26 = 자본제외TP26 !== 0 ? (부채제외TP26 / 자본제외TP26) * 100 : 0;
                      
                      // 유동자산, 유동부채 찾기
                      const 자산Children = 자산.children || [];
                      const 유동자산 = 자산Children.find(r => r.account === '유동자산');
                      
                      const 유동자산26 = 유동자산?.values[13] || 0;
                      const 유동부채26 = 유동부채?.values[13] || 0;
                      const 유동자산25 = 유동자산?.values[1] || 0;
                      const 유동부채25 = 유동부채?.values[1] || 0;
                      
                      // 비율 계산
                      const 부채비율26 = 총자본26 !== 0 ? (총부채26 / 총자본26) * 100 : 0;
                      const 부채비율25 = 총자본25 !== 0 ? (총부채25 / 총자본25) * 100 : 0;
                      const 유동비율26 = 유동부채26 !== 0 ? (유동자산26 / 유동부채26) * 100 : 0;
                      const 유동비율25 = 유동부채25 !== 0 ? (유동자산25 / 유동부채25) * 100 : 0;
                      const 자기자본비율26 = 총자산26 !== 0 ? (총자본26 / 총자산26) * 100 : 0;
                      
                      return (
                        <div className="mb-5 grid gap-3 xl:grid-cols-4">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {isEnglish ? 'Total Assets' : '총자산'}
                            </div>
                            <div className="mt-1.5 text-[25px] font-bold leading-none text-slate-900">
                              {formatNumber(총자산26)}
                            </div>
                            <div className="mt-2 text-xs text-slate-500">
                              {isEnglish ? `2025 YE ${formatNumber(총자산25)}` : `2025년말 ${formatNumber(총자산25)}`}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {isEnglish ? 'Debt Ratio' : '부채비율'}
                            </div>
                            <div className="mt-1.5 text-[25px] font-bold leading-none text-[#dd6b20]">
                              {부채비율26.toFixed(1)}%
                            </div>
                            <div className="mt-2 text-xs text-slate-500">
                              {isEnglish ? `2025 YE ${부채비율25.toFixed(1)}%` : `2025년말 ${부채비율25.toFixed(1)}%`}
                            </div>
                            <div className="mt-1 text-xs font-medium text-slate-600">
                              {isEnglish ? `Ex TP ${부채비율제외TP26.toFixed(1)}%` : `TP채무 제외 ${부채비율제외TP26.toFixed(1)}%`}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {isEnglish ? 'Current Ratio' : '유동비율'}
                            </div>
                            <div className="mt-1.5 text-[25px] font-bold leading-none text-[#0f766e]">
                              {유동비율26.toFixed(1)}%
                            </div>
                            <div className="mt-2 text-xs text-slate-500">
                              {isEnglish ? `2025 YE ${유동비율25.toFixed(1)}%` : `2025년말 ${유동비율25.toFixed(1)}%`}
                            </div>
                            <div className="mt-1 text-xs font-medium text-slate-600">
                              {isEnglish ? 'Short-term liquidity check' : '단기 유동성 점검'}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {isEnglish ? 'Equity Ratio' : '자기자본비율'}
                            </div>
                            <div className="mt-1.5 text-[25px] font-bold leading-none text-[#2563eb]">
                              {자기자본비율26.toFixed(1)}%
                            </div>
                            <div className="mt-2 text-xs text-slate-500">
                              {isEnglish ? `Equity ${formatNumber(총자본26)} / Liab. ${formatNumber(총부채26)}` : `자본 ${formatNumber(총자본26)} / 부채 ${formatNumber(총부채26)}`}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                  </>
                )}
                {bsFinancialData && (
                  <section className="rounded-[22px] border border-transparent bg-transparent p-0 shadow-none">
                    <div className="mb-1 flex items-center gap-3">
                      <div>
                        <h2 className="text-[17px] font-bold tracking-tight text-slate-900">{isEnglish ? 'Financial Position (BS)' : '재무상태 (BS)'}</h2>
                        <span className="text-xs font-medium text-slate-500">{smallUnitLabel}</span>
                      </div>
                      <button
                        onClick={() => setBsFinancialCollapsed(!bsFinancialCollapsed)}
                        className="ml-auto rounded-xl border border-white/50 bg-white/70 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white/90"
                      >
                        {toggleRowsLabel(bsFinancialCollapsed)}
                      </button>
                    </div>
                    <FinancialTable 
                      data={withPlanMetrics.bs ?? bsFinancialData}
                      columns={[...monthColumns, isEnglish ? `${String(wcYear).slice(-2)} (Year-end)` : `${String(wcYear).slice(-2)}년(기말)`, 'YoY', isEnglish ? 'Remarks' : '비고']}
                      locale={locale}
                      showTotal
                      isBalanceSheet={true}
                      showPlanMetricsColumns={true}
                      monthsCollapsed={bsMonthsCollapsed}
                      onMonthsToggle={() => setBsMonthsCollapsed(!bsMonthsCollapsed)}
                      currentYear={wcYear}
                      allRowsCollapsed={bsFinancialCollapsed}
                      onAllRowsToggle={() => setBsFinancialCollapsed(!bsFinancialCollapsed)}
                      showRemarks={true}
                      remarksWidth={240}
                      compactLayout={true}
                      remarks={bsRemarks}
                      onRemarkChange={saveBSRemark}
                    />
                  </section>
                )}
                {wcStatementDataForView && (
                  <section className="mt-6 rounded-[22px] border border-transparent bg-transparent p-0 shadow-none">
                    <div className="mb-1 flex items-center gap-3">
                      <div>
                        <h2 className="text-[17px] font-bold tracking-tight text-slate-900">{isEnglish ? 'Working Capital Statement' : '운전자본표'}</h2>
                        <span className="text-xs font-medium text-slate-500">{smallUnitLabel}</span>
                      </div>
                      <button
                        onClick={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                        className="ml-auto rounded-xl border border-white/50 bg-white/70 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white/90"
                      >
                        {toggleRowsLabel(wcStatementAllRowsCollapsed)}
                      </button>
                    </div>
                    <FinancialTable 
                      data={withPlanMetrics.wc ?? wcStatementDataForView} 
                      columns={[...monthColumns, isEnglish ? `${String(wcYear).slice(-2)} (Year-end)` : `${String(wcYear).slice(-2)}년(기말)`, 'YoY', isEnglish ? 'Remarks' : '비고']} 
                      locale={locale}
                      showTotal
                      isCashFlow={true}
                      isWorkingCapital={true}
                      monthsCollapsed={bsMonthsCollapsed}
                      onMonthsToggle={() => setBsMonthsCollapsed(!bsMonthsCollapsed)}
                      currentYear={wcYear}
                      allRowsCollapsed={wcStatementAllRowsCollapsed}
                      onAllRowsToggle={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                      showRemarks={true}
                      remarksWidth={240}
                      compactLayout={true}
                      remarks={wcRemarks}
                      onRemarkChange={saveWCRemark}
                    />
                  </section>
                )}
                {wcStatementDataForView && (
                  <div className="mt-6">
                    {renderMonthlyWorkingCapitalSection()}
                  </div>
                )}
              </div>
            )}
            
            {/* P/L 화면 */}
            {effectiveView === 'PL' && !loading && (
              <PLPage locale={locale} />
            )}

            {effectiveView === 'INVENTORY' && !loading && (
              <InventoryPage locale={locale} />
            )}
            
            {/* C/F 화면 */}
            {(cfDataForView || wcStatementDataForView) && !loading && effectiveView === 'CF' && (
              <div className="px-4 pt-4 pb-6">
                {workingCapitalMonthsCollapsed ? (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 flex-shrink-0" style={{ minWidth: 0 }}>
                      {cfDataForView && (
                        <>
                          <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-lg font-bold text-gray-800">{isEnglish ? 'CF Stmt.' : '현금흐름표'}</h2>
                            <span className="text-sm text-gray-500">{smallUnitLabel}</span>
                            <button
                              onClick={() => setWcAllRowsCollapsed(!wcAllRowsCollapsed)}
                              className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                            >
                              {toggleRowsLabel(wcAllRowsCollapsed)}
                            </button>
                          </div>
                          <FinancialTable 
                            data={withPlanMetrics.cf ?? cfDataForView} 
                            columns={[...monthColumns, isEnglish ? `${String(wcYear).slice(-2)} (Total)` : `${String(wcYear).slice(-2)}년(합계)`, 'YoY']} 
                            locale={locale}
                            showTotal
                            isCashFlow={true}
                            compactLayout={true}
                            remarksWidth={280}
                            monthsCollapsed={workingCapitalMonthsCollapsed}
                            onMonthsToggle={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                            currentYear={wcYear}
                            allRowsCollapsed={wcAllRowsCollapsed}
                            onAllRowsToggle={() => setWcAllRowsCollapsed(!wcAllRowsCollapsed)}
                            defaultExpandedAccounts={CF_DEFAULT_EXPANDED_ACCOUNTS}
                            showRemarks={true}
                            remarks={cfRemarks}
                            onRemarkChange={saveCFRemark}
                          />
                        </>
                      )}
                      {wcStatementDataForView && (
                        <div className="mt-8 pt-6 border-t-2 border-gray-400">
                          <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-lg font-bold text-gray-800">{isEnglish ? 'WC Stmt.' : '운전자본표'}</h2>
                            <span className="text-sm text-gray-500">{smallUnitLabel}</span>
                            <button
                              onClick={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                              className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                            >
                              {toggleRowsLabel(wcStatementAllRowsCollapsed)}
                            </button>
                          </div>
                          <FinancialTable 
                            data={withPlanMetrics.wc ?? wcStatementDataForView} 
                            columns={[...monthColumns, isEnglish ? `${String(wcYear).slice(-2)} (Year-end)` : `${String(wcYear).slice(-2)}년(기말)`, 'YoY', isEnglish ? 'Remarks' : '비고']} 
                            locale={locale}
                            showTotal
                            isCashFlow={true}
                            isWorkingCapital={true}
                            compactLayout={true}
                            remarksWidth={280}
                            monthsCollapsed={workingCapitalMonthsCollapsed}
                            onMonthsToggle={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                            currentYear={wcYear}
                            allRowsCollapsed={wcStatementAllRowsCollapsed}
                            onAllRowsToggle={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                            showRemarks={true}
                            remarks={wcRemarks}
                            onRemarkChange={saveWCRemark}
                          />
                          {renderMonthlyWorkingCapitalSection()}
                        </div>
                      )}
                    </div>
                    <div
                      className="hidden lg:block mx-0.5 w-1 rounded cursor-col-resize bg-slate-300/90 hover:bg-blue-400 transition-colors"
                      style={{ height: 'calc(100vh - 220px)' }}
                      onMouseDown={startAnalysisResize}
                    />
                    <aside
                      className="hidden lg:block rounded-lg border border-slate-200/80 bg-white/92 p-4 shadow-sm overflow-y-auto max-h-[calc(100vh-200px)] flex-shrink-0"
                      style={{ width: `${analysisPanelWidth}px`, minWidth: '168px' }}
                    >
                      <EditableAnalysis
                        key={`cf-analysis-${salesYoYRate}-${locale}`}
                        year={wcYear}
                        locale={locale}
                        disabled={false}
                        preferGeneratedContent
                        initialContent={analysisResults ? {
                          keyInsights: analysisResults.insights.keyInsights,
                          cfAnalysis: analysisResults.cfAnalysis,
                          wcAnalysis: analysisResults.wcAnalysis,
                          riskFactors: analysisResults.insights.riskFactors,
                          actionItems: analysisResults.insights.actionItems,
                        } : null}
                      />
                    </aside>
                  </div>
                ) : (
                  <>
                    {cfDataForView && (
                      <>
                        <div className="flex items-center gap-2 mb-4">
                          <h2 className="text-lg font-bold text-gray-800">{isEnglish ? 'CF Stmt.' : '현금흐름표'}</h2>
                          <span className="text-sm text-gray-500">{smallUnitLabel}</span>
                          <button
                            onClick={() => setWcAllRowsCollapsed(!wcAllRowsCollapsed)}
                            className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                          >
                            {toggleRowsLabel(wcAllRowsCollapsed)}
                          </button>
                        </div>
                        <FinancialTable 
                          data={withPlanMetrics.cf ?? cfDataForView} 
                          columns={[...monthColumns, isEnglish ? `${String(wcYear).slice(-2)} (Total)` : `${String(wcYear).slice(-2)}년(합계)`, 'YoY']} 
                          locale={locale}
                          showTotal
                          isCashFlow={true}
                          compactLayout={true}
                          remarksWidth={280}
                          monthsCollapsed={workingCapitalMonthsCollapsed}
                          onMonthsToggle={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                          currentYear={wcYear}
                          allRowsCollapsed={wcAllRowsCollapsed}
                          onAllRowsToggle={() => setWcAllRowsCollapsed(!wcAllRowsCollapsed)}
                          defaultExpandedAccounts={CF_DEFAULT_EXPANDED_ACCOUNTS}
                          showRemarks={true}
                          remarks={cfRemarks}
                          onRemarkChange={saveCFRemark}
                        />
                      </>
                    )}
                    {wcStatementDataForView && (
                      <div className="mt-8 pt-6 border-t-2 border-gray-400">
                        <div className="flex items-center gap-2 mb-4">
                          <h2 className="text-lg font-bold text-gray-800">{isEnglish ? 'WC Stmt.' : '운전자본표'}</h2>
                          <span className="text-sm text-gray-500">{smallUnitLabel}</span>
                          <button
                            onClick={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                            className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                          >
                            {toggleRowsLabel(wcStatementAllRowsCollapsed)}
                          </button>
                        </div>
                        <FinancialTable 
                          data={withPlanMetrics.wc ?? wcStatementDataForView} 
                          columns={[...monthColumns, isEnglish ? `${String(wcYear).slice(-2)} (Year-end)` : `${String(wcYear).slice(-2)}년(기말)`, 'YoY', isEnglish ? 'Remarks' : '비고']} 
                          locale={locale}
                          showTotal
                          isCashFlow={true}
                          isWorkingCapital={true}
                          compactLayout={true}
                          remarksWidth={280}
                          monthsCollapsed={workingCapitalMonthsCollapsed}
                          onMonthsToggle={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                          currentYear={wcYear}
                          allRowsCollapsed={wcStatementAllRowsCollapsed}
                          onAllRowsToggle={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                          showRemarks={true}
                          remarks={wcRemarks}
                          onRemarkChange={saveWCRemark}
                        />
                        {renderMonthlyWorkingCapitalSection()}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
