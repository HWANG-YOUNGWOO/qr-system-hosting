# QR 인증 시스템 SRS

## 📖 개요
- 요구사항을 단계별로 구현 가능한 작업지시서로 정리한다.  
- 각 항목은 **우선순위, 구현 방법, 엔드포인트/함수 이름, 입력과 출력, 예외처리, 로그/모니터링 포인트, 테스트 케이스**를 포함한다.  
- Twilio / Firestore / 세션 / 마이그레이션 규칙을 그대로 반영하여 **Race Condition을 근본적으로 방지**하도록 설계한다.  

---

## 🛠 개발 환경 및 자격증명
- **개발 도구**: Visual Studio Code, TypeScript  
- **백엔드 플랫폼**: Google Firebase (Cloud Functions, Firestore, Firebase Auth)  
- **SMS OTP**: Twilio (라이브/테스트 계정 구분, Secret Manager에 저장)  
- **시크릿**: Google Cloud Secret Manager에 등록 (twilio-service-sid, twilio-sid, twilio-token, Test 계정 SID/Token)  
- **빌드 산출물 위치**: `web/dist`  
- **i18n**: i18next + i18next-http-backend (JSON 관리, 초기 한글, 한글/영어 토글 버튼)  
- **전화번호 입력/검증**: intl-tel-input, libphonenumber-js  
- **테스트 모드**: 로그인 화면에 Twilio 테스트모드 전환 버튼 (개발 단계만 노출, 이후 삭제)  

---

## 🏗 아키텍처 핵심 요구사항
- **One Source of Truth**: Firebase ID Token (sessionId, sessionExpiresAt 포함)  
- **Atomicity**: 최초 로그인 시 전화번호 기반 문서 → UID 기반 문서로 **트랜잭션 마이그레이션**  
- **Last Session Wins**: 로그인 시 새로운 sessionId 발급, 이전 세션은 자동 로그아웃 (onSnapshot 감지)  
- **세션 만료 처리**: ID Token의 sessionExpiresAt 기반 REMAIN TIME UI 제공, 만료 시 즉시 로그아웃  

---

## ☁️ 백엔드 명세 (Cloud Functions, Firestore, Secret Manager)

### 기본 원칙
- 클라이언트의 임의 판단 금지  
- 모든 민감 로직은 **Cloud Functions onCall**로 처리 (onRequest 금지)  
- 상세 주석 및 로그 필수  

### 주요 함수
| 함수명 | 입력 | 동작 | 반환 | 예외/보안 |
|--------|------|------|------|-----------|
| **auth/checkRegisteredPhone** | countryCode, phoneNumber, testModeFlag | 등록 여부 확인 | 등록 여부 코드 | 과도 요청 시 throttling |
| **auth/sendOtp** | countryCode, phoneNumber, testModeFlag | Twilio OTP 전송, Firestore 이벤트 기록 | attemptId, nextAllowedRequestAt, expireAt, i18n 메시지 키 | OTP 재발급 제한, Twilio 응답 로깅 |
| **auth/verifyOtpAndLogin** | countryCode, phoneNumber, attemptId, otpCode, clientRequestId | OTP 검증, 트랜잭션 마이그레이션, 세션 생성, ID Token 발급 | ID Token, refreshToken, role, uid, sessionExpiresAt | 검증 실패/만료/비등록 사용자 |
| **auth/logout** | uid, sessionId | currentSessionId 검증 후 로그아웃 처리 | 성공/거부 코드 | 세션 불일치 시 거부 |
| **admin/registerUser** | countryCode, phoneNumber, displayName, role | 사용자 등록/수정 | 성공 여부 | ensureAdmin 가드 |
| **admin/deleteUser** | uid or phoneKey | 사용자 삭제, 이력 기록 | 성공 여부 | ensureAdmin 가드 |
| **admin/getUserAudit** | filter(날짜, uid) | 로그인/로그아웃/QR 발급 이력 반환 | 이력 데이터 | ensureAdmin 가드 |
| **qr/generate** | uid, sessionId | 6자리 난수 QR 생성, Firestore 저장, base64 반환 | QR 이미지(base64), expireAt | QR 만료 후 즉시 삭제 |

---

## 🗄 Firestore 디자인
- **컬렉션 구조**
  - `users/{uid}`  
  - `users_by_phone/{countryPhoneKey}` (초기)  
  - `sessions/{sessionId}` (옵션)  
  - `authEvents/{eventId}` (type, uid, reason, ipHash, ts)  
  - `qrTokens/{qrId}` (uid, code6, expireAt)  

- **인덱스**
  - 전화번호 검색, sessionExpiresAt 쿼리, authEvents 쿼리  

- **보안 규칙**
  - 관리자 권한 검증  
  - users 문서 보호  
  - sessions 및 qrTokens 접근 제어  

---

## 📊 로깅/모니터링
- 모든 onCall 함수 시작/종료/예외 로그 기록  
- 민감 데이터(OTP 코드, 토큰) 로깅 금지  
- 실패 사유는 i18n 메시지 키로 기록  

---

## 💻 프론트엔드(UI/클라이언트) 명세
- **핵심 원칙**: 클라이언트는 판단하지 않음. 서버 발급 ID Token만 사용  
- **로그인 화면**
  - 입력: 국가선택 + 전화번호, 사용자명 표시 여부  
  - 버튼: OTP 요청, Twilio 테스트모드 토글, 언어 토글  
  - 동작: checkRegisteredPhone → sendOtp → attemptId 기반 UI 상태 표시  
  - UI: REMAIN TIME, OTP 재시도 안내, 인증 제한 안내  

- **세션 유지**
  - ID Token 저장 (HttpOnly cookie 권장)  
  - 브라우저 재실행 시 토큰 갱신  
  - 만료 시 자동 로그아웃  

- **동시세션**
  - onSnapshot으로 currentSessionId 구독  
  - 불일치 시 즉시 로그아웃  

- **관리자 화면**
  - 사용자 목록/검색, 등록/삭제, QR 발급 이력 확인  

- **사용자 화면**
  - 서버 생성 QR 표시 (6자리 난수, 매시 00분 만료)  
  - 만료 후 즉시 제거 및 재발급 버튼 활성화  

---

## 📂 파일/폴더 구조(양식을 만들기 위한 참고용이고 폴더규정은 없음)
```
qr-system-hosting/
 ├─ functions/
 │   └─ src/
 │       ├─ auth/ (index.ts, serviceTwilio.ts, transactionMigrate.ts)
 │       ├─ admin/ (index.ts)
 │       ├─ qr/ (index.ts)
 │       └─ utils/ (logger.ts, validators.ts, i18nKeys.ts, rateLimiter.ts)
 │   package.json, tsconfig.json
 ├─ web/
 │   └─ src/
 │       ├─ components/ (Auth, Admin, User, Shared)
 │       ├─ services/ (api.ts, authClient.ts, twilioTestState.ts)
 │       ├─ hooks/ (useSession.ts, useOnSnapshotCurrentSession.ts)
 │       ├─ i18n/ (locales/ko.json, locales/en.json)
 │       index.tsx, App.tsx, router.tsx, vite.config.ts
 │   package.json, tsconfig.json
 ├─ firestore.indexes.json
 ├─ firebase.rules
 └─ README.md
```

---

## ✅ 산출물
- Cloud Functions 소스  
- firestore.indexes.json  
- firebase.rules  
- 프론트엔드 소스 및 `web/dist` 빌드물  
- README 배포 지침서  
- 시크릿 등록 스크립트 예시  

---

## 🧪 테스트 케이스
1. 등록되지 않은 번호 → OTP 요청 거부  
2. 정상 등록번호 → Twilio 전송 확인 (테스트/라이브)  
3. OTP 재발급 제한 및 nextAllowedRequestAt 동작 확인  
4. 동시 로그인 시 이전 기기 자동 로그아웃  
5. 최초 로그인 시 전화번호 문서 → UID 문서 원자적 마이그레이션  
6. 세션 만료 후 자동 로그아웃 및 토큰 갱신 처리  
7. QR 발급 및 매시 00분 만료 후 제거/재발급 버튼 활성화  
8. 관리자 권한 검증 및 인터록 동작 확인  

---

## 🔒 보안 및 운영 체크리스트
- Twilio 시크릿은 Secret Manager에만 저장 (하드코딩 금지)  
- 모든 onCall 함수는 권한/입력 검증 수행  
- OTP 코드/민감 정보는 로그에 기록 금지  
- 테스트모드 UI는 개발환경에서만 노출, 프로덕션 빌드 전 제거  
- Twilio 비용/오용 방지: 미등록 번호 차단, 재발송 제한, IP별 rate limiting  
- Firestore 규칙으로 관리자 외 사용자 문서 변경 차단  

---

## 📈 운영 모니터링 포인트
- OTP 전송 실패율  
- OTP 재발급 빈도  
- 동시세션 충돌 빈도  
- 트랜잭션 충돌률  
- Cloud Functions 오류율  

---

이제 이 문서를 기반으로 실제 구현 단계별 **작업지시서**를 작성하면, 개발팀이 바로 실행 가능한 수준.