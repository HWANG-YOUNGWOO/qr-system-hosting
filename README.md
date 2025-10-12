# QR System Hosting — Development README

이 저장소는 Firebase Functions(backend)와 Vite+React(web)를 사용한 프로젝트입니다.

## 빠른 시작 (로컬 개발)

1. 루트에서 각 패키지 의존성 설치

```powershell
cd functions
npm install
cd ..\web
npm install
```

2. functions 빌드

```powershell
cd functions
npm run build
```

3. 에뮬레이터 시작 (functions)

```powershell
# 프로젝트 루트
npx.cmd firebase emulators:start --only functions
```

4. web 개발 서버 시작

```powershell
cd web
npm run dev
```

5. 브라우저에서 열기

- Vite: http://localhost:5173 (혹은 빈 포트가 있으면 5174 등)
- Functions Emulator UI: http://127.0.0.1:4000/

## 환경 변수 (Vite)

`web`에서 Vite 환경변수를 사용합니다. 예시 `.env` 파일:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=unlock-system-f31d9
VITE_FUNCTIONS_EMULATOR_HOST=127.0.0.1
VITE_FUNCTIONS_EMULATOR_PORT=5001
```

`.env` 파일은 Git에 커밋하지 마세요.

## Secret Management (Functions)

- 개발 중에는 `firebase functions:config:set`을 사용하거나 로컬 Secret Manager를 사용하세요.
- 배포 시에는 Google Secret Manager 사용을 권장합니다. `functions/src/secret-manager.ts` 예제를 참고하세요.

## Secrets (Quick setup)

Add these repository secrets for CI and Twilio integration:

- `FIREBASE_SERVICE_ACCOUNT`: service account JSON (paste full JSON)
- `FIREBASE_TOKEN` (optional): output of `firebase login:ci` for fallback deploys
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` or `TWILIO_VERIFY_SID`: Twilio credentials

Steps:

1. Create a service account in GCP (Roles: Cloud Functions Admin, Firebase Hosting Admin, Secret Manager Secret Accessor).
2. Download the JSON key and paste it into `FIREBASE_SERVICE_ACCOUNT` in GitHub Secrets.
3. (Optional) Run `firebase login:ci` locally and save token to `FIREBASE_TOKEN`.
4. Add Twilio credentials as repository secrets.

Do not commit any keys or tokens to the repository.

For a step-by-step capture guide and example screenshots, see `README_SECRETS.md` in the repository root.

## 배포 체크리스트

- functions: Node 엔진 호환성 확인(`package.json`의 `engines.node`)
- lint, tsc 확인: `npm run lint`, `npm run build`
- 시크릿 및 환경변수 설정
- `firebase deploy --only functions,hosting`

## 추가 도움말
원하시면 `README`에 배포용 스크립트나 PowerShell 실행 스크립트를 추가해 드리겠습니다.