# QR System Hosting — Implementation Specification

이 문서는 사용자의 요구사항을 바탕으로 단계별 구현 가능한 작업지시서입니다. 각 항목은 우선순위, 구현 방법, 엔드포인트/함수 이름, 입력/출력, 예외 처리, 로그/모니터링 포인트, 테스트 케이스를 포함합니다. 특히 Twilio/Firestore/세션/마이그레이션 규칙을 반영하여 Race Condition을 방지하도록 설계합니다.

---

## 목차
1. 핵심 원칙
2. 우선순위별 작업 항목
3. 각 함수/엔드포인트 명세
4. Firestore 데이터 모델 및 규칙
5. 시크릿 및 배포
6. 프론트엔드 요구사항
7. 테스트 케이스
8. 운영/모니터링 체크리스트
9. 마이그레이션·동시성·원자성 설계

---

## 1. 핵심 원칙
- One Source of Truth: 서버 발행 ID Token만 세션의 진실로 인정. Token에는 `sessionId`와 `sessionExpiresAt`을 포함시켜 서명한다.
- Atomicity: 전화번호→UID 마이그레이션과 세션 설정은 Firestore 트랜잭션으로 단일 원자적 처리를 보장.
- Last Session Wins: `users/{uid}.currentSessionId` 필드에 현재 세션을 기록. 다른 기기에서 로그인하면 이전 세션 자동 로그아웃.
- 민감 데이터(OTP, tokens)는 로깅하지 않음.

---

## 2. 우선순위별 작업 항목 (P0, P1, P2)

P0 (필수, 먼저 구현)
- auth/checkRegisteredPhone (onCall) — 입력 검증, 존재 확인, rate limit
- auth/sendOtp (onCall) — Twilio 호출, attempt 기록(코드 저장 금지), throttling
- auth/verifyOtpAndLogin (onCall) — OTP 검증, 전화번호→UID 원자적 마이그레이션, session 생성/토큰 발급
- sessions/currentSession onSnapshot 구독 로직(클라이언트)
- Firestore rules: users 보호, admin 권한 제어
- Secret Manager 연동: Twilio 테스트/라이브 시크릿 분리

P1 (중요, 이후 구현)
- admin/registerUser, admin/deleteUser, admin/getUserAudit (onCall, ensureAdmin)
- qr/generate (onCall) — QR 발급, 만료 정책(매시 00분)
- audit logs 및 지표 수집(OTP 실패율 등)

P2 (편의 기능)
- 관리 UI 향상, CSV import/export, Audit 뷰 확장

---

## 3. 함수/엔드포인트 상세 명세

공통: 모든 onCall 함수는 입력 스키마를 엄격히 검증하고, 호출자 IP 및 user-agent에서 해시된 `ipHash` 값을 로그에 남긴다. 예외는 i18n 메시지 키로 반환.

### 3.1 auth/checkRegisteredPhone (onCall)
- 우선순위: P0
- 접근: unauthenticated
- 입력: { countryCode: string, phoneNumber: string, testModeFlag?: boolean }
- 출력: { registered: boolean, messageKey?: string }
- 구현 방법:
  - Validate inputs using libphonenumber-js.
  - Look up `users_by_phone/{countryCode+phoneNumber}` document.
  - Rate limiting: per IP + per phone number (ex: 5/min) via rateLimiter util and Firestore counter (or in-memory for single instance).
- 예외:
  - Not registered -> return { registered: false, messageKey: 'auth.notRegistered' }
  - Rate limit exceeded -> return { registered: false, messageKey: 'auth.rateLimited' }
- 로그: request start/end, reason on failure, save event to `authEvents` with type='checkRegisteredPhone'
- 테스트 케이스:
  - 등록된/미등록 번호 확인
  - 빠른 반복 요청 시 rate limit

### 3.2 auth/sendOtp (onCall)
- 우선순위: P0
- 접근: unauthenticated
- 입력: { countryCode, phoneNumber, testModeFlag }
- 출력: { attemptId, nextAllowedRequestAt, expireAt, messageKey }
- 구현 방법:
  - Must call/verify auth/checkRegisteredPhone result (enforce in server: repeat check before sending).
  - Rate limiting & anti-abuse: per phone, per IP checks, and per-account cooldown.
  - Generate `attemptId` (UUIDv4) and store in `otpAttempts/{attemptId}` with metadata: createdAt, phoneKey, ipHash, attempts=0, expireAt=now+5min. DO NOT STORE OTP VALUE.
  - Send OTP via Twilio service wrapper (`serviceTwilio.sendOtp(phone, testModeFlag)`). For testModeFlag=true, use Test Twilio secrets.
  - Log Twilio response status, but not the OTP code.
  - Compute `nextAllowedRequestAt` based on policy (e.g., 30s/60s), and `expireAt` for current OTP.
- 예외: Twilio errors -> return i18n key, save failure reason in logs.
- 모니터링: OTP send success/failure ratio.
- 테스트 케이스:
  - 정상 발송(라이브/테스트)
  - 재발급 제한 동작
  - Twilio 실패 시 에러 반환

### 3.3 auth/verifyOtpAndLogin (onCall)
- 우선순위: P0
- 접근: unauthenticated
- 입력: { countryCode, phoneNumber, attemptId, otpCode, clientRequestId }
- 출력: { idToken, refreshTokenPolicy, role, uid, sessionExpiresAt }
- 구현 방법:
  - Validate inputs.
  - Load `otpAttempts/{attemptId}` and verify phoneKey matches and not expired.
  - Verify OTP via Twilio or local verification pattern (depending on testModeFlag saved in attempt metadata).
  - On success, perform a Firestore transaction:
    1. Read `users_by_phone/{phoneKey}` doc. If exists and `uid` not set, then create `users/{newUid}` and copy relevant profile, set mapping, atomically delete or mark old phone doc (migration) — ensure idempotency with transaction and conditional writes using `exists` checks.
    2. Generate new `sessionId` (UUIDv4) and `sessionExpiresAt = now + 60min`.
    3. Update `users/{uid}.currentSessionId = sessionId` and write `authEvents/{eventId}` documenting login.
  - Issue Firebase Custom Token with additional claims: { sessionId, sessionExpiresAt, role } and exchange for ID Token if necessary (or instruct client to use Firebase SDK to exchange custom token).
- 예외:
  - OTP invalid/expired -> return i18n key 'auth.invalidOtp'
  - attempt mismatch or already used -> return 'auth.invalidAttempt'
- 테스트 케이스:
  - 동시성: 두개의 verify 동시 요청 — transaction ensures only one migration/session wins.
  - session propagation: 다른 세션 구독자 자동 로그아웃.

### 3.4 auth/logout (onCall)
- 우선순위: P0
- 접근: authenticated
- 입력: { uid, sessionId }
- 출력: { success: boolean }
- 구현 방법:
  - Verify caller uid matches param uid and authenticated.
  - Transaction: read `users/{uid}.currentSessionId`; if equal to sessionId then set to null and write logout event. Else return { success: false, messageKey: 'auth.alreadyLoggedOut' }
- 테스트 케이스:
  - 정상 로그아웃
  - 이미 다른 세션으로 대체된 경우 거부

### 3.5 admin/registerUser, admin/deleteUser, admin/getUserAudit
- 우선순위: P1
- 접근: ensureAdmin guard (verifies custom claim role='admin' in token)
- 구현 방법은 문서에 상세히 기술 (생략 요약)

### 3.6 qr/generate (onCall)
- 우선순위: P1
- 접근: authenticated
- 입력: { uid, sessionId }
- 출력: { qrBase64, qrId, expireAt }
- 구현 방법:
  - Verify sessionId matches `users/{uid}.currentSessionId`.
  - Generate 6-digit random code, ensure uniqueness for non-collision within short window (e.g., attempt to write with code as a unique index/document id or use Firestore transaction with queries).
  - Store `qrTokens/{qrId}` with uid, code6, expireAt (expireAt = nextHourStart).
  - Return base64 image (generated on-the-fly) — do NOT persist image file.
  - Schedule or function to delete expired tokens at their expireAt (Cloud Scheduler + Cloud Function) OR background worker that periodically deletes expired docs.
- 테스트 케이스:
  - QR 생성 및 만료 확인
  - 재발급 제한

---

## 4. Firestore 데이터 모델 및 규칙
(문서에서는 users_by_phone, users, authEvents, otpAttempts, qrTokens, sessions 구조 및 인덱스 명시 — 생략)

---

## 5. 시크릿 및 배포
- Secret Manager: twilio-service-sid, twilio-sid, twilio-token, test-twilio-sid, test-twilio-token
- 배포 스크립트: `scripts/deploy.sh` 예시(Windows PowerShell 버전 포함)

---

## 6. 프론트엔드 요구사항
(로그인 화면, OTP 흐름, session 관리, onSnapshot 구독 등 세부 사항 포함 — 생략)

---

## 7. 테스트 케이스
(요청에 포함된 우선순위 테스트 케이스 목록을 포함)

---

## 8. 운영/모니터링 체크리스트
(요청 본문에 명시된 지표 및 알림 설정 권장)

---

## 9. 마이그레이션·동시성 설계
- 전화번호→UID 마이그레이션은 Firestore Transaction으로 처리
- 세션으로 인한 동시성은 `currentSessionId` 단일 필드 업데이트로 해결
- 추가적으로 optimistic locking이 필요한 경우 문서에 `version` 필드 도입

---

문서가 길어 요약본을 먼저 만들었습니다. 원하시면 각 섹션을 더 세부적으로 확장(예: 각 onCall 함수의 TypeScript 서명, Firestore 쿼리 예제, 보안 규칙 코드 블록, 인덱스 JSON)하여 SPEC.md를 업데이트하겠습니다. 어떤 섹션을 우선 확장할까요?