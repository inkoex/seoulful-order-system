# 주문 시스템 High-우선순위 하드닝 설계

- 날짜: 2026-07-05
- 대상: seoulful-order-system (React Router 7 + Supabase, 인도 배포, 통화 ₹)
- Supabase 프로젝트: `szzhsmodfbnrtcpxgwan` (region ap-south-1)

## 배경

코드 리뷰에서 발견된 High 항목을 4개 워크스트림으로 묶어 수정한다. 리뷰 원문의
번호(#1, #4, #5, #6, #7, #8, #3)를 유지한다. 타임존(#2)은 인도 단일 배포이므로
사업 로직 위험에서 제외하고, 포맷 일관성 정도만 이후 medium에서 다룬다.

## 확정된 사실 (운영 DB 실측)

- `orders`: `subtotal`(numeric, null 허용, default 0), `delivery_fee`(numeric, null 허용,
  default 0), `apartment_id`(uuid null 허용) 존재. **`notice_id` 컬럼은 없음.** status 기본값 `'pending'`.
- `order_items`: order_id, product_id, quantity, unit_price, subtotal.
- 공지 상한: `notice_limits(type in ('total','product'), product_id, max_quantity)`,
  대상 상품은 `notice_products` 또는 `is_all_products=true`면 활성 상품 전체.
- 현재 사용량 계산: `notice.start_at ~ now` 사이 생성되고 status!=cancelled 인 주문의
  order_items 수량 합계(생성시각 윈도우 휴리스틱). notice_id FK가 없으므로 이 방식을 유지한다.
- 배송비 규칙: subtotal > 0 AND subtotal < 500 이면 ₹30, 아니면 0 (`app/utils/order.ts`).

## 핵심 설계 원칙

**"사용량"은 카운터가 아니라 파생값이다.** 남은 수량 = 상한 − (해당 공지 윈도우의 살아있는
order_items 합계). 이 검사를 앱 캐시가 아니라 **DB RPC 트랜잭션 안에서 원자적으로** 수행하면
가격·재고·마감이 한 곳에서 강제되고, 수량 축소가 자동으로 타인에게 풀린다.

## 워크스트림 A — 용량·가격을 DB RPC로 일원화 (#5, #6, #8)

### create_order_with_items 개편
- 시그니처에 `p_notice_id UUID`(nullable) 추가.
- 트랜잭션 내부:
  1. `p_notice_id`가 있으면 `SELECT ... FROM notices WHERE id = p_notice_id FOR UPDATE`로
     해당 공지 행을 잠가 동시 주문을 직렬화.
  2. 상품 가격은 products에서 조회(현행 유지). subtotal 계산.
  3. **배송비 적용**: subtotal>0 AND subtotal<500 → 30, else 0. `subtotal`/`delivery_fee`/
     `total_amount(=subtotal+fee)`를 모두 기록.
  4. 공지가 있으면 상한 검사: 대상 상품(notice_products 또는 활성 전체)에 대해
     윈도우 사용량 SUM 계산 → `used + incoming > total_max` 또는 상품별 초과 시 `RAISE EXCEPTION`.
  5. order + items INSERT.
- 반환에 subtotal/delivery_fee 포함.

### update_order_with_token 개편
- 클라이언트가 보낸 `p_subtotal`/`p_delivery_fee`/`p_total_amount`/item별 `unit_price`/`subtotal`을
  **전부 무시**하고 서버에서 재계산(products 기준). 시그니처에서 금액 파라미터 제거,
  `p_notice_id UUID`(nullable) 추가.
- 상한 검사: `used_by_others = 윈도우 사용량 SUM (해당 order_id 제외)`, `used_by_others + new_qty <= max`.
  → 축소는 자동 반영, 증가는 검사.
- 상품 검증: 주문에 넣는 product는 `is_active=true`이거나 기존 주문에 이미 있던 상품만 허용.
- is_locked 유지. order + items UPDATE와 order_history INSERT를 같은 트랜잭션에 둔다.

### 앱 레이어 정리
- `order._index.tsx` 액션: 캐시 기반 사전 검사는 UX 힌트로만 남기고(즉시 "품절" 안내),
  최종 강제는 RPC 예외를 받아 사용자 친화적 메시지로 변환. `p_notice_id`에 현재 활성 공지 id 전달.
- `order.edit.$id.tsx` 액션: 현재 활성 공지 스냅샷을 조회해 `p_notice_id` 전달. 클라이언트 금액 미전송.
- 캐시(30초 스냅샷)는 표시 전용으로 유지.

## 워크스트림 B — 주문 접근 모델 (#1)

- 조회/수정 자격증명 = **주문번호 + 전화번호** 둘 다 일치.
- `search_orders_by_phone`(전화번호만, edit_token 반환) → `get_order_by_number_and_phone(p_order_number, p_phone)`
  로 교체. edit_token은 반환하지 않는다.
- **edit_token을 브라우저로 절대 내보내지 않는다.** 토큰은 서버(서비스 롤) 내부에서만 사용.
- 위험 RPC의 anon 실행 권한 회수: `update_order_with_token`, `get_order_for_edit`,
  (구)`search_orders_by_phone`/(신)`get_order_by_number_and_phone`은 서버 로더/액션에서
  서비스 롤로만 호출. 브라우저 anon 키 직접 호출 경로 제거.
- 완료 페이지(`order.complete.tsx`): 방금 주문 내역은 읽기 전용 표시(토큰 미노출).
  수정 진입은 번호+전화번호 확인 경로로.

## 워크스트림 C — 관리자 견고성 (#7 및 관리자측 #8)

- 주문 상태: 5개 유효값 화이트리스트(`received`/`ready`/`delivered`/`paid`/`cancelled`) +
  잘못된 값 거부. 취소↔복원 시 `cancelled_at`/`cancelled_reason` 일관 처리. 인덱스/상세 동작 통일.
  상태 변경 시 order_history 일관 기록.
- Supabase `.error` 미확인으로 거짓 성공 보고하던 액션(주문 상세 3개 인텐트, 공지 mutation) 전부
  에러 체크 후 실패 시 사용자에게 반영.
- 공지 수정의 비트랜잭션 delete-reinsert → 단일 RPC 트랜잭션으로 교체(활성 공지 한도 유실 방지).

## 워크스트림 D — 시크릿/인프라 (#4, #3)

- `auth.server.ts`: `SESSION_SECRET` 미설정 시 폴백 금지 → throw. 서명 비교 `crypto.timingSafeEqual`.
  세션 쿠키 `Secure` 플래그 추가(프로덕션).
- `.dockerignore`: `.env`, `.git` 추가, `README.md.` 오타 수정.
- `Dockerfile` 최종 스테이지: `USER node`, `NODE_ENV=production`.

## 적용 방식 / 안전장치

- **운영 DB는 실주문 데이터가 있는 프로덕션이다.** 모든 DDL/RPC 변경은 마이그레이션 파일로
  작성하고, 사용자 승인 후에만 적용한다(자동 적용 금지). RPC는 `CREATE OR REPLACE`라 무중단 교체 가능하나,
  시그니처 변경(파라미터 추가/삭제)은 앱 배포와 순서를 맞춘다.
- 배포 순서: (1) 새 RPC 배포(구 시그니처 DROP 포함) → (2) 앱 코드 배포. RPC와 앱을 원자적으로 함께 릴리스.

## 실행 순서

1. **D** — 자체 완결, DB 무관, 즉시 검증 가능. 먼저.
2. **A** — DB RPC(SQL) 작성 → 승인 → 앱 액션 연동.
3. **B** — 조회/접근 RPC 교체 + 권한 회수 + 라우트 연동.
4. **C** — 관리자 라우트 에러 처리 + 상태 검증 + 공지 트랜잭션.
5. 이후 medium/low는 건별로 논의.
