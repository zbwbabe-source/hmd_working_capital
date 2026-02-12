# P/L Data Layer

P/L(손익계산서) 데이터를 CSV에서 로드하고 트리 구조로 변환하며, 화면 표시용 컬럼 계산 및 비율 재계산을 수행하는 데이터 레이어입니다.

## 📁 폴더 구조

```
PL/
├── data/               # CSV 파일 저장 위치
│   ├── 2025 Total.csv
│   ├── 2025 MLB.csv
│   ├── 2025 Discovery.csv
│   ├── 2026 Total.csv
│   ├── 2026 MLB.csv
│   └── 2026 Discovery.csv
└── src/
    └── pl/
        ├── types.ts        # 타입 정의
        ├── csvLoader.ts    # CSV 로더 구현
        ├── tree.ts         # 트리 구조 변환 로직
        ├── calc.ts         # 화면용 컬럼 계산 유틸
        ├── rateRecalc.ts   # 비율 재계산 로직
        └── devTest.ts      # 개발 테스트 스크립트
```

## 📊 CSV 형식

- **컬럼**: 대분류, 중분류, 소분류, 26년1월, 26년2월, ..., 26년12월
- **값 형식**:
  - 금액: `18,689` (천단위 콤마 포함 가능)
  - 비율: `33.00%` (퍼센트 기호 포함)
  - 빈 값: 0으로 처리

## 🔧 데이터 타입

### Row
```typescript
type Row = {
  year: 2025 | 2026;
  brand: "Total" | "MLB" | "Discovery";
  lvl1: string;        // 대분류
  lvl2: string;        // 중분류
  lvl3: string | null; // 소분류(없으면 null)
  months: {            // m1~m12
    m1: number, m2: number, ..., m12: number
  };
  isRateRow: boolean;  // % 포함 행이면 true
}
```

### Node (트리 구조)
```typescript
type Node = {
  key: string;         // 고유 키 (예: "L1|TAG매출")
  label: string;       // 표시 이름
  level: 1 | 2 | 3;    // 계층 레벨
  children?: Node[];   // 자식 노드
  rows?: Row[];        // leaf 노드의 원본 데이터
  rollup: {            // 월별 합산 (금액만, % 제외)
    m1: number, m2: number, ..., m12: number
  };
  hasRateRow: boolean; // % 행 포함 여부
}
```

### CalcOut (화면용 컬럼)
```typescript
type CalcOut = {
  prevMonth: number | null;       // 전년동월
  currMonth: number | null;       // 당년동월
  prevYTD: number | null;         // 전년 YTD
  currYTD: number | null;         // 당년 YTD
  prevYearTotal: number | null;   // 전년 연간
  currYearTotal: number | null;   // 당년 연간
}

type RateCalcOut = {
  prevMonth: number;              // 전년동월 (%)
  currMonth: number;              // 당년동월 (%)
  prevYTD: number;                // 전년 YTD (%)
  currYTD: number;                // 당년 YTD (%)
  prevYearTotal: number;          // 전년 연간 (%)
  currYearTotal: number;          // 당년 연간 (%)
}
```

## 📖 API

### getRows(year, brand)
지정된 연도와 브랜드의 CSV 파일을 읽어서 Row[] 배열로 반환합니다.

```typescript
import { getRows } from './src/pl/csvLoader';

const rows = await getRows(2026, 'Total');
console.log(`${rows.length}개 행 로드됨`);
```

### buildTree(rows)
Row[] 배열을 계층 구조 트리로 변환합니다.

**트리 규칙**:
- lvl1(대분류) → lvl2(중분류)는 항상 생성
- lvl3(소분류)는 lvl1이 **"TAG매출"** 또는 **"실판매출"**인 경우에만 생성
- 그 외 lvl1은 lvl2가 leaf (소분류 무시)

**Leaf 판정**:
- TAG매출/실판매출: leaf = lvl3(소분류) 노드
- 그 외: leaf = lvl2(중분류) 노드

**Rollup 계산**:
- leaf: `isRateRow=false`인 행만 합산
- 상위 노드: children의 rollup 합산
- % 행은 rollup에 포함하지 않음

```typescript
import { buildTree } from './src/pl/tree';

const tree = buildTree(rows);
console.log(`Root 노드 ${tree.length}개`);
```

### applyRateRecalc(prevTree, currTree)
"Tag대비 원가율" 비율 행을 분자/분모 기반으로 재계산합니다.

**재계산 규칙**:
- **Tag대비 원가율(%)** = (매출원가 / TAG매출) × 100
- lvl2(중분류) 기준으로 매칭
- 각 월별로 독립 계산 (분모가 0이면 0)
- 트리는 불변으로 유지 (깊은 복사 후 수정)

```typescript
import { applyRateRecalc } from './src/pl/rateRecalc';

const { prevTree: recalcPrev, currTree: recalcCurr } = applyRateRecalc(
  prevTree,
  currTree
);
```

### calcCols(monthIndex, prev, curr, isRateRow)
화면 표시용 컬럼 값을 계산합니다.

**파라미터**:
- `monthIndex`: 기준 월 (1~12)
- `prev`: 전년도 월별 데이터
- `curr`: 당년도 월별 데이터
- `isRateRow`: 비율 행 여부

**규칙**:
- **금액 행** (`isRateRow=false`): 모든 컬럼 계산
  - `prevMonth`: 전년도 해당 월
  - `currMonth`: 당년도 해당 월
  - `prevYTD`: 전년도 1월~해당 월 합계
  - `currYTD`: 당년도 1월~해당 월 합계
  - `prevYearTotal`: 전년도 연간 합계
  - `currYearTotal`: 당년도 연간 합계

- **비율 행** (`isRateRow=true`): 당월만 계산
  - `prevMonth`, `currMonth`만 세팅
  - 나머지는 `null` (UI에서 '-'로 표시 예정)

```typescript
import { calcCols, Months } from './src/pl/calc';

const result = calcCols(
  3,              // 3월 기준
  prevYearData,   // 전년도 월별 데이터
  currYearData,   // 당년도 월별 데이터
  false           // 금액 행
);

console.log(`당년 YTD: ${result.currYTD}`);
```

### calcRateColsFromNumerDenom(monthIndex, prevNumer, prevDenom, currNumer, currDenom)
비율 행의 컬럼을 분자/분모 기반으로 계산합니다 (YTD/연간 포함).

**계산 규칙**:
- **당월**: `(분자[월] / 분모[월]) × 100`
- **YTD**: `(sum(분자, 1~월) / sum(분모, 1~월)) × 100`
- **연간**: `(sum(분자, 1~12) / sum(분모, 1~12)) × 100`
- 분모가 0이면 0 반환

```typescript
import { calcRateColsFromNumerDenom, Months } from './src/pl/calc';

const rateResult = calcRateColsFromNumerDenom(
  3,              // 3월 기준
  prevCOGS,       // 전년도 매출원가
  prevSales,      // 전년도 매출
  currCOGS,       // 당년도 매출원가
  currSales       // 당년도 매출
);

console.log(`당년 원가율 YTD: ${rateResult.currYTD.toFixed(2)}%`);
```

### 유틸 함수

**sumMonths(months, toMonthIndex?)**
```typescript
// 1~12월 전체 합산
const total = sumMonths(months);

// 1~3월 합산 (YTD)
const ytd = sumMonths(months, 3);
```

**getMonthValue(months, monthIndex)**
```typescript
// 3월 값 가져오기
const march = getMonthValue(months, 3);
```

## 🧪 테스트

테스트 스크립트를 실행하여 전체 파이프라인이 정상 동작하는지 확인할 수 있습니다:

```bash
cd "D:\Cursor_work_space\Working Capital Dashboard\cashflow\PL"
ts-node src/pl/devTest.ts
```

**출력 정보**:
- 2025/2026 데이터 로드 상태
- Root 노드 개수 및 목록
- **비율 재계산 결과** (Tag대비 원가율)
- 재계산된 원가율 월별 값 (0~100% 범위 체크)
- **calcRateColsFromNumerDenom** 테스트 (YTD/연간 포함)
- 기존 calcCols 테스트

## ⚠️ 주의사항

- 현재는 **데이터 레이어, 트리 변환, 컬럼 계산, 비율 재계산**까지 구현되어 있습니다.
- UI는 아직 구현되지 않았습니다.
- CSV 파일은 간단한 형식을 가정합니다 (따옴표로 감싼 셀 내부의 쉼표는 지원하지 않음).
- 비율 재계산은 "Tag대비 원가율"만 지원합니다 (다른 비율은 CSV 값 사용).
