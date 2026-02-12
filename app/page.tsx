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
  const [bsView, setBsView] = useState<'BS' | 'PL' | 'CF'>('BS'); // 초기값을 BS로 변경
  const [wcYear, setWcYear] = useState<number>(2026);
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
    if (bsView === 'PL') {
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
    if (bsView === 'PL') {
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
    if (bsView === 'PL') {
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
    if (bsView === 'PL') {
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
      if (bsView === 'CF') {
      if (!cfData) loadData('CF', wcYear);
        if (!wcStatementData) {
          loadData('WORKING_CAPITAL_STATEMENT', wcYear).then(() => {
            if (bsView !== 'PL') loadWCRemarks();
          });
        } else if (wcRemarks.size === 0 && bsView !== 'PL') {
          loadWCRemarks();
        }
      } else if (bsView === 'BS') {
        if (!bsFinancialData) loadBSData(wcYear);
        if (!wcStatementData) {
          loadData('WORKING_CAPITAL_STATEMENT', wcYear).then(() => {
            if (bsView !== 'PL') loadWCRemarks();
          });
        } else if (wcRemarks.size === 0 && bsView !== 'PL') {
          loadWCRemarks();
        }
      } else if (bsView === 'PL') {
        // PL 뷰: WC 데이터 로드하지 않음
      }
    }
  }, [activeTab, bsView]);

  useEffect(() => {
    if (activeTab === 0) {
      if (bsView === 'CF') {
      loadData('CF', wcYear);
        loadData('WORKING_CAPITAL_STATEMENT', wcYear).then(() => {
          if (bsView !== 'PL') loadWCRemarks();
        });
      } else if (bsView === 'BS') {
        loadBSData(wcYear);
        loadData('WORKING_CAPITAL_STATEMENT', wcYear).then(() => {
          if (bsView !== 'PL') loadWCRemarks();
        });
      } else if (bsView === 'PL') {
        // PL 뷰: WC 데이터 로드하지 않음
      }
    }
  }, [wcYear]);

  // PL 뷰로 전환 시 remarks skip 로그 플래그 리셋
  useEffect(() => {
    if (bsView === 'PL') {
      setPlRemarksSkipLogged(false);
    }
  }, [bsView]);

  // 월 컬럼 (1월~12월)
  const monthColumns = ['계정과목', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  // 분석 결과 계산 (useMemo로 캐싱): 현금흐름표=cfData(CF 폴더), 운전자본표=wcStatementData(운전자본 폴더)
  const analysisResults = useMemo(() => {
    if (!cfData && !wcStatementData) {
      return null;
    }

    const cfAnalysis = analyzeCashFlowData(cfData, wcYear);
    const wcAnalysis = analyzeWorkingCapitalData(wcStatementData, wcYear);
    const insights = generateCashFlowInsights(cfData, wcStatementData, wcYear);
    const cfoQA = generateCFOQA(cfData, wcStatementData, wcYear);

    return { cfAnalysis, wcAnalysis, insights, cfoQA };
  }, [cfData, wcStatementData, wcYear]);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 상단 탭 */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* 내용 - 상단 탭 높이만큼 패딩 추가 */}
      <div className="p-0 pt-16">
        {/* 홍콩법인 F/S - 현금흐름표 */}
        {activeTab === 0 && (
          <div>
            <div className="bg-gray-100 border-b border-gray-300">
              <div className="flex items-center gap-4 px-6 py-3">
                <div className="inline-flex gap-2">
                  <button 
                    onClick={() => setBsView('BS')}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                      bsView === 'BS' 
                        ? 'bg-navy text-white' 
                        : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    B/S
                  </button>
                  <button 
                    onClick={() => setBsView('PL')}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                      bsView === 'PL' 
                        ? 'bg-navy text-white' 
                        : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    P/L
                  </button>
                  <button 
                    onClick={() => setBsView('CF')}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                      bsView === 'CF' 
                        ? 'bg-navy text-white' 
                        : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    C/F
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (bsView === 'BS') {
                      setBsMonthsCollapsed(!bsMonthsCollapsed);
                    } else {
                      setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors shadow-sm"
                >
                  {(bsView === 'BS' ? bsMonthsCollapsed : workingCapitalMonthsCollapsed) ? '월별 데이터 펼치기 ▶' : '월별 데이터 접기 ◀'}
                </button>
                <span className="ml-auto text-sm font-medium text-gray-600">단위: 천 HKD</span>
              </div>
            </div>
            {loading && <div className="p-6 text-center">로딩 중...</div>}
            {error && <div className="p-6 text-center text-red-500">{error}</div>}
            
            {/* B/S 화면 */}
            {bsView === 'BS' && (bsFinancialData || wcStatementData) && !loading && (
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
                {wcStatementData && (
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
                      data={wcStatementData} 
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
                      remarks={wcRemarks}
                      onRemarkChange={saveWCRemark}
                    />
                  </div>
                )}
              </div>
            )}
            
            {/* P/L 화면 */}
            {bsView === 'PL' && !loading && (
              <PLPage />
            )}
            
            {/* C/F 화면 */}
            {(cfData || wcStatementData) && !loading && bsView === 'CF' && (
              <div className="px-6 pt-6 pb-6">
                {workingCapitalMonthsCollapsed ? (
                  <div className="flex gap-6 items-start">
                    <div className="flex-1 flex-shrink-0" style={{ minWidth: 0 }}>
                      {cfData && (
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
                            data={cfData} 
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
                      {wcStatementData && (
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
                            data={wcStatementData} 
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
                            remarks={wcRemarks}
                            onRemarkChange={saveWCRemark}
                          />
                        </div>
                      )}
                    </div>
                    <aside className="flex-1 rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm overflow-y-auto max-h-[calc(100vh-200px)]" style={{ minWidth: '500px' }}>
                      <EditableAnalysis
                        year={wcYear}
                        disabled={bsView === 'PL'}
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
                    {cfData && (
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
                          data={cfData} 
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
                    {wcStatementData && (
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
                          data={wcStatementData} 
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
                          remarks={wcRemarks}
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

