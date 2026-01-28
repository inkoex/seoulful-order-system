# PRD – Seoulful 주문 입력 시스템 (MVP)

> 버전: 1.1  
> 최종 수정일: 2025년 1월 25일

---

## 1. 배경 (Background)

Seoulful은 현재 WhatsApp/단톡방 기반으로 주문을 받고 있으며, 주문 수량이 증가함에 따라 다음과 같은 문제가 발생하고 있다.

- 주문 채널이 여러 개(Karle, SNN, ELT 등)로 분산됨
- 주문 정보 누락 / 중복 가능성 증가
- 아파트별·상품별 수량 집계에 수작업이 필요
- 배달 준비 시 주소 정리 및 순서 정리에 시간 소모
- 향후 배달원 고용 시 인수인계가 어려움

현재 단계에서는 인력 고용 이전에 최소한의 시스템화가 필요하다.

---

## 2. 목표 (Goals)

1. 주문 정보를 단일 입력 창구로 수집
2. 주문 데이터를 자동으로 구조화하여 저장
3. 아파트별 / 상품별 수량 집계를 자동화
4. 배달 준비 시 정리된 리스트를 즉시 확인 가능
5. 주문 변경/취소를 고객이 직접 처리 가능 (마감 전)
6. 기술적·운영적 부담 없이 즉시 도입 가능

---

## 3. 비목표 (Non-Goals)

이번 MVP에서는 아래 사항을 포함하지 않는다.

- 온라인 결제 시스템 연동
- 재고 자동 차감
- 고객 로그인 / 계정 시스템
- 실시간 주문 상태 추적 (제조중/배달중 등)
- Shopify / POS 연동
- 자동 확인 메시지 발송 (WhatsApp / SMS)

---

## 4. 대상 사용자 (Target Users)

### 4.1 외부 사용자 (고객)
- 아파트 단지 거주 고객
- 모바일 환경에서 주문 입력

### 4.2 내부 사용자 (운영자)
- Seoulful 운영자 (본인, 배우자)
- 향후 배달 담당자

---

## 5. 기술 스택 (Tech Stack)

| 구분 | 기술 |
|-----|------|
| 프레임워크 | React Router 7 (Remix) |
| 데이터베이스 | Supabase (PostgreSQL) |
| 보조 저장소 | Google Sheets (미러링) |
| 스타일링 | Tailwind CSS |
| UI 컴포넌트 | shadcn/ui |
| 인증 | Supabase Auth (관리자 전용) |
| 호스팅 | Vercel 또는 Cloudflare Pages |

---

## 6. 시스템 구성 (Architecture)

```
┌─────────────────┐
│   고객 주문 폼   │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Remix Action   │
└────────┬────────┘
         ▼
┌─────────────────┐      성공 후       ┌────────────────┐
│    Supabase     │ ─────────────────▶ │  Google Sheets │
│    (Primary)    │    비동기 동기화    │    (Mirror)    │
└────────┬────────┘                    └────────────────┘
         ▼
┌─────────────────┐
│   관리자 화면    │ ◀── Google Sheets로 임시 대체 가능
└─────────────────┘
```

### 6.1 이중 저장 전략

**Supabase (Primary)**
- 주 데이터 저장소
- 모든 CRUD 작업의 기준
- API 및 인증 제공

**Google Sheets (Mirror)**
- 운영자가 익숙한 인터페이스로 데이터 확인
- 어드민 화면 개발 전까지 임시 관리 도구
- 백업 역할
- **읽기 전용으로 취급** (수정은 Supabase에서만)

### 6.2 동기화 처리

```typescript
// Remix Action 예시
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  
  // 1. Supabase 저장 (필수)
  const { data, error } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();
  
  if (error) throw error;
  
  // 2. Google Sheets 저장 (실패해도 주문은 완료)
  try {
    await appendToGoogleSheet(data);
  } catch (e) {
    console.error('Sheets 동기화 실패:', e);
    await logSyncFailure(data.id, e);
  }
  
  return redirect(`/order/complete?id=${data.id}`);
}
```

---

## 7. 데이터베이스 스키마

### 7.1 주문 테이블 (orders)

| 컬럼 | 타입 | 설명 |
|-----|------|------|
| id | UUID | PK, 자동 생성 |
| order_number | TEXT | 주문번호 (ORD-YYMMDD-XXX) |
| created_at | TIMESTAMP | 주문 생성 시간 |
| updated_at | TIMESTAMP | 최종 수정 시간 |
| apartment | TEXT | 아파트명 |
| tower | TEXT | 타워/동 |
| flat_number | TEXT | 호수 |
| customer_name | TEXT | 고객명 |
| phone | TEXT | 연락처 |
| delivery_date | DATE | 배달 희망일 |
| payment_method | TEXT | 결제 방식 |
| notes | TEXT | 특이사항 |
| entry_channel | TEXT | 주문 입력 경로 |
| edit_token | TEXT | 수정용 토큰 |
| is_locked | BOOLEAN | 마감 잠금 여부 |
| status | TEXT | 주문 상태 |
| cancelled_at | TIMESTAMP | 취소 시간 |
| cancelled_reason | TEXT | 취소 사유 |
| original_order_id | UUID | 수정 시 원본 주문 참조 |
| total_amount | DECIMAL | 총 주문 금액 |

### 7.2 주문 상품 테이블 (order_items)

| 컬럼 | 타입 | 설명 |
|-----|------|------|
| id | UUID | PK |
| order_id | UUID | FK → orders.id |
| product_id | UUID | FK → products.id |
| quantity | INTEGER | 수량 |
| unit_price | DECIMAL | 주문 시점 단가 |
| subtotal | DECIMAL | 소계 |

### 7.3 상품 마스터 테이블 (products)

| 컬럼 | 타입 | 설명 |
|-----|------|------|
| id | UUID | PK |
| name | TEXT | 상품명 |
| name_ko | TEXT | 한글 상품명 |
| category | TEXT | 카테고리 |
| price | DECIMAL | 단가 |
| is_active | BOOLEAN | 판매 여부 |
| sort_order | INTEGER | 표시 순서 |

### 7.4 주문 수정 이력 테이블 (order_history)

| 컬럼 | 타입 | 설명 |
|-----|------|------|
| id | UUID | PK |
| order_id | UUID | FK → orders.id |
| changed_fields | JSONB | 변경 내역 |
| changed_at | TIMESTAMP | 변경 시간 |
| changed_by | TEXT | 변경 주체 (customer/admin) |

### 7.5 동기화 실패 로그 테이블 (sync_failures)

| 컬럼 | 타입 | 설명 |
|-----|------|------|
| id | UUID | PK |
| order_id | UUID | FK → orders.id |
| error_message | TEXT | 에러 메시지 |
| created_at | TIMESTAMP | 발생 시간 |
| retried_at | TIMESTAMP | 재시도 시간 |
| resolved | BOOLEAN | 해결 여부 |

---

## 8. 기능 요구사항 (Functional Requirements)

### 8.1 주문 입력 폼

#### 필수 입력 항목

**1. 아파트 선택** (Dropdown)
- Karle
- SNN
- ELT
- RMZ
- Brigade
- 기타

**2. 타워/동** (Text)

**3. 호수** (Text)

**4. 고객 이름** (Text)

**5. 연락처** (Text, 10자리 검증)

**6. 상품 선택 및 수량**

| 상품 | 카테고리 | 단가 |
|-----|---------|------|
| 소금빵 | 빵 | ₹XX |
| 꽈배기 | 빵 | ₹XX |
| 식빵 (플레인) | 식빵 | ₹XX |
| 식빵 (초코) | 식빵 | ₹XX |
| 스콘 (플레인) | 스콘 | ₹XX |
| 스콘 (크랜베리) | 스콘 | ₹XX |

※ 각 항목은 0 이상 숫자 입력, 음수 방지

**7. 배달 날짜** (Date picker)
- 선택 가능 범위: 오늘 포함 3일 이내
- 마감 시간: 배달일 전날 오후 8시

**8. 결제 방식** (Radio)
- UPI
- 현금
- 기타

**9. 특이사항** (Optional, Textarea)
- 인터폰 호출
- 경비실 전달
- 부재 시 위치 등

**10. 주문 입력 경로** (Dropdown, 기본값: 고객 직접 입력)
- 고객 직접 입력
- 관리자 대리 입력 (WhatsApp)
- 관리자 대리 입력 (전화)
- 관리자 대리 입력 (기타)

#### 폼 유효성 검증
- 연락처: 10자리 숫자
- 수량: 0 이상 정수
- 최소 1개 이상 상품 선택 필수
- 배달 날짜: 마감 시간 이전만 선택 가능

### 8.2 주문 완료 화면

주문 완료 시 표시 정보:
- 주문번호
- 주문 내역 요약
- 예상 총액
- 배달일
- 수정/취소 링크
- 마감 시간 안내

```
📦 Seoulful 주문 완료

주문번호: ORD-240125-001
소금빵 3개, 꽈배기 2개
배달일: 1월 26일 (일)
총액: ₹450

✏️ 수정/취소하기: [링크]
⏰ 마감: 오늘 오후 8시까지

마감 후 변경은 WhatsApp으로 연락주세요.
```

### 8.3 주문 수정/취소

#### 수정 링크 방식
- 주문 완료 시 고유 토큰이 포함된 수정 링크 제공
- 링크: `https://seoulful.com/order/{orderId}/edit?token={editToken}`

#### 마감 전 (고객 직접 처리)
- 수정 링크로 접근하여 내용 변경 가능
- 취소 가능
- 변경 이력 자동 기록

#### 마감 후 (운영자 처리)
- 수정 링크 접근 시 "마감되었습니다" 메시지
- WhatsApp으로 연락 안내
- 운영자가 관리 화면에서 처리

#### 수정 이력 관리
```json
// order_history.changed_fields 예시
{
  "items": {
    "salt_bread": { "from": 2, "to": 3 }
  },
  "notes": {
    "from": "",
    "to": "경비실 전달 부탁드립니다"
  }
}
```

### 8.4 관리자 기능

#### MVP 단계: Google Sheets 활용
- 주문 목록 조회
- 상품별 수량 집계
- 아파트별 배달 리스트
- 주문 상태 확인

#### 향후 개발: 전용 관리자 화면
- 대시보드 (오늘 주문 요약)
- 주문 목록 및 상세
- 집계 뷰
- 마감 처리
- 주문 상태 변경

### 8.5 자동 집계

#### 상품별 총 수량
- 배달일 기준 필터
- 상품별 총 개수

#### 아파트별 주문 요약
- 아파트 → 총 주문 수량
- 아파트 → 고객 수

#### 배달 리스트
- 아파트 → 타워 → 호수 순 정렬
- 고객명 + 주문 요약 + 연락처 표시

---

## 9. 사용자 흐름 (User Flow)

### 9.1 고객 주문 흐름

```
1. 운영자가 주문 링크를 단톡방/WhatsApp에 공유
     ↓
2. 고객이 주문 폼에서 정보 입력
     ↓
3. 폼 제출 → Supabase 저장 → Sheets 동기화
     ↓
4. 주문 완료 화면 (주문번호, 수정 링크 표시)
     ↓
5. (선택) 마감 전 수정/취소
```

### 9.2 운영자 흐름

```
1. 마감 시점에 Google Sheets 또는 관리 화면에서 집계 확인
     ↓
2. 상품별 총 수량으로 생산량 결정
     ↓
3. 제조 및 포장
     ↓
4. 배달 리스트 확인 (아파트/타워/호수 순)
     ↓
5. 배달 수행
     ↓
6. (선택) 배달 완료 체크
```

### 9.3 주문 수정 흐름

```
[마감 전]
1. 고객이 수정 링크 클릭
     ↓
2. 기존 주문 정보 로드
     ↓
3. 수정 후 저장
     ↓
4. 변경 이력 기록

[마감 후]
1. 고객이 수정 링크 클릭
     ↓
2. "마감되었습니다" 안내
     ↓
3. WhatsApp으로 연락
     ↓
4. 운영자가 수동 처리
```

---

## 10. 운영 정책 (Operational Rules)

### 10.1 주문 마감
- 마감 시간: 배달일 전날 오후 8시
- 마감 시 해당 배달일 주문 자동 잠금 (`is_locked = true`)
- 마감 이후 추가 주문은 운영자 수동 처리

### 10.2 주문 수정
- 마감 전: 고객 직접 수정 가능
- 마감 후: 운영자만 수정 가능
- 모든 수정 이력 기록

### 10.3 주문 취소
- 마감 전: 고객 직접 취소 가능
- 마감 후: 운영자 확인 후 취소
- 취소된 주문은 soft delete (status = 'cancelled')

### 10.4 데이터 관리
- Google Sheets는 읽기 전용으로 취급
- 수정은 반드시 Supabase (또는 앱)에서만
- 일별 데이터 필터링
- 개인정보 보관 기간: 3개월 (이후 익명화)

### 10.5 중복 주문 처리
- 동일 연락처 + 동일 배달일 주문 시 경고 표시
- 운영자가 유효/무효 판단

---

## 11. 화면 목록

### 11.1 고객용 화면

| 화면 | 경로 | 설명 |
|-----|------|------|
| 주문 폼 | `/order` | 신규 주문 입력 |
| 주문 완료 | `/order/complete` | 주문 확인 및 수정 링크 |
| 주문 수정 | `/order/:id/edit` | 기존 주문 수정 |
| 주문 취소 확인 | `/order/:id/cancel` | 취소 확인 |

### 11.2 관리자용 화면 (향후)

| 화면 | 경로 | 설명 |
|-----|------|------|
| 로그인 | `/admin/login` | 관리자 인증 |
| 대시보드 | `/admin` | 오늘 주문 요약 |
| 주문 목록 | `/admin/orders` | 전체 주문 목록 |
| 주문 상세 | `/admin/orders/:id` | 주문 상세 및 수정 |
| 집계 | `/admin/summary` | 상품별/아파트별 집계 |
| 배달 리스트 | `/admin/delivery` | 배달 순서 리스트 |
| 상품 관리 | `/admin/products` | 상품 추가/수정/비활성화 |

---

## 12. 성공 지표 (Success Metrics)

| 지표 | 목표 |
|-----|------|
| 주문 누락/중복 발생률 | 0% |
| 주문 정리 시간 | 50% 이상 감소 |
| 배달 준비 혼선 | 현저히 감소 |
| 고객 직접 입력 비율 | 70% 이상 |
| 마감 전 수정 비율 | 고객 자가 처리 90% |

---

## 13. 구현 우선순위

### Phase 1: 핵심 기능 (1주)
1. [x] Supabase 프로젝트 및 DB 스키마 구성
2. [x] 주문 입력 폼 개발
3. [x] 주문 완료 화면
4. [ ] Google Sheets 연동

### Phase 2: 수정/취소 (3-4일)
5. [x] 주문 수정 기능
6. [x] 주문 취소 기능
7. [x] 수정 이력 기록

### Phase 3: 운영 안정화 (3-4일)
8. [ ] 마감 자동 잠금
9. [ ] 중복 주문 감지
10. [ ] 실제 운영 테스트 (1-2회)
11. [ ] 버그 수정

### Phase 4: 관리자 기능 (이후)
12. [x] 관리자 인증
13. [x] 관리자 대시보드
14. [x] 집계 및 배달 리스트 화면

---

## 14. 향후 확장 아이디어 (Out of Scope)

- 자동 확인 메시지 발송 (WhatsApp Business API)
- 고객용 주문 내역 조회
- 배달원 전용 앱/뷰
- 결제 시스템 연동
- 재고 관리
- 정기 구독 주문
- 다국어 지원 (영어/힌디어)

---

## 15. 부록

### 15.1 주문 상태 값

| 상태 | 설명 |
|-----|------|
| `pending` | 주문 접수 (기본값) |
| `confirmed` | 확인됨 |
| `preparing` | 제조 중 |
| `ready` | 배달 준비 완료 |
| `delivering` | 배달 중 |
| `completed` | 배달 완료 |
| `cancelled` | 취소됨 |

※ MVP에서는 `pending`, `completed`, `cancelled`만 사용

### 15.2 주문 입력 경로 값

| 값 | 설명 |
|---|------|
| `customer_direct` | 고객 직접 입력 |
| `admin_whatsapp` | 관리자 대리 (WhatsApp) |
| `admin_phone` | 관리자 대리 (전화) |
| `admin_other` | 관리자 대리 (기타) |

### 15.3 결제 방식 값

| 값 | 설명 |
|---|------|
| `upi` | UPI 송금 |
| `cash` | 현금 |
| `other` | 기타 |

---

## 16. 현재 개발 진행 현황 (2026-01-27 기준)

- **전체 진행도**: 약 85%
- **완료된 항목**:
  - 고객 주문/수정/취소 시스템 (Remix + Supabase)
  - 관리자 대시보드 및 주문/상품/카테고리 관리 도구
  - 원자적 주문 번호 생성 및 보안 강화 (RPC 적용)
- **잔여 과제**:
  - **Google Sheets 연동**: 운영 데이터 미러링을 위한 API 연동 필요
  - **운영 자동화**: 배달 전날 20:00 마감 자동 잠금 로직 구현 필요
  - **데이터 유효성**: 중복 주문 방지 로직 보완
