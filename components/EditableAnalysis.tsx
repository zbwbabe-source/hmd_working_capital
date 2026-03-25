'use client';

import { useState, useEffect } from 'react';
import { translateFinanceLabel } from '@/lib/translate-finance-label';

interface EditableAnalysisProps {
  year: number;
  locale?: 'ko' | 'en';
  initialContent: {
    keyInsights: string[];
    cfAnalysis: any;
    wcAnalysis: any;
    riskFactors: string[];
    actionItems: string[];
  } | null;
  onSave?: () => void;
  disabled?: boolean; // PL 뷰에서 비활성화용
}

export default function EditableAnalysis({ year, locale = 'ko', initialContent, onSave, disabled = false }: EditableAnalysisProps) {
  const isEnglish = locale === 'en';
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [savedCustomContent, setSavedCustomContent] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const uiText = {
    title: isEnglish ? 'Notes & Analysis' : '설명과 분석',
    cancel: isEnglish ? 'Cancel' : '취소',
    save: isEnglish ? 'Save' : '저장',
    saving: isEnglish ? 'Saving...' : '저장 중...',
    placeholder: isEnglish ? 'Enter analysis content...' : '분석 내용을 입력하세요...',
    markdownHint: isEnglish
      ? 'Markdown is supported. (## title, **bold**, • list, etc.)'
      : 'Markdown 형식을 사용할 수 있습니다. (## 제목, **굵게**, • 목록 등)',
    reset: isEnglish ? 'Reset' : '초기화',
    edit: isEnglish ? 'Edit' : '편집',
    empty: isEnglish ? 'Loading data or there is no analysis content to display.' : '데이터를 불러오는 중이거나 표시할 분석 내용이 없습니다.',
    keyInsights: isEnglish ? 'Key Insights' : '핵심 인사이트',
    cashFlow: isEnglish ? `${year} Cash Flow Statement` : `${year}년 현금흐름표`,
    workingCapital: isEnglish ? `${year} Working Capital Statement` : `${year}년 운전자본표`,
    annual: isEnglish ? 'Annual' : '연간',
    yoy: isEnglish ? 'vs previous year' : '전년 대비',
    riskFactors: isEnglish ? 'Risk Factors' : '리스크 요인',
    actionItems: isEnglish ? 'Action Items' : '관리 포인트',
    ar: isEnglish ? 'Accounts Receivable' : '매출채권',
    inventory: isEnglish ? 'Inventory' : '재고자산',
    ap: isEnglish ? 'Accounts Payable' : '매입채무',
  };

  const translateNarrative = (text: string): string => {
    if (!isEnglish) return text;

    const translated = text
      .replace(/영업활동/g, 'Operating Activities')
      .replace(/매출채권/g, 'Accounts Receivable')
      .replace(/재고자산/g, 'Inventory')
      .replace(/매입채무/g, 'Accounts Payable')
      .replace(/운전자본/g, 'Working Capital')
      .replace(/현금 유입에 기여/g, 'contributed to cash inflow')
      .replace(/현금 유출 요인으로 작용/g, 'acted as a cash outflow factor')
      .replace(/현금 유출 요인/g, 'cash outflow factor')
      .replace(/현금 유입 기여/g, 'contributed to cash inflow')
      .replace(/감소하여/g, 'decreased by')
      .replace(/증가하여/g, 'increased by')
      .replace(/전년 대비/g, 'vs previous year')
      .replace(/연중/g, 'throughout the year')
      .replace(/구조적 변화로 판단/g, 'considered a structural improvement')
      .replace(/구조적 개선/g, 'structural improvement')
      .replace(/점진적으로/g, 'gradually')
      .replace(/균등하게/g, 'evenly')
      .replace(/개선되어/g, 'improved and is')
      .replace(/개선/g, 'improvement')
      .replace(/악화/g, 'deterioration')
      .replace(/기여\./g, 'contribution.')
      .replace(/요인\./g, 'factor.')
      .replace(/본사 물품대 채무 추가 상환으로 연체분 감소 반영\./g, 'Reflects lower overdue balances due to additional repayment of HQ goods-payable debt.')
      .replace(/지급조건 개선으로 현금흐름 관리에 긍정적\./g, 'Improved payment terms are positive for cash flow management.')
      .replace(/월별 변동성이 높아 단기 타이밍 효과로 판단\./g, 'High monthly volatility suggests a short-term timing effect.')
      .replace(/하반기에 집중 축소되어 관리 조정 효과로 판단\./g, 'The reduction was concentrated in the second half, suggesting a management adjustment effect.')
      .replace(/연중 균등 감소하여 보수적 재고 운영 정책으로 판단\./g, 'The decline was evenly distributed through the year, suggesting a conservative inventory policy.')
      .replace(/현금창출로 매입채무 상환 및 리뉴얼 투자 계획 가능\./g, 'Cash generation supports accounts payable repayment and renewal investment plans.')
      .replace(/데이터가 충분하지 않습니다\./g, 'Insufficient data.')
      .replace(/리스크 요인/g, 'Risk Factors')
      .replace(/관리 포인트/g, 'Action Items')
      .replace(/핵심 인사이트/g, 'Key Insights')
      .replace(/현금흐름/g, 'cash flow')
      .replace(/긍정적 신호로/g, 'a positive signal,')
      .replace(/주요 개선 요인/g, 'the main improvement driver')
      .replace(/변화:/g, 'change:')
      .replace(/연쇄 효과:/g, 'Chain effect:')
      .replace(/본사 채무 상환/g, 'HQ debt repayment')
      .replace(/재무 건전성 향상/g, 'improved financial health')
      .replace(/재무 건전성 개선/g, 'improved financial health')
      .replace(/동시에 달성되어/g, 'were achieved together,')
      .replace(/월별 운전자본 변동성 모니터링 강화:/g, 'Strengthen monthly Working Capital volatility monitoring:')
      .replace(/특정 월 집중 효과 vs 구조적 개선 구분\./g, 'distinguish one-off monthly concentration effects from structural improvement.')
      .replace(/재고 수준 적정성 검토:/g, 'Review inventory level adequacy:')
      .replace(/현금 improvement과 매출 대응력 균형 유지\./g, 'maintain a balance between cash improvement and sales responsiveness.')
      .replace(/([A-Za-z ]+)이 ([+△-]?\d{1,3}(?:,\d{3})*\s*K HKD) increased by acted as a cash outflow factor\./g, '$1 increased by $2, acting as a cash outflow factor.')
      .replace(/([A-Za-z ]+)이 △?([0-9,]+\s*K HKD) decreased by contributed to cash inflow\./g, '$1 decreased by $2, contributing to cash inflow.')
      .replace(/([A-Za-z ]+)이 ([+△-]?\d{1,3}(?:,\d{3})*\s*K HKD) decreased by contributed to cash inflow\./g, '$1 decreased by $2, contributing to cash inflow.');

    return translated
      .replace(/\([^()]*[가-힣][^()]*\)/g, '')
      .replace(/[가-힣][가-힣0-9A-Za-z\s,.()%+\-→/]*/g, '')
      .replace(/\s+→\s+→/g, ' → ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.:;])/g, '$1')
      .replace(/([,.:;])([A-Za-z])/g, '$1 $2')
      .replace(/\/\s*\//g, '/')
      .replace(/\s+\/\s+/g, ' / ')
      .replace(/\s+\./g, '.')
      .trim();
  };

  // 초기 로드 시 저장된 내용 불러오기
  useEffect(() => {
    const loadSavedContent = async () => {
      // disabled면 비활성화
      if (disabled) {
        console.log('analysis load skipped (PL)');
        return;
      }
      
      try {
        const response = await fetch(`/api/analysis?year=${year}`);
        const result = await response.json();
        if (result.success && result.data) {
          setSavedCustomContent(result.data);
        }
      } catch (error) {
        console.error('Failed to load saved content:', error);
      }
    };
    
    loadSavedContent();
  }, [year, disabled]);

  // 편집 모드 시작
  const handleEdit = () => {
    if (savedCustomContent) {
      setEditedContent(savedCustomContent);
    } else if (initialContent) {
      // 기본 분석 내용을 텍스트로 변환
      const defaultText = generateDefaultText(initialContent);
      setEditedContent(defaultText);
    }
    setIsEditing(true);
  };

  // 저장
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year,
          content: editedContent,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSavedCustomContent(editedContent);
        setIsEditing(false);
        onSave?.();
      } else {
        alert('저장에 실패했습니다: ' + result.error);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 초기화 (Redis에서 삭제)
  const handleReset = async () => {
    if (!confirm('저장된 커스텀 내용을 삭제하고 기본 분석으로 돌아갑니다. 계속하시겠습니까?')) {
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/analysis?year=${year}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        setSavedCustomContent(null);
        alert('초기화되었습니다. 페이지를 새로고침합니다.');
        window.location.reload();
      } else {
        alert('초기화에 실패했습니다: ' + result.error);
      }
    } catch (error) {
      console.error('Reset error:', error);
      alert('초기화 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 취소
  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent('');
  };

  // 기본 분석 내용을 텍스트로 변환
  const generateDefaultText = (content: any): string => {
    let text = '';
    
    if (content.keyInsights && content.keyInsights.length > 0) {
      text += `## ${uiText.keyInsights}\n\n`;
      content.keyInsights.forEach((insight: string) => {
        text += `• ${translateNarrative(insight)}\n\n`;
      });
    }

    if (content.cfAnalysis?.categories?.length > 0) {
      text += `## ${uiText.cashFlow}\n\n`;
      content.cfAnalysis.categories.forEach((cat: any) => {
        const annual = `${uiText.annual}: ${Math.round(cat.annualTotal).toLocaleString('ko-KR')} K HKD`;
        const yoy = cat.yoyAbsolute !== null ? `, ${uiText.yoy}: ${Math.round(cat.yoyAbsolute).toLocaleString('ko-KR')} K HKD` : '';
        text += `**${translateFinanceLabel(cat.account, 'full')}:** ${annual}${yoy}\n\n`;
      });
    }

    if (content.wcAnalysis?.categories?.length > 0) {
      text += `## ${uiText.workingCapital}\n\n`;
      content.wcAnalysis.categories.forEach((cat: any) => {
        const annual = `${uiText.annual}: ${Math.round(cat.annualTotal).toLocaleString('ko-KR')} K HKD`;
        const yoy = cat.yoyAbsolute !== null ? `, ${uiText.yoy}: ${Math.round(cat.yoyAbsolute).toLocaleString('ko-KR')} K HKD` : '';
        text += `**${translateFinanceLabel(cat.account, 'full')}:** ${annual}${yoy}\n\n`;
      });
      
      if (content.wcAnalysis.arInsight) {
        text += `**${uiText.ar}:** ${translateNarrative(content.wcAnalysis.arInsight)}\n\n`;
      }
      if (content.wcAnalysis.inventoryInsight) {
        text += `**${uiText.inventory}:** ${translateNarrative(content.wcAnalysis.inventoryInsight)}\n\n`;
      }
      if (content.wcAnalysis.apInsight) {
        text += `**${uiText.ap}:** ${translateNarrative(content.wcAnalysis.apInsight)}\n\n`;
      }
    }

    if (content.riskFactors && content.riskFactors.length > 0) {
      text += `## ${uiText.riskFactors}\n\n`;
      content.riskFactors.forEach((risk: string) => {
        text += `• ${translateNarrative(risk)}\n\n`;
      });
    }

    if (content.actionItems && content.actionItems.length > 0) {
      text += `## ${uiText.actionItems}\n\n`;
      content.actionItems.forEach((action: string) => {
        text += `• ${translateNarrative(action)}\n\n`;
      });
    }

    return text;
  };

  // 렌더링할 내용 결정
  const displayContent = isEnglish
    ? (initialContent ? generateDefaultText(initialContent) : translateNarrative(savedCustomContent || ''))
    : (savedCustomContent || (initialContent ? generateDefaultText(initialContent) : ''));

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 pb-3 border-b-2 border-gray-300">{uiText.title}</h3>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium rounded bg-gray-300 text-gray-700 hover:bg-gray-400 transition-colors"
            >
              {uiText.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-blue-300"
            >
              {isSaving ? uiText.saving : uiText.save}
            </button>
          </div>
        </div>
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="w-full h-[calc(100vh-300px)] p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          placeholder={uiText.placeholder}
        />
        <p className="text-xs text-gray-500">
          {uiText.markdownHint}
        </p>
      </div>
    );
  }

  // 섹션별로 컨텐츠 파싱
  const parseContentIntoSections = (content: string) => {
    const sections: { title: string; lines: string[] }[] = [];
    let currentSection: { title: string; lines: string[] } | null = null;
    
    content.split('\n').forEach(line => {
      if (line.startsWith('## ')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.replace('## ', ''),
          lines: []
        };
      } else if (currentSection && line.trim()) {
        currentSection.lines.push(line);
      }
    });
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  };

  // 텍스트에서 중요한 부분을 강조 표시 (모두 검은색)
  const highlightImportantText = (text: string) => {
    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    
    // 강조할 패턴들 - 모두 검은색 폰트
    const patterns = [
      // 금액 (숫자 + K/M HKD, 천 HKD 등)
      { regex: /([+△]?\d{1,3}(?:,\d{3})*(?:\.\d+)?[KM]?\s*HKD)/g, color: 'text-gray-900 font-semibold' },
      // 백분율
      { regex: /([+△]?\d+(?:\.\d+)?%)/g, color: 'text-gray-900 font-semibold' },
      // Target, 개선, 증가, 감소, 플러스 전환 등 중요 단어
      { regex: /(Target|개선|증가|감소|플러스 전환|구조적|현금창출|상환|투자|재고일수|연체분|본사|채무|건전성|매출|성장|실판매출)/g, color: 'text-gray-900 font-medium' },
    ];

    let processedText = text;
    const highlights: { start: number; end: number; className: string; text: string }[] = [];

    // 모든 패턴 찾기
    patterns.forEach(({ regex, color }) => {
      const matches = Array.from(text.matchAll(regex));
      matches.forEach(match => {
        if (match.index !== undefined) {
          highlights.push({
            start: match.index,
            end: match.index + match[0].length,
            className: color,
            text: match[0]
          });
        }
      });
    });

    // 위치 순으로 정렬하고 겹치는 부분 제거
    highlights.sort((a, b) => a.start - b.start);
    const filtered = highlights.filter((h, i) => {
      if (i === 0) return true;
      return h.start >= highlights[i - 1].end;
    });

    // JSX 엘리먼트 생성
    filtered.forEach((h, i) => {
      // 이전 강조 끝부터 현재 강조 시작까지의 일반 텍스트
      if (h.start > lastIndex) {
        parts.push(<span key={`text-${i}`}>{text.substring(lastIndex, h.start)}</span>);
      }
      // 강조 텍스트
      parts.push(
        <span key={`highlight-${i}`} className={h.className}>
          {h.text}
        </span>
      );
      lastIndex = h.end;
    });

    // 마지막 남은 텍스트
    if (lastIndex < text.length) {
      parts.push(<span key="text-last">{text.substring(lastIndex)}</span>);
    }

    return parts.length > 0 ? <>{parts}</> : text;
  };

  const sections = parseContentIntoSections(displayContent);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-3 border-b-2 border-gray-300">
        <h3 className="text-xl font-bold text-gray-900">{uiText.title}</h3>
        <div className="flex gap-2">
          {savedCustomContent && (
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors"
            >
              {uiText.reset}
            </button>
          )}
          <button
            onClick={handleEdit}
            className="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {uiText.edit}
          </button>
        </div>
      </div>
      
      {sections.length > 0 ? (
        <div className="space-y-6" style={{ width: '100%' }}>
          {sections.map((section, sectionIdx) => (
            <div 
              key={sectionIdx} 
              className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm"
              style={{ width: '100%', minWidth: 0, overflowWrap: 'anywhere' }}
            >
              <h4 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500 flex items-center">
                <span className="w-1 h-5 bg-blue-600 mr-2.5 rounded"></span>
                {section.title}
              </h4>
              <div className="space-y-2">
                {section.lines.map((line, lineIdx) => {
                  if (line.startsWith('**') && line.includes('**')) {
                    const cleanText = line.replace(/\*\*/g, '');
                    return (
                      <div key={lineIdx} className="font-semibold text-gray-900 mb-1 mt-3 text-sm" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {highlightImportantText(cleanText)}
                      </div>
                    );
                  } else if (line.startsWith('• ') || line.startsWith('✓ ')) {
                    const symbol = line.startsWith('✓ ') ? '✓' : '•';
                    const text = line.substring(2);
                    return (
                      <div key={lineIdx} className="flex items-start mb-3" style={{ width: '100%' }}>
                        <span className="text-blue-600 mr-2 mt-0.5 flex-shrink-0">{symbol}</span>
                        <div className="text-sm text-gray-700 leading-relaxed flex-1" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: 0 }}>
                          {highlightImportantText(text)}
                        </div>
                      </div>
                    );
                  } else if (line.startsWith('→ ')) {
                    return (
                      <div key={lineIdx} className="text-sm text-gray-600 pl-6 mb-2" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {highlightImportantText(line)}
                      </div>
                    );
                  } else if (line.trim()) {
                    return (
                      <div key={lineIdx} className="text-sm text-gray-700 mb-2 leading-relaxed" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {highlightImportantText(line)}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          {uiText.empty}
        </p>
      )}
    </div>
  );
}
