# Inventory Shop Mapping

## 목적
- 재고 매트릭스에서 `HKMC`와 `TW` 지역 집계를 만들 때 사용하는 매장코드 매핑 기준을 기록한다.
- 특히 `DW_HMD_STOCK_SNAP_D`의 `LOCAL_SHOP_CD`가 `country_code.csv`에 없어서 기말재고가 누락되는 문제를 방지하기 위한 기준 문서다.

## 1. 기초 재고 기준
- 소스: `FNF.SAP_FNF.PREP_HMD_STOCK`
- 기준 컬럼: `CNTRY_CD`
- 매핑:
  - `HK`, `MO` -> `HKMC`
  - `TW` -> `TW`

## 2. 기말 재고 기준
- 소스: `FNF.SAP_FNF.DW_HMD_STOCK_SNAP_D`
- 기준 컬럼: `LOCAL_SHOP_CD`
- 1차 매핑: `country_code.csv`
- 2차 fallback:
  - `CURRENCY = 'HKD'` -> `HKMC`
  - `CURRENCY = 'TWD'` -> `TW`

## 3. country_code.csv 기준 매핑

### HK
`M99`, `M01`, `M02`, `M05`, `M03`, `M07`, `M08`, `M09`, `M10`, `M11`, `M13`, `M14`, `M15`, `HE1`, `HE2`, `M12`, `M16`, `M17`, `M18`, `M19`, `M20`, `M21`, `M22`, `X01`, `XE1`

### MC
`W01`, `MC1`, `MC2`, `MC3`, `MC4`

### TW
`T99`, `T01`, `T02`, `T03`, `T04`, `TU1`, `T05`, `T06`, `TU2`, `T07`, `T08`, `T09`, `T10`, `T11`, `T12`, `T13`, `TE1`, `TE2`, `TE3`, `T15`, `TE4`, `T16`, `T14`, `TU3`, `T17`, `T18`, `T19`, `D01`, `D02`, `D03`, `D04`, `D05`, `D06`, `DE1`, `DE2`

## 4. 추가 fallback으로 반영되는 주요 코드

### HKMC로 편입되는 코드
- 규칙: `country_code.csv`에 없고 `CURRENCY = 'HKD'`
- 대표 코드:
  - `WHM`
  - `OSH`
  - `DMG`
  - `WH3`
  - `WH2`
  - `WMM`
  - `WCM`
  - `WM1`
  - `WKM`
  - `DMM`
  - `M14DGM`
  - `MC3DGM`
  - `MC1DGM`
  - `M05DGM`
  - `M18DGM`
  - `M10DGM`
  - `M11DGM`
  - `M22DGM`
  - `MC2DGM`
  - `M02DGM`
  - `M19DGM`
  - `M5L`
  - `M8L`
  - `M7L`
  - `M9L`
  - `M6L`
  - `M4L`
  - `M3L`
  - `M2L`
  - `M1L`
  - `M00`
  - `M04`
  - `M06`
  - `10L`
  - `12L`
  - `15L`
  - `16L`
  - `18L`
  - `C1L`
  - `C2L`
  - `QRW`
  - `XH1`
  - `XH2`
  - `XH3`
  - `XHM`
  - `XHOSH`
  - `XHDMG`
  - `XHWKM`
  - `X99`

### TW로 편입되는 코드
- 규칙: `country_code.csv`에 없고 `CURRENCY = 'TWD'`
- 대표 코드:
  - `WTM`
  - `WTE`
  - `WMS`
  - `WES`
  - `WED`
  - `DMT`
  - `DTE`
  - `DTM`
  - `OST`
  - `TES`
  - `TMS`
  - `TB1`
  - `TB2`
  - `TB3`
  - `TB4`
  - `TB5`
  - `T10DGM`
  - `TU3DGM`
  - `T02DGM`

## 5. 실제 큰 금액 코드 예시
- `WHM` -> `HKMC` (`HKD`) 약 `238.2M HKD`
- `WTM` -> `TW` (`TWD`) 약 `64.2M HKD`
- `WTE` -> `TW` (`TWD`) 약 `41.0M HKD`
- `OSH` -> `HKMC` (`HKD`) 약 `8.3M HKD`

## 6. 구현 규칙 요약
- `PREP_HMD_STOCK`는 `CNTRY_CD`를 직접 사용한다.
- `DW_HMD_STOCK_SNAP_D`는 아래 순서로 지역을 결정한다.
  1. `country_code.csv`에 `LOCAL_SHOP_CD`가 있으면 그 국가 사용
  2. 없으면 `HKD -> HKMC`, `TWD -> TW`
- 이 규칙은 2025년 기말재고 누락 방지를 위해 적용했다.
