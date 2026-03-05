'use client';

import { useState, useEffect, useMemo } from 'react';
import Tabs from '@/components/Tabs';
import YearTabs from '@/components/YearTabs';
import FinancialTable from '@/components/FinancialTable';
import EditableAnalysis from '@/components/EditableAnalysis';
import PLPage from '@/components/PLPage';
import { TableRow, TabType } from '@/lib/types';
import {
  analyzeCashFlowData,
  analyzeWorkingCapitalData,
  generateCashFlowInsights,
  generateCFOQA,
} from '@/lib/analysis';
import { formatNumber, formatMillionYuan } from '@/lib/utils';

export default function Home() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [bsView, setBsView] = useState<'BS' | 'PL' | 'CF'>('CF');
  const [reportMode, setReportMode] = useState<'FUND_MONTHLY' | 'PERFORMANCE'>('FUND_MONTHLY');
  const [wcYear, setWcYear] = useState<number>(2026);
  const [salesYoYRate, setSalesYoYRate] = useState<number>(115);
  const [workingCapitalMonthsCollapsed, setWorkingCapitalMonthsCollapsed] = useState<boolean>(true);
  const [wcAllRowsCollapsed, setWcAllRowsCollapsed] = useState<boolean>(true);
  const [wcStatementAllRowsCollapsed, setWcStatementAllRowsCollapsed] = useState<boolean>(true);
  const [cfData, setCfData] = useState<TableRow[] | null>(null);
  const [wcStatementData, setWcStatementData] = useState<TableRow[] | null>(null);
  
  // B/S 상태
  const [bsFinancialData, setBsFinancialData] = useState<TableRow[] | null>(null);
  const [bsMonthsCollapsed, setBsMonthsCollapsed] = useState<boolean>(true);
  const [bsFinancialCollapsed, setBsFinancialCollapsed] = useState<boolean>(true);
  const [bsRemarks, setBsRemarks] = useState<Map<string, string>>(new Map());
  
  // 운전자본표 비고
  const [wcRemarks, setWcRemarks] = useState<Map<string, string>>(new Map());
  
  // PL remarks skip 로그용 (한 번만 출력)
  const [plRemarksSkipLogged, setPlRemarksSkipLogged] = useState<boolean>(false);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const effectiveView: 'BS' | 'PL' | 'CF' = reportMode === 'FUND_MONTHLY' ? 'CF' : bsView;

  const tabs = ['홍콩법인 F/S'];
  const tabTypes: TabType[] = ['CF'];

  // 데이터 로딩: 현금흐름표=CF 폴더, 운전자본표=운전자본 폴더
  const loadData = async (type: TabType, year?: number) => {
    setLoading(true);
    setError(null);

    try {
      let url = '';
      if (type === 'CF') {
        url = `/api/fs/cf?year=${year}`;
      } else if (type === 'WORKING_CAPITAL_STATEMENT') {
        url = `/api/fs/working-capital-statement?year=${year}`;
      }

      if (!url) return;

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        const message = result?.error || '데이터를 불러올 수 없습니다.';
        throw new Error(message);
      }

      if (type === 'CF') {
        setCfData(result.rows);
      } else if (type === 'WORKING_CAPITAL_STATEMENT') {
        setWcStatementData(result.rows);
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
      const response = await fetch(`/api/fs/bs?year=${year}`);
      const result = await response.json();

      if (!response.ok) {
        const message = result?.error || 'B/S 데이터를 불러올 수 없습니다.';
        throw new Error(message);
      }

      setBsFinancialData(result.financialPosition);
      
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

  // 월 컬럼 (1월~12월)
  const monthColumns = ['계정과목', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  const adjustedCfData = useMemo(() => {
    if (!cfData || wcYear !== 2026) return cfData;

    const delta = (salesYoYRate - 115) / 100;
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

        for (let monthIdx = 1; monthIdx <= 11; monthIdx++) {
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
        for (let monthIdx = 1; monthIdx <= 11; monthIdx++) {
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

      for (let monthIdx = 1; monthIdx <= 11; monthIdx++) {
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
      for (let monthIdx = 1; monthIdx <= 11; monthIdx++) {
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

    return clonedRows;
  }, [cfData, wcYear, salesYoYRate]);

  const cfDataForView = adjustedCfData ?? cfData;

  const adjustedWcStatementData = useMemo(() => {
    if (!wcStatementData || wcYear !== 2026) return wcStatementData;

    const delta = (salesYoYRate - 115) / 100;
    if (delta === 0) return wcStatementData;

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
    const ACC_MOM = '전월대비';

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

        for (let monthIdx = 1; monthIdx <= 11; monthIdx++) {
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

          for (let monthIdx = 1; monthIdx <= 11; monthIdx++) {
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
      for (let monthIdx = 1; monthIdx <= 11; monthIdx++) {
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
      for (let monthIdx = 1; monthIdx <= 11; monthIdx++) {
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

      for (let monthIdx = 1; monthIdx <= 11; monthIdx++) {
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

    return clonedRows;
  }, [wcStatementData, cfData, cfDataForView, wcYear, salesYoYRate]);

  const wcStatementDataForView = adjustedWcStatementData ?? wcStatementData;

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

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 상단 탭 */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        rightContent={
          <div className="inline-flex gap-2">
            <button
              onClick={() => setReportMode('FUND_MONTHLY')}
              className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                reportMode === 'FUND_MONTHLY'
                  ? 'bg-white text-navy'
                  : 'bg-blue-800 text-white hover:bg-blue-700'
              }`}
            >
              자금월보
            </button>
            <button
              onClick={() => setReportMode('PERFORMANCE')}
              className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                reportMode === 'PERFORMANCE'
                  ? 'bg-white text-navy'
                  : 'bg-blue-800 text-white hover:bg-blue-700'
              }`}
            >
              실적보고
            </button>
          </div>
        }
      />

      {/* 내용 - 상단 탭 높이만큼 패딩 추가 */}
      <div className="p-0 pt-16">
        {/* 홍콩법인 F/S - 현금흐름표 */}
        {activeTab === 0 && (
          <div>
            <div className="bg-gray-100 border-b border-gray-300">
              <div className="flex items-center gap-4 px-6 py-3">
                <div className="inline-flex gap-2">
                  {reportMode === 'PERFORMANCE' ? (
                    <>
                      <button
                        onClick={() => setBsView('BS')}
                        className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                          effectiveView === 'BS'
                            ? 'bg-navy text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
                        }`}
                      >
                        B/S
                      </button>
                      <button
                        onClick={() => setBsView('PL')}
                        className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                          effectiveView === 'PL'
                            ? 'bg-navy text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
                        }`}
                      >
                        P/L
                      </button>
                      <button
                        onClick={() => setBsView('CF')}
                        className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                          effectiveView === 'CF'
                            ? 'bg-navy text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
                        }`}
                      >
                        C/F
                      </button>
                    </>
                  ) : (
                    <button className="px-4 py-2 text-sm font-medium rounded bg-navy text-white">
                      C/F
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (effectiveView === 'BS') {
                      setBsMonthsCollapsed(!bsMonthsCollapsed);
                    } else {
                      setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors shadow-sm"
                >
                  {(effectiveView === 'BS' ? bsMonthsCollapsed : workingCapitalMonthsCollapsed) ? '월별 데이터 펼치기 ▶' : '월별 데이터 접기 ◀'}
                </button>
                {effectiveView === 'CF' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white">
                    <label htmlFor="sales-yoy-slider" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      매출 YoY
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
                <span className="ml-auto text-sm font-medium text-gray-600">단위: 천 HKD</span>
              </div>
            </div>
            {loading && <div className="p-6 text-center">로딩 중...</div>}
            {error && <div className="p-6 text-center text-red-500">{error}</div>}
            
            {/* B/S 화면 */}
            {effectiveView === 'BS' && (bsFinancialData || wcStatementDataForView) && !loading && (
              <div className="px-6 pt-6 pb-6">
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
                        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                          <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <span className="text-blue-600">📊</span>
                            재무비율 분석 (2026년 기말 기준)
                          </h3>
                          <div className="grid grid-cols-3 gap-4">
                            {/* 부채비율 */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                              <div className="text-xs text-gray-600 mb-1">부채비율</div>
                              <div className="text-2xl font-bold text-purple-600 mb-1">
                                {부채비율26.toFixed(0)}%
                              </div>
                              <div className="text-xs text-gray-500 mb-1">
                                (2025년말 {부채비율25.toFixed(0)}%)
                              </div>
                              <div className="text-xs text-gray-600 mb-2">
                                2025년 대비 {(부채비율26 - 부채비율25).toFixed(0)}%p {부채비율26 < 부채비율25 ? '개선' : '증가'}
                              </div>
                              <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                                TP채무 제외시: {부채비율제외TP26.toFixed(0)}%
                              </div>
                            </div>
                            
                            {/* 유동비율 */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                              <div className="text-xs text-gray-600 mb-1">유동비율</div>
                              <div className="text-2xl font-bold text-orange-600 mb-1">
                                {유동비율26.toFixed(0)}%
                              </div>
                              <div className="text-xs text-gray-500">
                                (양호)
                              </div>
                              <div className="text-xs text-gray-600 mt-2">
                                단기 재무상황 양호 및 지속 충분
                              </div>
                            </div>
                            
                            {/* 자기자본비율 */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                              <div className="text-xs text-gray-600 mb-1">자기자본비율</div>
                              <div className="text-2xl font-bold text-green-600 mb-1">
                                {자기자본비율26.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500">
                                (연간 기준)
                              </div>
                              <div className="text-xs text-gray-600 mt-2">
                                연기순이익 {(총자본26 / 1000).toFixed(0)}M 안정적 수익성 유지
                              </div>
                            </div>
                          </div>
                          
                          {/* 핵심 요약 */}
                          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                            <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                              <span>💡</span> 핵심:
                            </div>
                            <ul className="text-xs text-gray-700 space-y-1">
                              <li>• 부채비율 {부채비율26.toFixed(0)}%: 2025년말 {부채비율25.toFixed(0)}% 대비 {Math.abs(부채비율26 - 부채비율25).toFixed(0)}%p {부채비율26 < 부채비율25 ? '개선' : '증가'}, 재무 안정성 {부채비율26 < 부채비율25 ? '크게 향상' : '관리 필요'}</li>
                              <li>• 유동비율 {유동비율26.toFixed(0)}%: 단기 재무상황 {유동비율26 > 100 ? '양호' : '개선 필요'}</li>
                              <li>• 자기자본비율 {자기자본비율26.toFixed(1)}%: 안정적 수익성 기반 유지</li>
                            </ul>
                          </div>
                        </div>
                      );
                    })()}
                    
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-bold text-gray-800">Financial Position</h2>
                      <span className="text-sm text-gray-500">(단위: 1k HKD)</span>
                      <button
                        onClick={() => setBsFinancialCollapsed(!bsFinancialCollapsed)}
                        className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                      >
                        {bsFinancialCollapsed ? '펼치기 ▼' : '접기 ▲'}
                      </button>
                    </div>
                    <FinancialTable 
                      data={bsFinancialData}
                      columns={
                        bsMonthsCollapsed 
                          ? ['계정과목', '24년말', '25년말', '26년1월', '26년기말(e)', 'YoY(증감)', '비고']
                          : ['계정과목', '24년말', '25년말', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', 'YoY(증감)', '비고']
                      }
                      showTotal={false}
                      isBalanceSheet={true}
                      monthsCollapsed={bsMonthsCollapsed}
                      onMonthsToggle={() => setBsMonthsCollapsed(!bsMonthsCollapsed)}
                      currentYear={wcYear}
                      allRowsCollapsed={bsFinancialCollapsed}
                      onAllRowsToggle={() => setBsFinancialCollapsed(!bsFinancialCollapsed)}
                      showRemarks={true}
                      remarks={bsRemarks}
                      onRemarkChange={saveBSRemark}
                    />
                  </>
                )}
                {wcStatementDataForView && (
                  <div className="mt-8 pt-6 border-t-2 border-gray-400">
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-bold text-gray-800">운전자본표</h2>
                      <span className="text-sm text-gray-500">(단위: 1k HKD)</span>
                      <button
                        onClick={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                        className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                      >
                        {wcStatementAllRowsCollapsed ? '펼치기 ▼' : '접기 ▲'}
                      </button>
                    </div>
                    <FinancialTable 
                      data={wcStatementDataForView} 
                      columns={[...monthColumns, `${wcYear}년(기말)`, 'YoY', '비고']} 
                      showTotal
                      isCashFlow={true}
                      isWorkingCapital={true}
                      monthsCollapsed={bsMonthsCollapsed}
                      onMonthsToggle={() => setBsMonthsCollapsed(!bsMonthsCollapsed)}
                      currentYear={wcYear}
                      allRowsCollapsed={wcStatementAllRowsCollapsed}
                      onAllRowsToggle={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                      showRemarks={true}
                      remarks={dynamicWcRemarks}
                      onRemarkChange={saveWCRemark}
                    />
                  </div>
                )}
              </div>
            )}
            
            {/* P/L 화면 */}
            {effectiveView === 'PL' && !loading && (
              <PLPage />
            )}
            
            {/* C/F 화면 */}
            {(cfDataForView || wcStatementDataForView) && !loading && effectiveView === 'CF' && (
              <div className="px-6 pt-6 pb-6">
                {workingCapitalMonthsCollapsed ? (
                  <div className="flex gap-6 items-start">
                    <div className="flex-1 flex-shrink-0" style={{ minWidth: 0 }}>
                      {cfDataForView && (
                        <>
                          <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-lg font-bold text-gray-800">현금흐름표</h2>
                            <span className="text-sm text-gray-500">(단위: 1k HKD)</span>
                            <button
                              onClick={() => setWcAllRowsCollapsed(!wcAllRowsCollapsed)}
                              className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                            >
                              {wcAllRowsCollapsed ? '펼치기 ▼' : '접기 ▲'}
                            </button>
                          </div>
                          <FinancialTable 
                            data={cfDataForView} 
                            columns={[...monthColumns, `${wcYear}년(합계)`, 'YoY']} 
                            showTotal
                            isCashFlow={true}
                            monthsCollapsed={workingCapitalMonthsCollapsed}
                            onMonthsToggle={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                            currentYear={wcYear}
                            allRowsCollapsed={wcAllRowsCollapsed}
                            onAllRowsToggle={() => setWcAllRowsCollapsed(!wcAllRowsCollapsed)}
                            defaultExpandedAccounts={['영업활동']}
                          />
                        </>
                      )}
                      {wcStatementDataForView && (
                        <div className="mt-8 pt-6 border-t-2 border-gray-400">
                          <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-lg font-bold text-gray-800">운전자본표</h2>
                            <span className="text-sm text-gray-500">(단위: 1k HKD)</span>
                            <button
                              onClick={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                              className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                            >
                              {wcStatementAllRowsCollapsed ? '펼치기 ▼' : '접기 ▲'}
                            </button>
                          </div>
                          <FinancialTable 
                            data={wcStatementDataForView} 
                            columns={[...monthColumns, `${wcYear}년(기말)`, 'YoY', '비고']} 
                            showTotal
                            isCashFlow={true}
                            isWorkingCapital={true}
                            monthsCollapsed={workingCapitalMonthsCollapsed}
                            onMonthsToggle={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                            currentYear={wcYear}
                            allRowsCollapsed={wcStatementAllRowsCollapsed}
                            onAllRowsToggle={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                            showRemarks={true}
                            remarks={dynamicWcRemarks}
                            onRemarkChange={saveWCRemark}
                          />
                        </div>
                      )}
                    </div>
                    <aside className="flex-1 rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm overflow-y-auto max-h-[calc(100vh-200px)]" style={{ minWidth: '500px' }}>
                      <EditableAnalysis
                        year={wcYear}
                        disabled={false}
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
                          <h2 className="text-lg font-bold text-gray-800">현금흐름표</h2>
                          <span className="text-sm text-gray-500">(단위: 1k HKD)</span>
                          <button
                            onClick={() => setWcAllRowsCollapsed(!wcAllRowsCollapsed)}
                            className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                          >
                            {wcAllRowsCollapsed ? '펼치기 ▼' : '접기 ▲'}
                          </button>
                        </div>
                        <FinancialTable 
                          data={cfDataForView} 
                          columns={[...monthColumns, `${wcYear}년(합계)`, 'YoY']} 
                          showTotal
                          isCashFlow={true}
                          monthsCollapsed={workingCapitalMonthsCollapsed}
                          onMonthsToggle={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                          currentYear={wcYear}
                          allRowsCollapsed={wcAllRowsCollapsed}
                          onAllRowsToggle={() => setWcAllRowsCollapsed(!wcAllRowsCollapsed)}
                          defaultExpandedAccounts={['영업활동']}
                        />
                      </>
                    )}
                    {wcStatementDataForView && (
                      <div className="mt-8 pt-6 border-t-2 border-gray-400">
                        <div className="flex items-center gap-2 mb-4">
                          <h2 className="text-lg font-bold text-gray-800">운전자본표</h2>
                          <span className="text-sm text-gray-500">(단위: 1k HKD)</span>
                          <button
                            onClick={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                            className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                          >
                            {wcStatementAllRowsCollapsed ? '펼치기 ▼' : '접기 ▲'}
                          </button>
                        </div>
                        <FinancialTable 
                          data={wcStatementDataForView} 
                          columns={[...monthColumns, `${wcYear}년(기말)`, 'YoY', '비고']} 
                          showTotal
                          isCashFlow={true}
                          isWorkingCapital={true}
                          monthsCollapsed={workingCapitalMonthsCollapsed}
                          onMonthsToggle={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                          currentYear={wcYear}
                          allRowsCollapsed={wcStatementAllRowsCollapsed}
                          onAllRowsToggle={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                          showRemarks={true}
                          remarks={dynamicWcRemarks}
                          onRemarkChange={saveWCRemark}
                        />
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
