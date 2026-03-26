'use client';

type TranslateStyle = 'full' | 'short';
type TranslateLocale = 'ko' | 'en';

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
  '현금 및 현금성 자산': 'Cash and Cash Equivalents',
  사용권자산: 'Right-of-use Assets',
  유형자산: 'Property, Plant and Equipment',
  무형자산: 'Intangible Assets',
  미지급금: 'Accrued Payables',
  자본금: 'Capital Stock',
  기타자본: 'Other Equity',
  이익잉여금: 'Retained Earnings',
  OtherCurrent자산: 'Other Current Assets',
  'OtherNon-current자산': 'Other Non-current Assets',
  '기타유동 Assets': 'Other Current Assets',
  '기타비유동 Assets': 'Other Non-current Assets',
  OtherCurrent부채: 'Other Current Liabilities',
  'OtherNon-current부채': 'Other Non-current Liabilities',
  '기타유동 Liabilities': 'Other Current Liabilities',
  '기타비유동 Liabilities': 'Other Non-current Liabilities',
  'Non-current보증금': 'Non-current Deposit Paid',
  'Current Lease Liab.': 'Current Lease Liab.',
  'Non-current Lease Liab.': 'Non-current Lease Liab.',
  유동리스부채: 'Current Lease Liab.',
  비유동리스부채: 'Non-current Lease Liab.',
  차입금: 'Borrowings',
  '복구Provision Liab.': 'Restoration Provision Liab.',
  'Restoration 충당부채': 'Restoration Provision Liab.',
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
  ['현금 및 현금성 자산', 'Cash and Cash Equivalents'],
  ['사용권자산', 'Right-of-use Assets'],
  ['유형자산', 'Property, Plant and Equipment'],
  ['무형자산', 'Intangible Assets'],
  ['기타유동자산', 'Other Current Assets'],
  ['기타비유동자산', 'Other Non-current Assets'],
  ['기타유동부채', 'Other Current Liabilities'],
  ['기타비유동부채', 'Other Non-current Liabilities'],
  ['유동리스부채', 'Current Lease Liab.'],
  ['비유동리스부채', 'Non-current Lease Liab.'],
  ['비유동보증금', 'Non-current Deposit Paid'],
  ['복구충당부채', 'Restoration Provision Liab.'],
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
  ['보증금', 'Deposit Paid'],
];

const TOKEN_SHORT: Array<[string, string]> = [
  ...TOKEN_FULL,
  ['홍콩', 'HK'],
  ['대만', 'TW'],
];

const DIRECT_FULL_KO: Record<string, string> = Object.fromEntries(
  Object.entries(DIRECT_FULL).map(([source, target]) => [target, source])
);

const DIRECT_SHORT_KO: Record<string, string> = Object.fromEntries(
  Object.entries(DIRECT_SHORT).map(([source, target]) => [target, source])
);

const TOKEN_FULL_KO: Array<[string, string]> = TOKEN_FULL.map(([source, target]) => [target, source]);
const TOKEN_SHORT_KO: Array<[string, string]> = TOKEN_SHORT.map(([source, target]) => [target, source]);

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const compact = (value: string) => normalize(value).replace(/\s+/g, '');

function replaceTokens(value: string, tokens: Array<[string, string]>) {
  return tokens
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((result, [source, target]) => result.replaceAll(source, target), value);
}

export function translateFinanceLabel(label: string, style: TranslateStyle = 'full'): string {
  return translateFinanceLabelForLocale(label, style, 'en');
}

export function translateFinanceLabelForLocale(
  label: string,
  style: TranslateStyle = 'full',
  locale: TranslateLocale = 'en'
): string {
  const normalized = normalize(label);
  const compactLabel = compact(label);
  const directMap =
    locale === 'en'
      ? style === 'short'
        ? DIRECT_SHORT
        : DIRECT_FULL
      : style === 'short'
        ? DIRECT_SHORT_KO
        : DIRECT_FULL_KO;
  const tokenMap =
    locale === 'en'
      ? style === 'short'
        ? TOKEN_SHORT
        : TOKEN_FULL
      : style === 'short'
        ? TOKEN_SHORT_KO
        : TOKEN_FULL_KO;

  if (directMap[normalized]) return directMap[normalized];

  const directCompactEntry = Object.entries(directMap).find(([key]) => compact(key) === compactLabel);
  if (directCompactEntry) return directCompactEntry[1];

  if (locale === 'en' && compactLabel.endsWith('합계')) {
    const base = compactLabel.slice(0, -2);
    const translatedBase = translateFinanceLabelForLocale(base, style, locale);
    if (translatedBase !== base) return `${translatedBase} Total`;
  }

  if (locale === 'ko' && compactLabel.endsWith('Total')) {
    const base = compactLabel.slice(0, -5);
    const translatedBase = translateFinanceLabelForLocale(base, style, locale);
    if (translatedBase !== base) return `${translatedBase}합계`;
  }

  let translated = replaceTokens(normalized, tokenMap)
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/([A-Za-z])\(/g, '$1 (')
    .trim();

  if (locale === 'ko') {
    translated = translated
      .replace(/\bOther\s+Current\b/g, 'OtherCurrent')
      .replace(/\bOther\s+Non-current\b/g, 'OtherNon-current')
      .replace(/\bOther\s+Noncurrent\b/g, 'OtherNon-current')
      .replace(/\bCurrent\s+Lease\s+Liab\./g, 'Current Lease Liab.')
      .replace(/\bNon-current\s+Lease\s+Liab\./g, 'Non-current Lease Liab.')
      .replace(/\bCurrent\s+(자산|부채|리스부채|보증금)/g, '유동$1')
      .replace(/\bNon-current\s+(자산|부채|리스부채|보증금)/g, '비유동$1')
      .replace(/\bOtherCurrent/g, '기타유동')
      .replace(/\bOtherNon-current/g, '기타비유동')
      .replace(/\bCurrent Lease Liab\./g, '유동리스부채')
      .replace(/\bNon-current Lease Liab\./g, '비유동리스부채')
      .replace(/\bAccrued Payables\b/g, '미지급금')
      .replace(/\bBorrowings\b/g, '차입금')
      .replace(/\bProvision Liab\./g, '충당부채')
      .replace(/\bCapital Stock\b/g, '자본금')
      .replace(/\bOther Equity\b/g, '기타자본')
      .replace(/\bRetained Earnings\b/g, '이익잉여금');
  }

  return translated;
}
