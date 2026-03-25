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

const INVENTORY_FILE_PATH = path.join(process.cwd(), '2602_inventory.xlsx');
const SUBTOTAL_LABELS = new Set(['의류합계', 'ACC합계', 'Total']);
const ROW_ORDER = [
  '의류합계',
  '당년F',
  '당년S',
  '1년차',
  '2년차',
  '차기시즌',
  '과시즌',
  'ACC합계',
  '신발',
  '모자',
  '가방',
  '기타',
];

let inventoryWorkbookCache:
  | {
      mtimeMs: number;
      rowsPromise: Promise<InventoryExcelRow[]>;
    }
  | null = null;

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

async function loadInventoryWorkbook(): Promise<InventoryExcelRow[]> {
  const stats = await fs.stat(INVENTORY_FILE_PATH);

  if (!inventoryWorkbookCache || inventoryWorkbookCache.mtimeMs !== stats.mtimeMs) {
    const rowsPromise = fs.readFile(INVENTORY_FILE_PATH).then((buffer) => {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!worksheet) {
        throw new Error('2602_inventory.xlsx에서 시트를 찾을 수 없습니다.');
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

    inventoryWorkbookCache = {
      mtimeMs: stats.mtimeMs,
      rowsPromise,
    };
  }

  return inventoryWorkbookCache.rowsPromise;
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
    sortOrder: ROW_ORDER.indexOf(row.label) + 1,
  };
}

export async function getInventoryMatrix(brandGroup: InventoryBrandGroup): Promise<InventoryMatrixResponse> {
  const workbookRows = await loadInventoryWorkbook();
  const matrixRows = workbookRows.map(toMatrixRow).filter((row) => row.sortOrder > 0);

  // The uploaded workbook currently contains HKMC MLB data only.
  if (brandGroup === 'Discovery') {
    return {
      brandGroup,
      sections: [],
    };
  }

  return {
    brandGroup,
    sections: [{ regionGroup: 'HKMC', rows: matrixRows }],
  };
}
