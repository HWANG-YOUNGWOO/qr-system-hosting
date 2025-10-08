# Deployment Checklist — QR System Hosting

이 체크리스트는 Firebase Functions(backend)와 Web(frontend)을 안전하게 빌드·배포하기 위한 절차입니다. 배포 전 반드시 아래 단계를 확인하세요.

> 참고: 모든 명령은 Windows PowerShell(또는 cmd) 기준입니다. PowerShell에서 `npm` 스크립트가 차단되면 `npm.cmd`를 사용하세요.

## 사전 준비 (Pre-deploy)

- [ ] 코드 베이스 최신화
  - 로컬에 작업 중인 변경사항이 있으면 커밋 또는 임시 브랜치로 분리하세요.
  - 원격(예: `origin/main`)으로부터 최신 코드를 pull 받아 머지/리베이스하세요.

- [ ] 의존성 설치
  - functions:
    ```powershell
    cd functions
    npm.cmd install
    # 필요 시 peer dependency 충돌 처리:
    # npm.cmd install --legacy-peer-deps
    ```
  - web:
    ```powershell
    cd ../web
    npm.cmd install
    ```

- [ ] 환경/시크릿 확인
  - Twilio, Firebase 서비스 계정, 기타 서드파티 자격증명 확인.
  - Secret Manager에 다음 시크릿이 있는지 확인:
    - Twilio account SID, auth token 또는 Verify Service SID
  - GCP 서비스 계정이 필요한 IAM 역할(Secret Manager 액세스, Firestore 쓰기 등)을 가지고 있는지 확인.

- [ ] 테스트
  - 유닛 테스트가 있으면 모두 통과시키세요.
  - 로컬 에뮬레이터에서 주요 시나리오(OTP 전송, OTP 검증, 로그인/로그아웃)를 수동으로 확인하세요.
    ```powershell
    # 에뮬레이터 시작
    firebase emulators:start --only functions,firestore
    # 단일 E2E 테스트 예
    node functions/test/sendOtpStressTest.mjs --concurrency=1 --requests=1 --functionsPort=5002
    ```

- [ ] 정적 분석 및 빌드
  - functions:
    ```powershell
    cd functions
    npm.cmd run lint
    npm.cmd run build
    ```
  - web:
    ```powershell
    cd ../web
    npm.cmd run lint
    npm.cmd run build
    ```

- [ ] 배포 창 및 롤백 계획 수립
  - 배포 시간을 정하고, 문제가 생겼을 때를 대비한 롤백 절차(버전, 이전 배포 태그)를 준비하세요.

## 배포 (Deploy)

- [ ] Functions 배포
  - 사전 빌드가 완료된 상태에서 functions 배포:
    ```powershell
    cd functions
    firebase deploy --only functions
    ```
  - 또는 CI/CD를 사용한다면 해당 파이프라인에 따라 배포하세요.

- [ ] Web 배포
  - Vite 빌드 산출물을 배포합니다(호스팅 선택에 따라 절차 다름).
  - Firebase Hosting 사용 시:
    ```powershell
    cd web
    firebase deploy --only hosting
    ```

## 배포 후 검증 (Post-deploy)

- [ ] 헬스체크(기본)
  - 함수 호출(샘플 요청)으로 정상 응답 확인.
  - 인증 경로(OTP 전송/검증) 샘플 시나리오 실행.

- [ ] 로그 확인
  - Firebase Console 또는 CLI로 최근 로그를 확인해 예외/에러가 없는지 확인.
    ```powershell
    firebase functions:log --limit 50
    ```

- [ ] 모니터링 및 알림
  - 에러율, 지연 시간(latency)을 주기적으로 모니터링하고 알림을 설정하세요.

## 문제 발생 시 롤백(Rollback)

- 간단한 롤백 옵션
  - Functions: 이전 안정 버전으로 코드 되돌리고 다시 배포.
  - Hosting: Firebase Hosting의 이전 버전으로 롤백.

- 심각한 장애 대응
  - 영향을 받는 트래픽을 차단하거나 유지보수 페이지로 라우팅.
  - GCP 서비스 상태 확인 및 팀에게 알림.

## 보안 체크리스트

- [ ] 시크릿은 Secret Manager로 관리(코드에 하드코딩 금지)
- [ ] 최소 권한 원칙 적용(서비스 계정 권한 최소화)
- [ ] 로그에 민감정보(전화번호 전체, 토큰 등) 기록 금지

## 배포 관련 파일/명령 요약
- functions/package.json — functions 스크립트 및 의존성
- functions/src — 함수 코드
- web/ — 프론트엔드
- firebase.json — 에뮬레이터 및 호스팅 설정

## 참고: 체크리스트 템플릿 사용 권장
- 배포 전/중/후 체크리스트는 CI/CD 파이프라인과 연동하여 자동화하세요.

---

파일을 생성했습니다: `DEPLOY_CHECKLIST.md`

완료 처리할까요? (예: TODO를 완료로 변경)