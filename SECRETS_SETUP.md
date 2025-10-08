# Secrets 설정 가이드

이 문서는 Firebase/GCP 서비스 계정 생성, Google Secret Manager에 시크릿 추가, 그리고 GitHub Actions에 필요한 시크릿(서비스 계정 JSON, Firebase CI 토큰 등)을 설정하는 단계별 가이드입니다.

대상 기능
- Firebase Functions 배포 자동화(CI/CD)
- Twilio 자격증명 보관(Secret Manager)

사전조건
- 프로젝트에 대한 GCP 프로젝트 소유자 또는 서비스 계정 생성 권한
- Firebase 프로젝트가 GCP 프로젝트에 연결되어 있음
- GitHub 저장소에 워크플로(예: `.github/workflows/ci-cd.yml`)가 존재함

용어
- SERVICE ACCOUNT: GCP 리소스에 접근하는 머신 계정
- SERVICE ACCOUNT KEY(JSON): 서비스 계정의 인증 정보 파일
- FIREBASE_TOKEN: `firebase login:ci`로 생성한 배포 토큰 (대체 옵션)

---

## 1. 서비스 계정 생성 (GCP Console)
1. GCP Console 접속: https://console.cloud.google.com/
2. 좌측 메뉴에서 `IAM & Admin` → `Service accounts` 선택
3. `CREATE SERVICE ACCOUNT` 클릭
   - 이름: `qr-system-deployer` (예)
   - ID: 자동 생성
   - 설명: `CI/CD deploy account for Firebase functions and hosting`
4. `CREATE AND CONTINUE`
5. 역할(Role) 할당: 아래 권한을 권장함
   - `Firebase Admin` 또는 조합:
     - `Cloud Functions Admin` (functions 배포)
     - `Cloud Build Service Account` (선택적)
     - `Firebase Hosting Admin` (호스팅 배포)
     - `Secret Manager Secret Accessor` (Secret Manager 읽기)
6. `DONE`

> 권한 최소화 권장: 필요 없는 권한은 제거하세요. 서비스 계정을 조직/폴더 정책에 맞게 생성하세요.

## 2. 서비스 계정 키(JSON) 생성
1. 방금 생성한 서비스 계정 우측의 `⋮` → `Manage keys` 클릭
2. `ADD KEY` → `Create new key` → `JSON` 선택 → `Create`
3. 다운로드된 JSON 파일(`service-account-qrsystem.json`)을 안전하게 보관하세요.

## 3. GitHub Secrets에 서비스 계정 JSON 추가
1. GitHub 저장소로 이동 → `Settings` → `Secrets and variables` → `Actions`
2. `New repository secret` 클릭
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: service-account JSON 파일의 전체 내용을 붙여넣기
3. 저장

## 4. FIREBASE_TOKEN 생성(대체 인증 방식)
- 로컬에서 빠른 CI 토큰을 생성하려면 다음을 사용합니다(개인용 머신에서 실행):

```powershell
npm i -g firebase-tools
firebase login:ci
# 프롬프트를 따라 로그인 후 토큰을 복사
# GitHub Secret에 추가: FIREBASE_TOKEN
```

> 권장: 서비스 계정 JSON을 사용한 인증(Google Application Credentials)을 우선 사용하세요. `FIREBASE_TOKEN`은 간단한 대체 방법입니다.

## 5. Secret Manager에 Twilio 자격증명 추가
1. GCP Console → `Secret Manager`
2. `Create Secret`
   - Name: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` 또는 `TWILIO_VERIFY_SID` 등
   - Secret value: 실제 값 입력
3. 생성 후, 서비스 계정에 `Secret Manager Secret Accessor` 역할이 부여되어야 Functions에서 읽을 수 있습니다.

## 6. 서비스 계정에 Secret Manager 접근 권한 부여
1. GCP Console → `Secret Manager`에서 생성한 시크릿 선택 → `PERMISSIONS` 탭
2. `Add principal` 클릭
   - New principal: `service-account-email@project.iam.gserviceaccount.com`
   - Role: `Secret Manager Secret Accessor`
3. 저장

## 7. Firebase 프로젝트와 연동된 CI 구성 예시
- GitHub Actions 워크플로에서는 다음과 같이 서비스 계정과 토큰을 사용합니다:
  - `FIREBASE_SERVICE_ACCOUNT` (JSON)
  - `FIREBASE_TOKEN` (선택적)

워크플로 예시 (요약)
- Checkout
- Setup Node
- Install deps
- Build, Lint, Test
- Authenticate: echo "$FIREBASE_SERVICE_ACCOUNT" > $HOME/fsa.json; export GOOGLE_APPLICATION_CREDENTIALS=$HOME/fsa.json
- Deploy: firebase deploy --only functions --token "$FIREBASE_TOKEN"

## 8. 보안 권장사항
- 서비스 계정 키를 로컬 디스크 또는 커밋에 절대 포함하지 마세요.
- GitHub Secrets에 저장된 값은 암호화되어 저장되지만 필요한 권한만 부여하세요.
- 주기적으로 서비스 계정 키를 회전하세요.

## 9. 배포 검증
1. GitHub Actions에서 workflow 수동 실행 후 로그 확인
2. Firebase Console에서 최근 배포 및 함수 로그 확인
3. 간단한 헬스체크(HTTP 호출 또는 onCall 호출)로 서비스 정상 확인

## 10. 문제 해결 팁
- `PERMISSION_DENIED` 관련 에러: 서비스 계정에 필요한 역할이 누락된 경우가 많음 (Functions Admin, Secret Accessor 등).
- `Firebase token invalid`: `FIREBASE_TOKEN` 만료 또는 잘못된 토큰.
- `Secret Manager access denied`: 시크릿에 대한 액세스 권한이 부여되지 않음.

---

파일 생성 완료: `SECRETS_SETUP.md`.

원하시면 이 가이드를 기반으로 GitHub Actions에서 서비스 계정 JSON을 사용해 실제로 인증하는 예시 스텝(코드)을 워크플로에 통합해 드리겠습니다.