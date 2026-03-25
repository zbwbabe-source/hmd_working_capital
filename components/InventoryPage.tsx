'use client';

import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import type {
  InventoryBrandGroup,
  InventoryMatrixResponse,
  InventoryMatrixRow,
  InventoryMatrixSection,
} from '@/lib/inventory';

const BRAND_OPTIONS: InventoryBrandGroup[] = ['MLB'];

const BRAND_LABELS: Record<InventoryBrandGroup, string> = {
  ALL: '전체',
  MLB: 'MLB',
  Discovery: 'Discovery',
};

const REGION_TITLES: Record<InventoryMatrixSection['regionGroup'], string> = {
  TOTAL: '합산 재고 (K)',
  HKMC: '홍마 재고 (K)',
  TW: '대만 재고 (K)',
};

const METRIC_HEADER_CLASS = 'bg-amber-50';
const METRIC_CELL_CLASS = 'bg-amber-50/60';

type DisplayRow = InventoryMatrixRow & {
  inbound25DisplayAmtK: number;
  begin26DisplayAmtK: number;
  inbound26DisplayAmtK: number;
  sales26DisplayAmtK: number;
  ending26DisplayAmtK: number;
  metric25Value: number | null;
  metric26Value: number | null;
  metricDelta: number | null;
  endingYoY: number | null;
  inboundYoY: number | null;
  salesYoY: number | null;
};

type RawMatrixRow = {
  categoryLabel: string;
  begin25: number;
  inbound25: number;
  available25: number;
  sales25: number;
  ending25: number;
  begin26: number;
  inbound26Feb: number;
  sales26Feb: number;
  ending26Feb: number;
  inbound26Rest: number;
  sales26Rest: number;
  inbound26Total: number;
  sales26Total: number;
  ending26: number;
  isSubtotal: boolean;
  sortOrder: number;
};

function formatMetric(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatRawMetric(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

function formatYoY(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return `${(value * 100).toFixed(0)}%`;
}

function formatWeeks(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return `${value.toFixed(1)}주`;
}

function getDisplayInbound(value: number): number {
  return value < 0 ? 0 : value;
}

function getSubtotalSourceRows(rows: InventoryMatrixRow[], categoryLabel: string): InventoryMatrixRow[] {
  if (categoryLabel === '의류합계') {
    return rows.filter((row) =>
      ['당년F', '당년S', '1년차', '2년차', '차기시즌', '과시즌'].includes(row.categoryLabel)
    );
  }

  if (categoryLabel === 'ACC합계') {
    return rows.filter((row) => ['신발', '모자', '가방', '기타'].includes(row.categoryLabel));
  }

  return [];
}

function isApparelCategory(categoryLabel: string): boolean {
  return ['의류합계', '당년F', '당년S', '1년차', '2년차', '차기시즌', '과시즌'].includes(categoryLabel);
}

function isAccessoryCategory(categoryLabel: string): boolean {
  return ['ACC합계', '신발', '모자', '가방', '기타'].includes(categoryLabel);
}

function getAdjustedBegin26(item: InventoryMatrixRow): number {
  if (item.categoryLabel === '당년S') {
    return 0;
  }

  return item.begin26AmtK;
}

function getAdjustedInbound26(item: InventoryMatrixRow): number {
  const baseInbound = getDisplayInbound(item.inbound26FebAmtK) + getDisplayInbound(item.inbound26RestAmtK);

  if (item.categoryLabel === '당년S') {
    return baseInbound + item.begin26AmtK;
  }

  return baseInbound;
}

function getYoY(value26: number, value25: number): number | null {
  if (!Number.isFinite(value25) || value25 === 0) return null;
  return value26 / value25;
}

function getMetricDeltaStyle(row: DisplayRow): React.CSSProperties | undefined {
  if (row.metricDelta === null || !Number.isFinite(row.metricDelta) || row.metricDelta === 0) {
    return undefined;
  }

  if (isApparelCategory(row.categoryLabel)) {
    return row.metricDelta > 0 ? { color: '#16a34a' } : { color: '#dc2626' };
  }

  if (isAccessoryCategory(row.categoryLabel)) {
    return row.metricDelta < 0 ? { color: '#16a34a' } : { color: '#dc2626' };
  }

  return undefined;
}

function renderEndingMetric(row: DisplayRow): string {
  if (isApparelCategory(row.categoryLabel)) {
    return formatRatio(row.metric26Value);
  }

  if (isAccessoryCategory(row.categoryLabel)) {
    return formatWeeks(row.metric26Value);
  }

  return '-';
}

function renderMetricDelta(row: DisplayRow): string {
  if (row.metricDelta === null || !Number.isFinite(row.metricDelta)) return '-';

  if (isApparelCategory(row.categoryLabel)) {
    const prefix = row.metricDelta > 0 ? '+' : row.metricDelta < 0 ? '△' : '';
    return `${prefix}${Math.abs(row.metricDelta * 100).toFixed(1)}%p`;
  }

  if (isAccessoryCategory(row.categoryLabel)) {
    const prefix = row.metricDelta > 0 ? '+' : row.metricDelta < 0 ? '△' : '';
    return `${prefix}${Math.abs(row.metricDelta).toFixed(1)}주`;
  }

  return '-';
}

function toDisplayRow(row: InventoryMatrixRow, sourceRows?: InventoryMatrixRow[]): DisplayRow {
  const items = sourceRows && sourceRows.length > 0 ? sourceRows : [row];

  const inbound25DisplayAmtK = items.reduce((sum, item) => sum + getDisplayInbound(item.inboundAmtK), 0);
  const sales25AmtK = items.reduce((sum, item) => sum + item.salesAmtK, 0);
  const ending25AmtK = items.reduce((sum, item) => sum + item.endingAmtK, 0);
  const begin25AmtK = items.reduce((sum, item) => sum + item.beginAmtK, 0);

  const begin26DisplayAmtK = items.reduce((sum, item) => sum + getAdjustedBegin26(item), 0);
  const inbound26DisplayAmtK = items.reduce((sum, item) => sum + getAdjustedInbound26(item), 0);
  const sales26DisplayAmtK = items.reduce((sum, item) => sum + item.sales26FebAmtK + item.sales26RestAmtK, 0);
  const ending26DisplayAmtK = items.reduce((sum, item) => sum + item.ending26AmtK, 0);

  let metric25Value: number | null = null;
  let metric26Value: number | null = null;

  if (isApparelCategory(row.categoryLabel)) {
    const denom25 = begin25AmtK + inbound25DisplayAmtK;
    const denom26 = begin26DisplayAmtK + inbound26DisplayAmtK;
    metric25Value = denom25 > 0 ? sales25AmtK / denom25 : null;
    metric26Value = denom26 > 0 ? sales26DisplayAmtK / denom26 : null;
  } else if (isAccessoryCategory(row.categoryLabel)) {
    metric25Value = sales25AmtK > 0 ? (ending25AmtK / sales25AmtK) * 52 : null;
    metric26Value = sales26DisplayAmtK > 0 ? (ending26DisplayAmtK / sales26DisplayAmtK) * 52 : null;
  }

  const metricDelta =
    metric25Value !== null && metric26Value !== null ? metric26Value - metric25Value : null;

  return {
    ...row,
    begin26AmtK: begin26DisplayAmtK,
    ending26AmtK: ending26DisplayAmtK,
    inbound25DisplayAmtK,
    begin26DisplayAmtK,
    inbound26DisplayAmtK,
    sales26DisplayAmtK,
    ending26DisplayAmtK,
    metric25Value,
    metric26Value,
    metricDelta,
    endingYoY: getYoY(ending26DisplayAmtK, ending25AmtK),
    inboundYoY: getYoY(inbound26DisplayAmtK, inbound25DisplayAmtK),
    salesYoY: getYoY(sales26DisplayAmtK, sales25AmtK),
  };
}

function toRawMatrixRow(row: InventoryMatrixRow, sourceRows?: InventoryMatrixRow[]): RawMatrixRow {
  const items = sourceRows && sourceRows.length > 0 ? sourceRows : [row];

  const begin25 = items.reduce((sum, item) => sum + item.beginAmtK, 0);
  const inbound25 = items.reduce((sum, item) => sum + item.inboundAmtK, 0);
  const sales25 = items.reduce((sum, item) => sum + item.salesAmtK, 0);
  const ending25 = items.reduce((sum, item) => sum + item.endingAmtK, 0);

  const begin26 = items.reduce((sum, item) => sum + getAdjustedBegin26(item), 0);
  const inbound26Feb = items.reduce((sum, item) => {
    const moved = item.categoryLabel === '당년S' ? item.begin26AmtK : 0;
    return sum + item.inbound26FebAmtK + moved;
  }, 0);
  const sales26Feb = items.reduce((sum, item) => sum + item.sales26FebAmtK, 0);
  const ending26Feb = items.reduce((sum, item) => sum + item.ending26FebAmtK, 0);
  const inbound26Rest = items.reduce((sum, item) => sum + item.inbound26RestAmtK, 0);
  const sales26Rest = items.reduce((sum, item) => sum + item.sales26RestAmtK, 0);
  const ending26 = items.reduce((sum, item) => sum + item.ending26AmtK, 0);

  return {
    categoryLabel: row.categoryLabel,
    begin25,
    inbound25,
    available25: begin25 + inbound25,
    sales25,
    ending25,
    begin26,
    inbound26Feb,
    sales26Feb,
    ending26Feb,
    inbound26Rest,
    sales26Rest,
    inbound26Total: inbound26Feb + inbound26Rest,
    sales26Total: sales26Feb + sales26Rest,
    ending26,
    isSubtotal: row.isSubtotal,
    sortOrder: row.sortOrder,
  };
}

function InventoryMatrixTable({
  title,
  rows,
  showHistory,
}: {
  title: string;
  rows: InventoryMatrixRow[];
  showHistory: boolean;
}) {
  const totalRowBase = rows.reduce<InventoryMatrixRow>(
    (acc, row) => {
      if (row.isSubtotal) return acc;

      return {
        ...acc,
        beginAmtK: acc.beginAmtK + row.beginAmtK,
        inboundAmtK: acc.inboundAmtK + row.inboundAmtK,
        salesAmtK: acc.salesAmtK + row.salesAmtK,
        endingAmtK: acc.endingAmtK + row.endingAmtK,
        changeAmtK: acc.changeAmtK + row.changeAmtK,
        begin26AmtK: acc.begin26AmtK + row.begin26AmtK,
        inbound26FebAmtK: acc.inbound26FebAmtK + row.inbound26FebAmtK,
        sales26FebAmtK: acc.sales26FebAmtK + row.sales26FebAmtK,
        ending26FebAmtK: acc.ending26FebAmtK + row.ending26FebAmtK,
        inbound26RestAmtK: acc.inbound26RestAmtK + row.inbound26RestAmtK,
        sales26RestAmtK: acc.sales26RestAmtK + row.sales26RestAmtK,
        ending26AmtK: acc.ending26AmtK + row.ending26AmtK,
        metric26: 0,
      };
    },
    {
      categoryLabel: 'Total',
      beginAmtK: 0,
      inboundAmtK: 0,
      salesAmtK: 0,
      endingAmtK: 0,
      changeAmtK: 0,
      begin26AmtK: 0,
      inbound26FebAmtK: 0,
      sales26FebAmtK: 0,
      ending26FebAmtK: 0,
      inbound26RestAmtK: 0,
      sales26RestAmtK: 0,
      ending26AmtK: 0,
      metric26: 0,
      isSubtotal: true,
      sortOrder: Number.MAX_SAFE_INTEGER,
    }
  );

  const displayRows: DisplayRow[] = [
    ...rows.map((row) => {
      const subtotalSourceRows = row.isSubtotal ? getSubtotalSourceRows(rows, row.categoryLabel) : undefined;
      return toDisplayRow(row, subtotalSourceRows);
    }),
    toDisplayRow(totalRowBase),
  ];

  const totalDisplayRow = displayRows[displayRows.length - 1];
  const totalBeginYoY = getYoY(totalDisplayRow.begin26DisplayAmtK, totalDisplayRow.endingAmtK);
  const totalInboundYoY = totalDisplayRow.inboundYoY;
  const totalSalesYoY = totalDisplayRow.salesYoY;
  const totalEndingYoY = totalDisplayRow.endingYoY;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">기준: 2024-12-31 / 2025년 / 2026년 계획</p>
          </div>
          <div className="text-xs font-medium text-slate-500">단위: 1,000 HKD</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <colgroup>
            <col style={{ width: '140px' }} />
            {showHistory && <col style={{ width: '120px' }} />}
            {showHistory && <col style={{ width: '120px' }} />}
            {showHistory && <col style={{ width: '120px' }} />}
            {showHistory && <col style={{ width: '120px' }} />}
            <col style={{ width: '120px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '96px' }} />
            <col style={{ width: '96px' }} />
            <col style={{ width: '96px' }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left font-semibold">
                구분
              </th>
              {showHistory && (
                <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">24년말</th>
              )}
              {showHistory && (
                <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">25년 입고</th>
              )}
              {showHistory && (
                <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">25년 판매</th>
              )}
              {showHistory && (
                <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">25년말</th>
              )}
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">26년 기초재고</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">26년 입고(e)</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">26년 판매(e)</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">26년 기말재고(e)</th>
              <th className={`border-b border-r border-slate-200 px-4 py-3 text-right font-semibold ${METRIC_HEADER_CLASS}`}>판매율/재고주수</th>
              <th className={`border-b border-r border-slate-200 px-4 py-3 text-right font-semibold ${METRIC_HEADER_CLASS}`}>전년비 증감</th>
              <th className={`border-b border-r border-slate-200 px-4 py-3 text-right font-semibold ${METRIC_HEADER_CLASS}`}>재고 YoY</th>
              <th className={`border-b border-r border-slate-200 px-4 py-3 text-right font-semibold ${METRIC_HEADER_CLASS}`}>입고 YoY</th>
              <th className={`border-b border-slate-200 px-4 py-3 text-right font-semibold ${METRIC_HEADER_CLASS}`}>판매 YoY</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const bgClass = row.isSubtotal ? 'bg-slate-50' : 'bg-white';
              const textClass = row.isSubtotal ? 'font-bold text-slate-900' : 'text-slate-600';

              return (
                <tr key={`${title}-${row.categoryLabel}`} className={bgClass}>
                  <td className={`sticky left-0 z-10 border-b border-r border-slate-200 px-4 py-2.5 ${bgClass} ${textClass}`}>
                    {row.categoryLabel}
                  </td>
                  {showHistory && (
                    <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                      {formatMetric(row.beginAmtK)}
                    </td>
                  )}
                  {showHistory && (
                    <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                      {formatMetric(row.inbound25DisplayAmtK)}
                    </td>
                  )}
                  {showHistory && (
                    <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                      {formatMetric(row.salesAmtK)}
                    </td>
                  )}
                  {showHistory && (
                    <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                      {formatMetric(row.endingAmtK)}
                    </td>
                  )}
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                    {formatMetric(row.begin26DisplayAmtK)}
                  </td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                    {formatMetric(row.inbound26DisplayAmtK)}
                  </td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                    {formatMetric(row.sales26DisplayAmtK)}
                  </td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                    {formatMetric(row.ending26DisplayAmtK)}
                  </td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass} ${METRIC_CELL_CLASS}`}>
                    {renderEndingMetric(row)}
                  </td>
                  <td
                    className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass} ${METRIC_CELL_CLASS}`}
                    style={getMetricDeltaStyle(row)}
                  >
                    {renderMetricDelta(row)}
                  </td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass} ${METRIC_CELL_CLASS}`}>
                    {formatYoY(row.endingYoY)}
                  </td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass} ${METRIC_CELL_CLASS}`}>
                    {formatYoY(row.inboundYoY)}
                  </td>
                  <td className={`border-b border-slate-200 px-4 py-2.5 text-right ${textClass} ${METRIC_CELL_CLASS}`}>
                    {formatYoY(row.salesYoY)}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-slate-50">
              <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-4 py-2.5 font-semibold text-slate-900">
                전년비
              </td>
              {showHistory && <td className="border-b border-r border-slate-200 px-4 py-2.5 text-right text-slate-500">-</td>}
              {showHistory && <td className="border-b border-r border-slate-200 px-4 py-2.5 text-right text-slate-500">-</td>}
              {showHistory && <td className="border-b border-r border-slate-200 px-4 py-2.5 text-right text-slate-500">-</td>}
              {showHistory && <td className="border-b border-r border-slate-200 px-4 py-2.5 text-right text-slate-500">-</td>}
              <td className="border-b border-r border-slate-200 px-4 py-2.5 text-right font-semibold text-slate-700">
                {formatYoY(totalBeginYoY)}
              </td>
              <td className="border-b border-r border-slate-200 px-4 py-2.5 text-right font-semibold text-slate-700">
                {formatYoY(totalInboundYoY)}
              </td>
              <td className="border-b border-r border-slate-200 px-4 py-2.5 text-right font-semibold text-slate-700">
                {formatYoY(totalSalesYoY)}
              </td>
              <td className="border-b border-r border-slate-200 px-4 py-2.5 text-right font-semibold text-slate-700">
                {formatYoY(totalEndingYoY)}
              </td>
              <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right text-slate-500 ${METRIC_CELL_CLASS}`}>-</td>
              <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right text-slate-500 ${METRIC_CELL_CLASS}`}>-</td>
              <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right text-slate-500 ${METRIC_CELL_CLASS}`}>-</td>
              <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right text-slate-500 ${METRIC_CELL_CLASS}`}>-</td>
              <td className={`border-b border-slate-200 px-4 py-2.5 text-right text-slate-500 ${METRIC_CELL_CLASS}`}>-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RawInventoryMatrixTable({
  title,
  rows,
}: {
  title: string;
  rows: InventoryMatrixRow[];
}) {
  const totalRowBase = rows.reduce<InventoryMatrixRow>(
    (acc, row) => {
      if (row.isSubtotal) return acc;

      return {
        ...acc,
        beginAmtK: acc.beginAmtK + row.beginAmtK,
        inboundAmtK: acc.inboundAmtK + row.inboundAmtK,
        salesAmtK: acc.salesAmtK + row.salesAmtK,
        endingAmtK: acc.endingAmtK + row.endingAmtK,
        changeAmtK: acc.changeAmtK + row.changeAmtK,
        begin26AmtK: acc.begin26AmtK + row.begin26AmtK,
        inbound26FebAmtK: acc.inbound26FebAmtK + row.inbound26FebAmtK,
        sales26FebAmtK: acc.sales26FebAmtK + row.sales26FebAmtK,
        ending26FebAmtK: acc.ending26FebAmtK + row.ending26FebAmtK,
        inbound26RestAmtK: acc.inbound26RestAmtK + row.inbound26RestAmtK,
        sales26RestAmtK: acc.sales26RestAmtK + row.sales26RestAmtK,
        ending26AmtK: acc.ending26AmtK + row.ending26AmtK,
        metric26: 0,
      };
    },
    {
      categoryLabel: 'Total',
      beginAmtK: 0,
      inboundAmtK: 0,
      salesAmtK: 0,
      endingAmtK: 0,
      changeAmtK: 0,
      begin26AmtK: 0,
      inbound26FebAmtK: 0,
      sales26FebAmtK: 0,
      ending26FebAmtK: 0,
      inbound26RestAmtK: 0,
      sales26RestAmtK: 0,
      ending26AmtK: 0,
      metric26: 0,
      isSubtotal: true,
      sortOrder: Number.MAX_SAFE_INTEGER,
    }
  );

  const rawRows: RawMatrixRow[] = [
    ...rows.map((row) => {
      const subtotalSourceRows = row.isSubtotal ? getSubtotalSourceRows(rows, row.categoryLabel) : undefined;
      return toRawMatrixRow(row, subtotalSourceRows);
    }),
    toRawMatrixRow(totalRowBase),
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">업로드 파일 기준 전체 숫자 검증용 매트릭스</p>
          </div>
          <div className="text-xs font-medium text-slate-500">단위: 1,000 HKD</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left font-semibold">
                구분
              </th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">25년 기초</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">25년 입고</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">25년 판매가능</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">25년 판매</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">25년 기말</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">26년 기초재고</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">26년 1-2월 입고</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">26년 1-2월 판매</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">26년 2월말</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">26년 3-12월 입고</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">26년 3-12월 판매</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">26년 총입고</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">26년 총판매</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">26년 기말재고(e)</th>
            </tr>
          </thead>
          <tbody>
            {rawRows.map((row) => {
              const bgClass = row.isSubtotal ? 'bg-slate-50' : 'bg-white';
              const textClass = row.isSubtotal ? 'font-bold text-slate-900' : 'text-slate-600';

              return (
                <tr key={`${title}-raw-${row.categoryLabel}`} className={bgClass}>
                  <td className={`sticky left-0 z-10 border-b border-r border-slate-200 px-4 py-2.5 ${bgClass} ${textClass}`}>
                    {row.categoryLabel}
                  </td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.begin25)}</td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.inbound25)}</td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.available25)}</td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.sales25)}</td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.ending25)}</td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.begin26)}</td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.inbound26Feb)}</td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.sales26Feb)}</td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.ending26Feb)}</td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.inbound26Rest)}</td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.sales26Rest)}</td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.inbound26Total)}</td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.sales26Total)}</td>
                  <td className={`border-b border-slate-200 px-4 py-2.5 text-right ${textClass}`}>{formatRawMetric(row.ending26)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [brand, setBrand] = useState<InventoryBrandGroup>('MLB');
  const [data, setData] = useState<InventoryMatrixResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showRawMatrix, setShowRawMatrix] = useState<boolean>(false);

  const exportRawMatrix = () => {
    if (!data?.sections?.length) return;

    const workbook = XLSX.utils.book_new();

    data.sections.forEach((section) => {
      const totalRowBase = section.rows.reduce<InventoryMatrixRow>(
        (acc, row) => {
          if (row.isSubtotal) return acc;

          return {
            ...acc,
            beginAmtK: acc.beginAmtK + row.beginAmtK,
            inboundAmtK: acc.inboundAmtK + row.inboundAmtK,
            salesAmtK: acc.salesAmtK + row.salesAmtK,
            endingAmtK: acc.endingAmtK + row.endingAmtK,
            changeAmtK: acc.changeAmtK + row.changeAmtK,
            begin26AmtK: acc.begin26AmtK + row.begin26AmtK,
            inbound26FebAmtK: acc.inbound26FebAmtK + row.inbound26FebAmtK,
            sales26FebAmtK: acc.sales26FebAmtK + row.sales26FebAmtK,
            ending26FebAmtK: acc.ending26FebAmtK + row.ending26FebAmtK,
            inbound26RestAmtK: acc.inbound26RestAmtK + row.inbound26RestAmtK,
            sales26RestAmtK: acc.sales26RestAmtK + row.sales26RestAmtK,
            ending26AmtK: acc.ending26AmtK + row.ending26AmtK,
            metric26: 0,
          };
        },
        {
          categoryLabel: 'Total',
          beginAmtK: 0,
          inboundAmtK: 0,
          salesAmtK: 0,
          endingAmtK: 0,
          changeAmtK: 0,
          begin26AmtK: 0,
          inbound26FebAmtK: 0,
          sales26FebAmtK: 0,
          ending26FebAmtK: 0,
          inbound26RestAmtK: 0,
          sales26RestAmtK: 0,
          ending26AmtK: 0,
          metric26: 0,
          isSubtotal: true,
          sortOrder: Number.MAX_SAFE_INTEGER,
        }
      );

      const rawRows = [
        ...section.rows.map((row) => {
          const subtotalSourceRows = row.isSubtotal ? getSubtotalSourceRows(section.rows, row.categoryLabel) : undefined;
          return toRawMatrixRow(row, subtotalSourceRows);
        }),
        toRawMatrixRow(totalRowBase),
      ];

      const sheetRows = rawRows.map((row) => ({
        구분: row.categoryLabel,
        '25년 기초': row.begin25,
        '25년 입고': row.inbound25,
        '25년 판매가능': row.available25,
        '25년 판매': row.sales25,
        '25년 기말': row.ending25,
        '26년 기초재고': row.begin26,
        '26년 1-2월 입고': row.inbound26Feb,
        '26년 1-2월 판매': row.sales26Feb,
        '26년 2월말': row.ending26Feb,
        '26년 3-12월 입고': row.inbound26Rest,
        '26년 3-12월 판매': row.sales26Rest,
        '26년 총입고': row.inbound26Total,
        '26년 총판매': row.sales26Total,
        '26년 기말재고': row.ending26,
      }));

      const worksheet = XLSX.utils.json_to_sheet(sheetRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, section.regionGroup);
    });

    XLSX.writeFile(workbook, 'inventory_raw_matrix.xlsx');
  };

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/fs/inventory?brand=${brand}`, { cache: 'no-store' });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || '재고 데이터를 불러오지 못했습니다.');
        }

        if (!cancelled) {
          setData(result as InventoryMatrixResponse);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Inventory load failed:', err);
          setError(err instanceof Error ? err.message : '재고 데이터를 불러오지 못했습니다.');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [brand]);

  return (
    <div className="px-6 pt-6 pb-10">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              Inventory Matrix
            </div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">브랜드별 재고 매트릭스</h2>
            <div className="mt-3 inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-4 py-1.5 text-sm font-extrabold tracking-wide text-amber-900">
              택가 기준
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              현재 화면은 `2602_inventory.xlsx` 기준 HKMC MLB 데이터만 우선 반영했습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowHistory((prev) => !prev)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              {showHistory ? '25년 표시 숨기기' : '25년 표시 보기'}
            </button>
            {BRAND_OPTIONS.map((option) => {
              const active = brand === option;
              return (
                <button
                  key={option}
                  onClick={() => setBrand(option)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {BRAND_LABELS[option]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
            재고 매트릭스를 불러오는 중입니다.
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center text-sm text-red-600 shadow-sm">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          data?.sections.map((section) => (
            <InventoryMatrixTable
              key={section.regionGroup}
              title={REGION_TITLES[section.regionGroup]}
              rows={section.rows}
              showHistory={showHistory}
            />
          ))}
        {!loading && !error && data?.sections?.length ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setShowRawMatrix((prev) => !prev)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              {showRawMatrix ? '검증 매트릭스 접기' : '검증 매트릭스 보기'}
            </button>
            <button
              onClick={exportRawMatrix}
              className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:border-emerald-400 hover:bg-emerald-100"
            >
              엑셀 저장
            </button>
          </div>
        ) : null}
        {!loading &&
          !error &&
          showRawMatrix &&
          data?.sections.map((section) => (
            <RawInventoryMatrixTable
              key={`${section.regionGroup}-raw`}
              title={`${REGION_TITLES[section.regionGroup]} 원본 숫자 매트릭스`}
              rows={section.rows}
            />
          ))}
      </div>
    </div>
  );
}
