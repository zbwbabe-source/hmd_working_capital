import fs from 'fs/promises';
import path from 'path';
import * as XLSX from 'xlsx';

export type InventoryBrandGroup = 'ALL' | 'MLB' | 'Discovery';
export type InventoryRegionGroup = 'TOTAL' | 'HKMC' | 'TW';

export interface InventoryMatrixRow {
  categoryLabel: string;
  beginAmtK: number;
  inboundAmtK: number;
  salesAmtK: number;
  endingAmtK: number;
  changeAmtK: number;
  begin26AmtK: number;
  inbound26FebAmtK: number;
  sales26FebAmtK: number;
  ending26FebAmtK: number;
  inbound26RestAmtK: number;
  sales26RestAmtK: number;
  ending26AmtK: number;
  metric26: number;
  isSubtotal: boolean;
  sortOrder: number;
}

export interface InventoryMatrixSection {
  regionGroup: InventoryRegionGroup;
  rows: InventoryMatrixRow[];
}

export interface InventoryMatrixResponse {
  brandGroup: InventoryBrandGroup;
  sections: InventoryMatrixSection[];
}

interface InventoryExcelRow {
  label: string;
  begin25: number;
  inbound25: number;
  sales25: number;
  ending25: number;
  begin26: number;
  inbound26Feb: number;
  sales26Feb: number;
  ending26Feb: number;
  inbound26Rest: number;
  sales26Rest: number;
  ending26: number;
  metric26: number;
}

const INVENTORY_FILE_PATHS = {
  HKMC: path.join(process.cwd(), '2602_inventory_HKMC.xlsx'),
  TW: path.join(process.cwd(), '2602_inventory_TW.xlsx'),
} as const;

const SECTION_ORDER: InventoryRegionGroup[] = ['TOTAL', 'HKMC', 'TW'];
const SUBTOTAL_LABELS = new Set(['\uC758\uB958\uD569\uACC4', 'ACC\uD569\uACC4', 'Total']);
const ROW_ORDER = [
  '\uC758\uB958\uD569\uACC4',
  '\uB2F9\uB144F',
  '\uB2F9\uB144S',
  '1\uB144\uCC28',
  '2\uB144\uCC28',
  '\uCC28\uAE30\uC2DC\uC98C',
  '\uACFC\uC2DC\uC98C',
  'ACC\uD569\uACC4',
  '\uC2E0\uBC1C',
  '\uBAA8\uC790',
  '\uAC00\uBC29',
  '\uAE30\uD0C0',
] as const;

type InventoryWorkbookCache = {
  mtimeMs: number;
  rowsPromise: Promise<InventoryExcelRow[]>;
};

const inventoryWorkbookCache = new Map<string, InventoryWorkbookCache>();

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function loadInventoryWorkbook(filePath: string): Promise<InventoryExcelRow[]> {
  const stats = await fs.stat(filePath);
  const cached = inventoryWorkbookCache.get(filePath);

  if (!cached || cached.mtimeMs !== stats.mtimeMs) {
    const rowsPromise = fs.readFile(filePath).then((buffer) => {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const fileName = path.basename(filePath);

      if (!worksheet) {
        throw new Error(`${fileName}에서 시트를 찾을 수 없습니다.`);
      }

      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
        header: 1,
        raw: true,
        defval: null,
      });

      return rows
        .slice(1)
        .map((row) => ({
          label: typeof row[0] === 'string' ? row[0].trim() : '',
          begin25: toNumber(row[1]),
          inbound25: toNumber(row[2]),
          sales25: toNumber(row[4]),
          ending25: toNumber(row[5]),
          begin26: toNumber(row[7]),
          inbound26Feb: toNumber(row[8]),
          sales26Feb: toNumber(row[9]),
          ending26Feb: toNumber(row[10]),
          inbound26Rest: toNumber(row[11]),
          sales26Rest: toNumber(row[12]),
          ending26: toNumber(row[13]),
          metric26: toNumber(row[14]),
        }))
        .filter((row) => row.label && row.label !== 'Total');
    });

    inventoryWorkbookCache.set(filePath, {
      mtimeMs: stats.mtimeMs,
      rowsPromise,
    });
  }

  return inventoryWorkbookCache.get(filePath)!.rowsPromise;
}

function toMatrixRow(row: InventoryExcelRow): InventoryMatrixRow {
  return {
    categoryLabel: row.label,
    beginAmtK: row.begin25,
    inboundAmtK: row.inbound25,
    salesAmtK: row.sales25,
    endingAmtK: row.ending25,
    changeAmtK: row.ending25 - row.begin25,
    begin26AmtK: row.begin26,
    inbound26FebAmtK: row.inbound26Feb,
    sales26FebAmtK: row.sales26Feb,
    ending26FebAmtK: row.ending26Feb,
    inbound26RestAmtK: row.inbound26Rest,
    sales26RestAmtK: row.sales26Rest,
    ending26AmtK: row.ending26,
    metric26: row.metric26,
    isSubtotal: SUBTOTAL_LABELS.has(row.label),
    sortOrder: ROW_ORDER.indexOf(row.label as (typeof ROW_ORDER)[number]) + 1,
  };
}

function sumMetric26(row: Pick<InventoryMatrixRow, 'categoryLabel' | 'ending26AmtK' | 'sales26FebAmtK' | 'sales26RestAmtK'>): number {
  const sales26Total = row.sales26FebAmtK + row.sales26RestAmtK;

  if (row.categoryLabel === '\uB2F9\uB144S') {
    return sales26Total > 0 ? sales26Total / row.ending26AmtK : 0;
  }

  return sales26Total > 0 ? row.ending26AmtK / sales26Total : 0;
}

function mergeRows(left?: InventoryMatrixRow, right?: InventoryMatrixRow): InventoryMatrixRow | null {
  const base = left ?? right;
  if (!base) return null;

  const merged: InventoryMatrixRow = {
    categoryLabel: base.categoryLabel,
    beginAmtK: (left?.beginAmtK ?? 0) + (right?.beginAmtK ?? 0),
    inboundAmtK: (left?.inboundAmtK ?? 0) + (right?.inboundAmtK ?? 0),
    salesAmtK: (left?.salesAmtK ?? 0) + (right?.salesAmtK ?? 0),
    endingAmtK: (left?.endingAmtK ?? 0) + (right?.endingAmtK ?? 0),
    changeAmtK: (left?.changeAmtK ?? 0) + (right?.changeAmtK ?? 0),
    begin26AmtK: (left?.begin26AmtK ?? 0) + (right?.begin26AmtK ?? 0),
    inbound26FebAmtK: (left?.inbound26FebAmtK ?? 0) + (right?.inbound26FebAmtK ?? 0),
    sales26FebAmtK: (left?.sales26FebAmtK ?? 0) + (right?.sales26FebAmtK ?? 0),
    ending26FebAmtK: (left?.ending26FebAmtK ?? 0) + (right?.ending26FebAmtK ?? 0),
    inbound26RestAmtK: (left?.inbound26RestAmtK ?? 0) + (right?.inbound26RestAmtK ?? 0),
    sales26RestAmtK: (left?.sales26RestAmtK ?? 0) + (right?.sales26RestAmtK ?? 0),
    ending26AmtK: (left?.ending26AmtK ?? 0) + (right?.ending26AmtK ?? 0),
    metric26: 0,
    isSubtotal: base.isSubtotal,
    sortOrder: base.sortOrder,
  };

  merged.metric26 = sumMetric26(merged);
  return merged;
}

function buildMatrixRows(workbookRows: InventoryExcelRow[]): InventoryMatrixRow[] {
  return workbookRows.map(toMatrixRow).filter((row) => row.sortOrder > 0);
}

function buildTotalRows(hkmcRows: InventoryMatrixRow[], twRows: InventoryMatrixRow[]): InventoryMatrixRow[] {
  const hkmcByLabel = new Map(hkmcRows.map((row) => [row.categoryLabel, row]));
  const twByLabel = new Map(twRows.map((row) => [row.categoryLabel, row]));
  const labels = Array.from(new Set([...hkmcByLabel.keys(), ...twByLabel.keys()]));

  return labels
    .map((label) => mergeRows(hkmcByLabel.get(label), twByLabel.get(label)))
    .filter((row): row is InventoryMatrixRow => Boolean(row))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getInventoryMatrix(brandGroup: InventoryBrandGroup): Promise<InventoryMatrixResponse> {
  if (brandGroup === 'Discovery') {
    return {
      brandGroup,
      sections: [],
    };
  }

  const [hkmcWorkbookRows, twWorkbookRows] = await Promise.all([
    loadInventoryWorkbook(INVENTORY_FILE_PATHS.HKMC),
    loadInventoryWorkbook(INVENTORY_FILE_PATHS.TW),
  ]);

  const hkmcRows = buildMatrixRows(hkmcWorkbookRows);
  const twRows = buildMatrixRows(twWorkbookRows);
  const totalRows = buildTotalRows(hkmcRows, twRows);

  const sectionsByRegion: Record<InventoryRegionGroup, InventoryMatrixSection> = {
    TOTAL: { regionGroup: 'TOTAL', rows: totalRows },
    HKMC: { regionGroup: 'HKMC', rows: hkmcRows },
    TW: { regionGroup: 'TW', rows: twRows },
  };

  return {
    brandGroup,
    sections: SECTION_ORDER.map((regionGroup) => sectionsByRegion[regionGroup]),
  };
}
