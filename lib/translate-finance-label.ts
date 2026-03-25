'use client';

type TranslateStyle = 'full' | 'short';

const DIRECT_FULL: Record<string, string> = {
  계정과목: 'Account',
  자산: 'Assets',
  부채: 'Liabilities',
  자본: 'Equity',
  유동자산: 'Current Assets',
  비유동자산: 'Non-current Assets',
  유동부채: 'Current Liabilities',
  비유동부채: 'Non-current Liabilities',
  매출채권: 'Accounts Receivable',
  재고자산: 'Inventory',
  매입채무: 'Accounts Payable',
  '매입채무(TP)': 'Accounts Payable (TP)',
  영업활동: 'Operating Activities',
  자산성지출: 'Capex',
  순현금흐름: 'Net Cash Flow',
  현금잔액: 'Cash Balance',
  기말잔액: 'Ending Balance',
  운전자본합계: 'Working Capital Total',
  '운전자본 합계': 'Working Capital Total',
  전월대비: 'MoM',
  전년대비: 'YoY',
  실판매출: 'Sell-out',
  TAG매출: 'TAG',
  매출원가: 'COGS',
  매출총이익: 'GP',
  매출총이익률: 'GM',
  'Tag대비 원가율': 'COGS / TAG',
};

const DIRECT_SHORT: Record<string, string> = {
  ...DIRECT_FULL,
  홍콩: 'HK',
  대만: 'TW',
  영업비: 'Office Exp.',
  '오프라인 직접비': 'Off. Direct Exp.',
  '온라인 직접비': 'On. Direct Exp.',
  '직접비+영업비': 'Direct Exp. + OpEx',
  판관비: 'SG&A',
  영업이익: 'OP',
  영업이익률: 'OPM',
  당기순이익: 'NI',
  순이익률: 'NPM',
};

const TOKEN_FULL: Array<[string, string]> = [
  ['홍콩마카오', 'Hong Kong & Macau'],
  ['비유동성', 'Non-current'],
  ['유동성', 'Current'],
  ['비유동', 'Non-current'],
  ['유동', 'Current'],
  ['리스부채', 'Lease Liab.'],
  ['충당부채', 'Provision Liab.'],
  ['백화점', 'Dept. Store'],
  ['매입채무', 'Accounts Payable'],
  ['매출채권', 'Accounts Receivable'],
  ['재고자산', 'Inventory'],
  ['미지급금', 'Accrued Payables'],
  ['차입금', 'Borrowings'],
  ['보증금지급', 'Deposit Paid'],
  ['광고비', 'Mktg'],
  ['인건비', 'Payroll'],
  ['수입관세', 'Import Duty'],
  ['운영비', 'OpEx'],
  ['임차료', 'Rent'],
  ['감가상각비', 'D&A'],
  ['보험료', 'Insurance'],
  ['지급수수료', 'Commissions'],
  ['기타수익', 'Other Income'],
  ['기타입금', 'Other Receipts'],
  ['기타', 'Other'],
  ['입금', 'Receipts'],
  ['수익', 'Income'],
  ['본사', 'HQ'],
  ['물품대', 'Goods'],
  ['백화점', 'Dept. Store'],
  ['매장', 'Store'],
  ['사무실', 'Office'],
  ['운영비', 'OpEx'],
  ['급여', 'Payroll'],
  ['광고비', 'Mktg'],
  ['임차료', 'Rent'],
  ['차입금', 'Borrowings'],
  ['자본금', 'Capital Stock'],
  ['기타자본', 'Other Equity'],
  ['이익잉여금', 'Retained Earnings'],
  ['홍콩', 'Hong Kong'],
  ['마카오', 'Macau'],
  ['대만', 'Taiwan'],
  ['합계', 'Total'],
];

const TOKEN_SHORT: Array<[string, string]> = [
  ...TOKEN_FULL,
  ['홍콩', 'HK'],
  ['대만', 'TW'],
];

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const compact = (value: string) => normalize(value).replace(/\s+/g, '');

function replaceTokens(value: string, tokens: Array<[string, string]>) {
  return tokens
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((result, [source, target]) => result.replaceAll(source, target), value);
}

export function translateFinanceLabel(label: string, style: TranslateStyle = 'full'): string {
  const normalized = normalize(label);
  const compactLabel = compact(label);
  const directMap = style === 'short' ? DIRECT_SHORT : DIRECT_FULL;
  const tokenMap = style === 'short' ? TOKEN_SHORT : TOKEN_FULL;

  if (directMap[normalized]) return directMap[normalized];

  const directCompactEntry = Object.entries(directMap).find(([key]) => compact(key) === compactLabel);
  if (directCompactEntry) return directCompactEntry[1];

  if (compactLabel.endsWith('합계')) {
    const base = compactLabel.slice(0, -2);
    const translatedBase = translateFinanceLabel(base, style);
    if (translatedBase !== base) return `${translatedBase} Total`;
  }

  const translated = replaceTokens(normalized, tokenMap)
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/([A-Za-z])\(/g, '$1 (')
    .trim();

  return translated;
}
