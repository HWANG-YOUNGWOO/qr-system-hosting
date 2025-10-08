# 🔐 Unlock System SRS (Software Requirements Specification)

본 문서는 **폴란드에서 개발되는 Unlock System**의 소프트웨어 요구사항 명세서(SRS)입니다.  
Firebase, Twilio, TypeScript 기반의 **안전한 OTP 인증 및 세션 관리 시스템**을 구축하기 위한 개발 환경, 공통 규칙, 아키텍처, UI/UX 요구사항, 제공 항목 등을 정의합니다.

---

## 📌 1. 개발환경

- **사용 국가**: 폴란드  
- **개발 도구**: Visual Studio Code + TypeScript  
- **백엔드 플랫폼**: Google Firebase  
- **문자 OTP 전송**: Twilio  

### 🔑 Twilio Credentials
- **Live**
  - Account SID: `<YOUR_TWILIO_ACCOUNT_SID>`
  - Auth Token: `9d4714ecfa1b1377bb0de512222de934`
  - Verify Service SID: `VA08f96fc0851eb8fb1438b06b4f0f64cc`
- **Test**
  - Account SID: `<YOUR_TWILIO_ACCOUNT_SID>`
  - Auth Token: `5f853f1d1c22ed01737663d9fe279931`

### ☁️ Google Cloud Secret Manager 등록 항목
- twilio-service-sid  
- twilio-sid  
- twilio-token  
- Test-twilio-Account-SID  
- Test-twilio-Auth-token  

### 🔧 Firebase Config
```typescript
const firebaseConfig = {
  apiKey: "AIzaSyAKiqdDGZ64LdxcRRYxcRm93spuhzs08x0",
  authDomain: "unlock-system-f31d9.firebaseapp.com",
  projectId: "unlock-system-f31d9",
  storageBucket: "unlock-system-f31d9.firebasestorage.app",
  messagingSenderId: "187339724320",
  appId: "1:187339724320:web:cc077aee0a0738ffe64e45",
  measurementId: "G-0B45SHS9V6"
};
```

---

## 📌 2. 공통 규칙

- **클라이언트 미신뢰 원칙**: 모든 인증/트랜잭션은 백엔드 함수에서 처리  
- **Race Condition 방지**: Firestore Transaction 기반 처리  
- **주석 및 유지보수성**: 상세한 주석 필수, 코드 가독성 최우선  
- **Twilio Test Mode**: 로그인 화면에 테스트 모드 전환 버튼 제공 (개발 단계 한정)  
- **OTP 관리 규칙**: 대기시간 초과, 재발급 제한, 연속 발급 차단 등 Twilio/Firebase 권장 규칙 준수  
- **One Source of Truth**: 세션/권한은 오직 Firebase ID Token 기반  
- **빌드 산출물 경로**: `web/dist`  

---

## 📌 3. UI/UX 요구사항

### 🌐 다국어 지원
- i18next + i18next-http-backend  
- JSON 기반 메시지 관리  
- 한글/영어 전환 버튼 제공 (기본값: 한글)  

### 📱 전화번호 입력
- intl-tel-input, libphonenumber-js 활용  
- 국가번호 선택 및 검증 기능 제공  

### 🎨 UI 스타일
- 카드형 UI  
- 특수효과, 입체효과, 클릭 유도 효과 포함  

---

## 📌 4. 로그인/로그아웃 화면

- **사용자 등록**: 관리자가 사전 등록  
- **최초 문서 ID**: 국가번호+전화번호  
- **로그인 인증**: 매번 SMS OTP 필요  
- **조건부 인증**: 등록된 사용자만 OTP 가능  
- **세션 유지**: 브라우저 재시작 시 토큰 기반 로그인 유지  
- **타임아웃**: 60분 (자동 로그아웃 + REMAIN TIME UI 표시)  
- **동시 세션 방지**: "마지막 세션 우선(Last Session Wins)" 원칙  
- **문서 ID 마이그레이션**: 최초 로그인 시 전화번호 기반 → UID 기반으로 원자적 전환  
- **역할 기반 진입**: ROLE 필드값에 따라 관리자/사용자 화면 자동 분기  
- **에러 처리**: 인증 실패 시 UI에 사유 표시  
- **onCall 함수 사용**: onRequest 대신 onCall로 경합 방지  

---

## 📌 5. 관리자 화면

- 사용자별 **QR 코드 발급 이력** 표시  
- 로그인/로그아웃 이력 (사유: 수동, 타임아웃, 동시세션)  
- 사용자 등록/삭제 버튼 → 실행 가능 조건(Interlock) 필수  

---

## 📌 6. 사용자 화면

- 백엔드 생성 이미지 표시  
- **6자리 난수 QR 코드** 표시  
- 매시 정각(00분) 자동 삭제 → 재발급 버튼 활성화  
- 삭제 후 이미지 보관 금지  
- REMAIN TIME UI 표시  

---

## 📌 7. 제공 항목

- 기능별 코드 분리 (백엔드/프론트엔드)  
- 필요 시 폴더 구조도 제공  
- Firestore 문서 키스마  
- Firestore 색인 정의  
- Firestore 규칙 (`firebase.rules`)  

---

## 📌 8. 아키텍처 설계

### ⏱ 세션 타임아웃 & 자동 로그아웃
- 세션 만료 시간은 **서버(Firestore)**에서 관리  
- 클라이언트는 UI 표시 및 자동 로그아웃만 수행  
- 서버가 최종 판단 → Race Condition 방지  

### ⚡ 원자적 마이그레이션 & 세션 관리
- Firestore Transaction 기반 문서 ID 마이그레이션  
- "마지막 세션 우선" 원칙 적용  

### 🏗 프론트엔드 아키텍처
1. **Source of Truth**: Firebase ID Token  
2. **성능 최적화**  
   - 동시 접속 확인: `users/{uid}.currentSessionId` → onSnapshot 구독  
   - 세션 만료 확인: ID Token 내 `sessionExpiresAt` 활용  
3. **Twilio Test Mode**: 로그인 폼에서 전환 가능  

### 🔒 보안 강화
- 등록된 사용자만 OTP 요청 가능  
- 비인가 전화번호 차단 → 비용 절감 및 보안 강화  

### 🧩 핵심 전략
1. **One Source of Truth**: 서버가 모든 권한/세션 결정  
2. **Atomic Operations**: Firestore Transaction 적극 활용  
3. **세션 관리**: Last Session Wins & Timeout  
4. **Role-Based Access Control**: 관리자/사용자 권한 분리  
5. **모듈화된 코드 구조**: 기능별(auth, admin, qr, events 등) 분리  

---

## 📌 9. 폴더 구조 예시(양식을 만들기 위한 참고용이고 폴더규정은 없음)

```plaintext
project-root/
├── backend/
│   ├── functions/
│   │   ├── auth/
│   │   ├── admin/
│   │   ├── qr/
│   │   └── session/
│   └── firebase.rules
├── frontend/
│   ├── src/
│   │   ├── auth/
│   │   ├── admin/
│   │   ├── user/
│   │   ├── qr/
│   │   └── i18n/
│   └── dist/
└── docs/
    └── SRS.md
```

---

✅ 이 문서는 **Unlock System**의 개발 표준 및 아키텍처를 정의하는 공식 SRS입니다.  
개발자는 본 문서를 기준으로 기능 구현, 유지보수, 확장 작업을 수행해야 합니다.  

---