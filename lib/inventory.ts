import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';
import { executeSnowflakeQuery } from '@/lib/snowflake';

export type InventoryBrandGroup = 'ALL' | 'MLB' | 'Discovery';
export type InventoryRegionGroup = 'TOTAL' | 'HKMC' | 'TW';

export interface InventoryMatrixRow {
  categoryLabel: string;
  beginAmtK: number;
  inboundAmtK: number;
  salesAmtK: number;
  endingAmtK: number;
  changeAmtK: number;
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

interface CountryMapRow {
  Country: string;
  LOCAL_SHOP_CD: string;
}

interface CategoryMapRow {
  BRD_CD: string;
  CTGR: string;
  SUB_CTGR: string;
  CTGR_GRP: string;
}

interface InventoryQueryRow {
  REGION_GROUP: InventoryRegionGroup;
  CATEGORY_LABEL: string;
  BEGIN_AMT_K_HKD: number | string | null;
  INBOUND_AMT_K_HKD: number | string | null;
  SALES_AMT_K_HKD: number | string | null;
  ENDING_AMT_K_HKD: number | string | null;
  CHANGE_AMT_K_HKD: number | string | null;
  IS_SUBTOTAL: boolean | string | number | null;
  SORT_ORDER: number | string | null;
}

const FX_DIVISOR = 4.0279;
const BEGIN_YYYYMM = '202412';
const END_STOCK_DT = '2026-01-01';
const SALES_DATE_FROM = '2025-01-01';
const SALES_DATE_TO = '2025-12-31';

let countryMapPromise: Promise<CountryMapRow[]> | null = null;
let categoryMapPromise: Promise<CategoryMapRow[]> | null = null;

function parseCsv<T>(content: string): T[] {
  const parsed = Papa.parse<T>(content, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message || 'Failed to parse CSV.');
  }

  return parsed.data;
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return 0;
}

function toBoolean(value: boolean | string | number | null | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}

async function loadCountryMap(): Promise<CountryMapRow[]> {
  if (!countryMapPromise) {
    countryMapPromise = fs
      .readFile(path.join(process.cwd(), 'country_code.csv'), 'utf8')
      .then((content) => parseCsv<CountryMapRow>(content))
      .then((rows) => rows.filter((row) => row.Country?.trim() && row.LOCAL_SHOP_CD?.trim()))
      .then((rows) =>
        rows.map((row) => ({
          Country: row.Country.trim(),
          LOCAL_SHOP_CD: row.LOCAL_SHOP_CD.trim(),
        }))
      );
  }

  return countryMapPromise;
}

async function loadCategoryMap(): Promise<CategoryMapRow[]> {
  if (!categoryMapPromise) {
    categoryMapPromise = fs
      .readFile(path.join(process.cwd(), 'Ctgy_mapping.csv'), 'utf8')
      .then((content) => parseCsv<CategoryMapRow>(content))
      .then((rows) => rows.filter((row) => row.BRD_CD?.trim() && row.SUB_CTGR?.trim()));
  }

  return categoryMapPromise;
}

function buildCountryMapSql(rows: CountryMapRow[]): string {
  const values = rows
    .map(
      (row) => `('${escapeSql(row.Country.trim())}', '${escapeSql(row.LOCAL_SHOP_CD.trim())}')`
    )
    .join(',\n        ');

  return `
    country_map as (
      select column1 as country_code, column2 as local_shop_code
      from values
        ${values}
    )
  `;
}

function buildCategoryMapSql(rows: CategoryMapRow[]): string {
  const values = rows
    .map((row) => {
      const ctgrGrp = row.CTGR_GRP?.trim() || '기타';
      return `('${escapeSql(row.BRD_CD.trim())}', '${escapeSql(
        row.CTGR.trim()
      )}', '${escapeSql(row.SUB_CTGR.trim())}', '${escapeSql(ctgrGrp)}')`;
    })
    .join(',\n        ');

  return `
    ctgy_map as (
      select
        column1 as brd_cd,
        column2 as ctgr,
        column3 as sub_ctgr,
        column4 as ctgr_grp
      from values
        ${values}
    ),
    ctgy_map_by_sub as (
      select
        brd_cd,
        sub_ctgr,
        min(ctgr) as ctgr,
        min(ctgr_grp) as ctgr_grp
      from ctgy_map
      group by 1, 2
    )
  `;
}

function getSeasonBucketSql(alias: string, categoryGroupExpr: string): string {
  return `
    case
      when ${categoryGroupExpr} = '의류' and ${alias}.sesn = '25F' then '당년F'
      when ${categoryGroupExpr} = '의류' and ${alias}.sesn = '25S' then '당년S'
      when ${categoryGroupExpr} = '의류' and left(${alias}.sesn, 2) = '24' then '1년차'
      when ${categoryGroupExpr} = '의류' and left(${alias}.sesn, 2) = '23' then '2년차'
      when ${categoryGroupExpr} = '의류' and try_to_number(left(${alias}.sesn, 2)) >= 26 then '차기시즌'
      when ${categoryGroupExpr} = '의류' then '과시즌'
      when ${categoryGroupExpr} in ('신발', '모자', '가방', '기타') then ${categoryGroupExpr}
      else '기타'
    end
  `;
}

function buildInventorySql(
  brandGroup: InventoryBrandGroup,
  countryMapSql: string,
  categoryMapSql: string
): string {
  const brandFilter =
    brandGroup === 'ALL'
      ? "brd_cd in ('M', 'I', 'X')"
      : brandGroup === 'MLB'
        ? "brd_cd in ('M', 'I')"
        : "brd_cd = 'X'";

  return `
    with
    ${countryMapSql},
    ${categoryMapSql},
    category_order as (
      select column1 as category_label, column2 as sort_order, column3 as is_subtotal
      from values
        ('의류합계', 1, true),
        ('당년F', 2, false),
        ('당년S', 3, false),
        ('1년차', 4, false),
        ('2년차', 5, false),
        ('차기시즌', 6, false),
        ('과시즌', 7, false),
        ('ACC합계', 8, true),
        ('신발', 9, false),
        ('모자', 10, false),
        ('가방', 11, false),
        ('기타', 12, false)
    ),
    region_order as (
      select column1 as region_group, column2 as region_sort
      from values
        ('TOTAL', 1),
        ('HKMC', 2),
        ('TW', 3)
    ),
    begin_stock as (
      select
        case
          when s.cntry_cd in ('HK', 'MO') then 'HKMC'
          when s.cntry_cd = 'TW' then 'TW'
        end as region_group,
        ${getSeasonBucketSql('s', "coalesce(cm.ctgr_grp, '기타')")} as category_label,
        sum(
          case
            when s.currency = 'TWD' or s.cntry_cd = 'TW' then s.tag_stock_amt / ${FX_DIVISOR}
            else s.tag_stock_amt
          end
        ) as begin_amt
      from FNF.SAP_FNF.PREP_HMD_STOCK s
      left join ctgy_map cm
        on s.brd_cd = cm.brd_cd
       and s.ctgr = cm.ctgr
       and s.sub_ctgr = cm.sub_ctgr
      where s.yyyymm = '${BEGIN_YYYYMM}'
        and ${brandFilter.replace(/brd_cd/g, 's.brd_cd')}
      group by 1, 2
    ),
    end_stock as (
      select
        case
          when country_map.country_code in ('HK', 'MC') then 'HKMC'
          when country_map.country_code = 'TW' then 'TW'
          -- Safety net only. The primary source of truth is country_code.csv,
          -- which now includes the warehouse/shop backfill codes.
          when s.currency = 'HKD' then 'HKMC'
          when s.currency = 'TWD' then 'TW'
        end as region_group,
        ${getSeasonBucketSql('s', "coalesce(cm.ctgr_grp, '기타')")} as category_label,
        sum(
          case
            when s.currency = 'TWD' or country_map.country_code = 'TW' then s.tag_stock_amt / ${FX_DIVISOR}
            else s.tag_stock_amt
          end
        ) as ending_amt
      from FNF.SAP_FNF.DW_HMD_STOCK_SNAP_D s
      left join country_map
        on s.local_shop_cd = country_map.local_shop_code
      left join ctgy_map_by_sub cm
        on s.brd_cd = cm.brd_cd
       and substr(s.prdt_cd, 7, 2) = cm.sub_ctgr
      where s.stock_dt = '${END_STOCK_DT}'
        and ${brandFilter.replace(/brd_cd/g, 's.brd_cd')}
      group by 1, 2
    ),
    sales_2025 as (
      select
        case
          when s.cntry_cd in ('HK', 'MO') then 'HKMC'
          when s.cntry_cd = 'TW' then 'TW'
        end as region_group,
        ${getSeasonBucketSql('s', "coalesce(cm.ctgr_grp, '기타')")} as category_label,
        sum(
          case
            when s.currency = 'TWD' or s.cntry_cd = 'TW' then s.tag_sale_amt / ${FX_DIVISOR}
            else s.tag_sale_amt
          end
        ) as sales_amt
      from FNF.SAP_FNF.DW_HMD_SALE_D s
      left join ctgy_map_by_sub cm
        on s.brd_cd = cm.brd_cd
       and substr(s.prdt_cd, 7, 2) = cm.sub_ctgr
      where s.sale_dt between '${SALES_DATE_FROM}' and '${SALES_DATE_TO}'
        and ${brandFilter.replace(/brd_cd/g, 's.brd_cd')}
      group by 1, 2
    ),
    detail_rows as (
      select
        coalesce(b.region_group, e.region_group, sales.region_group) as region_group,
        coalesce(b.category_label, e.category_label, sales.category_label) as category_label,
        coalesce(b.begin_amt, 0) as begin_amt,
        coalesce(sales.sales_amt, 0) as sales_amt,
        coalesce(e.ending_amt, 0) as ending_amt,
        coalesce(sales.sales_amt, 0) + coalesce(e.ending_amt, 0) - coalesce(b.begin_amt, 0) as inbound_amt,
        coalesce(e.ending_amt, 0) - coalesce(b.begin_amt, 0) as change_amt
      from begin_stock b
      full outer join end_stock e
        on b.region_group = e.region_group
       and b.category_label = e.category_label
      full outer join sales_2025 sales
        on coalesce(b.region_group, e.region_group) = sales.region_group
       and coalesce(b.category_label, e.category_label) = sales.category_label
    ),
    non_total_rows as (
      select * from detail_rows where region_group in ('HKMC', 'TW')
    ),
    total_rows as (
      select
        'TOTAL' as region_group,
        category_label,
        sum(begin_amt) as begin_amt,
        sum(sales_amt) as sales_amt,
        sum(ending_amt) as ending_amt,
        sum(inbound_amt) as inbound_amt,
        sum(change_amt) as change_amt
      from non_total_rows
      group by 1, 2
    ),
    region_detail as (
      select * from non_total_rows
      union all
      select * from total_rows
    ),
    subtotal_rows as (
      select
        region_group,
        '의류합계' as category_label,
        sum(begin_amt) as begin_amt,
        sum(sales_amt) as sales_amt,
        sum(ending_amt) as ending_amt,
        sum(inbound_amt) as inbound_amt,
        sum(change_amt) as change_amt
      from region_detail
      where category_label in ('당년F', '당년S', '1년차', '2년차', '차기시즌', '과시즌')
      group by 1

      union all

      select
        region_group,
        'ACC합계' as category_label,
        sum(begin_amt) as begin_amt,
        sum(sales_amt) as sales_amt,
        sum(ending_amt) as ending_amt,
        sum(inbound_amt) as inbound_amt,
        sum(change_amt) as change_amt
      from region_detail
      where category_label in ('신발', '모자', '가방', '기타')
      group by 1
    ),
    final_rows as (
      select * from region_detail
      union all
      select * from subtotal_rows
    )
    select
      r.region_group,
      c.category_label,
      round(coalesce(f.begin_amt, 0) / 1000, 0) as begin_amt_k_hkd,
      round(coalesce(f.inbound_amt, 0) / 1000, 0) as inbound_amt_k_hkd,
      round(coalesce(f.sales_amt, 0) / 1000, 0) as sales_amt_k_hkd,
      round(coalesce(f.ending_amt, 0) / 1000, 0) as ending_amt_k_hkd,
      round(coalesce(f.change_amt, 0) / 1000, 0) as change_amt_k_hkd,
      c.is_subtotal,
      c.sort_order
    from region_order r
    cross join category_order c
    left join final_rows f
      on r.region_group = f.region_group
     and c.category_label = f.category_label
    order by r.region_sort, c.sort_order
  `;
}

export async function getInventoryMatrix(brandGroup: InventoryBrandGroup): Promise<InventoryMatrixResponse> {
  const [countryRows, categoryRows] = await Promise.all([loadCountryMap(), loadCategoryMap()]);
  const sql = buildInventorySql(
    brandGroup,
    buildCountryMapSql(countryRows),
    buildCategoryMapSql(categoryRows)
  );

  const rows = await executeSnowflakeQuery<InventoryQueryRow>(sql);
  const sectionsMap = new Map<InventoryRegionGroup, InventoryMatrixRow[]>();

  rows.forEach((row) => {
    const regionGroup = row.REGION_GROUP;
    const nextRow: InventoryMatrixRow = {
      categoryLabel: row.CATEGORY_LABEL,
      beginAmtK: toNumber(row.BEGIN_AMT_K_HKD),
      inboundAmtK: toNumber(row.INBOUND_AMT_K_HKD),
      salesAmtK: toNumber(row.SALES_AMT_K_HKD),
      endingAmtK: toNumber(row.ENDING_AMT_K_HKD),
      changeAmtK: toNumber(row.CHANGE_AMT_K_HKD),
      isSubtotal: toBoolean(row.IS_SUBTOTAL),
      sortOrder: toNumber(row.SORT_ORDER),
    };

    const list = sectionsMap.get(regionGroup) ?? [];
    list.push(nextRow);
    sectionsMap.set(regionGroup, list);
  });

  return {
    brandGroup,
    sections: (['TOTAL', 'HKMC', 'TW'] as InventoryRegionGroup[]).map((regionGroup) => ({
      regionGroup,
      rows: (sectionsMap.get(regionGroup) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    })),
  };
}
