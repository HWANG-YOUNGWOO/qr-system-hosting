# QR System Hosting — Resume & Handoff Guide

이 문서는 개발자가 프로젝트를 중단했다가 다시 시작할 때 빠르게 현재 상태를 이해하고 개발을 재개할 수 있도록 작성된 안내서입니다.

목표
- Twilio 기반 OTP 로그인(Cloud Functions)과 React/Vite 프론트엔드를 포함한 전체 스택을 안정적으로 운영/개발할 수 있게 함.
- 로컬 에뮬레이터 환경에서 E2E 테스트 및 부하(stress) 테스트를 재현하고 문제를 디버깅할 수 있게 함.

요약
- 레포 위치: `d:\WORKDATA\PG\HTML\qr-system-hosting`
- 주요 폴더:
  - `functions/` — Firebase Cloud Functions (TypeScript). 인증(OTP), Twilio 래퍼, Firestore 토큰버킷 레이트리미터, 테스트 스크립트 포함.
  - `web/` — React + Vite 프론트엔드 (TypeScript).

## 현재 상태(완료된 작업)
아래는 이 프로젝트에서 이미 구현/완료된 주요 항목들입니다.

- OTP 인증 플로우 구현
  - `functions/src/auth/index.ts`에 `checkRegisteredPhone`, `sendOtp`, `verifyOtpAndLogin`, `logout` 등 onCall 함수 구현.
  - E.164 형식 변환 함수 `toE164` 추가로 Twilio `To` 파라미터 오류 수정.
- Twilio 통합
  - `functions/src/serviceTwilio.ts`에 Twilio Verify 래퍼 구현.
  - 프로덕션용으로 DEBUG 로깅 삭제(마지막 4자리만 기록).
  - Twilio 시크릿은 Google Secret Manager를 사용하도록 구현.
- Firestore 기반 토큰버킷 레이트리미터
  - `functions/src/utils/tokenBucket.ts`에 트랜잭션 기반 토큰 소비 로직 구현.
  - Firestore lazy-init으로 "default Firebase app does not exist" 문제 해결.
- 로컬 테스트/스트레스 스크립트
  - `functions/test/sendOtpStressTest.mjs`로 많은 동시 요청 테스트 가능.
  - 테스트 로그는 `functions/stress-results.log`에 기록.
- 에뮬레이터 및 포트 조정
  - `firebase.json`에 Firestore 에뮬레이터 포트 8085로 변경(포트 충돌 회피).
- 빌드 및 배포
  - `web/` 빌드(Vite) 성공.
  - `functions` 빌드 후 Firebase에 배포(함수 업로드 완료 기록 있음).
- ESLint/TypeScript
  - `functions/.eslintrc.js` 조정: import resolver 설정 추가 및 일부 규칙 경감.
  - `functions/package.json`의 devDependencies 업데이트 및 TypeScript 버전 조정(호환성 확보).

## 잔여 작업(우선순위별)
1) 에뮬레이터 E2E 확인 (우선순위: 높음)
   - Firestore 및 Functions 에뮬레이터를 올리고 단일 `sendOtp` 및 `verifyOtpAndLogin` 경로를 테스트하여 전체 플로우 작동 확인.
   - 파일: `functions/test/sendOtpStressTest.mjs` (단일 요청 모드로 사용 가능)

2) ESLint import/namespace 오류 정리 (우선순위: 중)
   - 현재 `import/namespace` 관련 2개의 오류가 남아있음(예: `initializeApp`, `auth` 네임스페이스 관련).
   - 해결 방법: import 스타일 조정 또는 ESLint 규칙 완화/정리.
   - 파일: `functions/.eslintrc.js`, `functions/src/*.ts`

3) 스트레스 테스트의 신뢰성 개선 (우선순위: 중)
   - 스트레스 테스트에서 간헐적으로 `fetch failed` 또는 REST 시드 404가 관찰됨.
   - 개선: 시드(테스트 데이터 생성)를 보장(완료 확인)한 뒤 테스트 시작, 요청 재시도 로직 추가.
   - 파일: `functions/test/sendOtpStressTest.mjs`

4) 타입 정밀도 및 테스트 추가 (우선순위: 낮)
   - `@typescript-eslint/no-explicit-any` 경고들을 정리하고 타입을 강화.
   - 핵심 로직(토큰버킷, auth flows)에 대한 단위 테스트 추가.

5) 문서화 및 배포 프로세스 정리 (우선순위: 낮)
   - 배포 체크리스트(시크릿, 환경 변수, 역할/권한) 작성.

## 환경 재개 가이드(중단 후 재개용 단계별 명령)
아래 명령들은 Windows PowerShell(또는 `cmd`)에서 실행된다. PowerShell에서는 `npm` 실행 관련 정책으로 `npm.cmd`를 사용해야 할 수 있다.

1) 저장소 루트로 이동

```powershell
cd "d:\WORKDATA\PG\HTML\qr-system-hosting"
```

2) Functions 패키지 의존성 설치

```powershell
cd functions
npm.cmd install
# 만약 peer dependency 충돌이 발생하면
# npm.cmd install --legacy-peer-deps
```

3) Web 의존성 설치

```powershell
cd ..\web
npm.cmd install
```

4) 로컬 에뮬레이터 기동(Functions + Firestore)

```powershell
cd ..
# 프로젝트 루트에서
firebase emulators:start --only functions,firestore
# 또는 functions 전용으로
cd functions
npm.cmd run serve
```

5) 단일 E2E 테스트(에뮬레이터가 기동된 상태에서)

```powershell
# functions 폴더
node test/sendOtpStressTest.mjs --concurrency=1 --requests=1 --functionsPort=5002
```

6) 린트와 빌드 확인

```powershell
# functions
npm.cmd run lint
npm.cmd run build
# web
cd ../web
npm.cmd run build
```

## 자주 발생하는 문제 및 해결책
- PowerShell에서 `npm` 스크립트 실행이 실패할 때
  - 원인: PowerShell 실행 정책이 `npm.ps1` 실행을 차단.
  - 해결: `npm` 대신 `npm.cmd` 사용 또는 PowerShell 실행 정책을 변경.

- Twilio `Invalid parameter 'To'` 오류
  - 원인: 전화번호 형식이 E.164('+8210...')가 아님.
  - 해결: `functions/src/auth/index.ts`의 `toE164()` 사용으로 전화번호 표준화.

- Firebase default app error
  - 원인: 모듈 초기화 시점에 Firestore/SDK 호출.
  - 해결: Firestore lazy-init 패턴 적용(예: tokenBucket에서 lazy import).

- ESLint `Resolve error: typescript with invalid interface loaded as resolver`
  - 원인: `eslint-plugin-import`의 resolver와 TypeScript/@typescript-eslint 버전 불일치.
  - 해결: `eslint-import-resolver-typescript` 설치 및 `.eslintrc.js`의 resolver 설정 조정(이미 적용함).

## 주요 파일 맵
- functions/
  - src/auth/index.ts — OTP onCall 함수들
  - src/serviceTwilio.ts — Twilio Verify 래퍼
  - src/utils/tokenBucket.ts — Firestore 기반 토큰버킷
  - test/sendOtpStressTest.mjs — 스트레스/테스트 스크립트
  - package.json — functions용 의존성 및 스크립트
  - .eslintrc.js — ESLint 설정
- web/
  - src/ — React 소스
  - package.json — web 의존성

## 개발자 팁
- 로컬 시크릿/환경: Twilio 자격증명은 Secret Manager 사용을 권장하므로 로컬 에뮬레이터 테스트시에는 환경 변수를 사용해 시크릿 값을 주입하거나 `functions/src/serviceTwilio.ts`에서 테스트 플래그로 Mock 동작을 활성화할 수 있습니다.
- 안정적인 스트레스 테스트: 먼저 `sendOtpStressTest.mjs`에서 REST 시드가 성공했는지 로그(또는 Firestore 컬렉션 존재)를 확인하는 로직을 추가하세요.

---

이 문서를 루트에 `RESUME_GUIDE.md`로 생성했습니다. 추가로, 원하시면 다음을 더해 드립니다:
- 더 상세한 배포 체크리스트(서비스 계정 권한, Secret Manager 설정) 작성
- 스트레스 테스트 신뢰성 개선(시드 확인/재시도 로직 추가)
- 남아 있는 ESLint import/namespace 오류를 코드 단위로 자동 수정 제안 및 적용

원하시는 추가 작업을 알려 주세요.