🚀 Windows에서 Git 첫 설정 → GitHub 푸시까지 요약 정리

---

**구성 요소 정리**

Windows에서 Git 사용을 위한 요구 사항을 정리해야겠어요. 우선 Git을 설치하고, 전역 설정을 마친 후, 프로젝트 폴더를 만들고 Git을 초기화합니다. 그 다음 GitHub 원격 저장소와 연결하고 첫 번째 커밋을 푸시합니다. 주의사항으로는 기본 브랜치를 'main'으로 설정하는 명령어와 라인 엔딩 처리 방법, 그리고 SID를 피하는 핵심적인 인증 단계를 간결하게 설명해야겠어요.
# Windows에서 처음 설치부터 첫 커밋 푸시까지 단계별 가이드

아래 단계는 “아무것도 설치되지 않은” 상태에서 시작해, 로컬 프로젝트의 첫 커밋을 GitHub 원격 저장소에 성공적으로 올리기까지 전 과정을 담았습니다.

---

## 준비 사항

- **Windows 버전:** Windows 10 이상
- **권한:** 설치 시 관리자 권한 권장
- **GitHub 계정:** 원격 저장소를 만들기 위해 필요

---

## Git for Windows 설치

1. **공식 페이지 접속 및 설치**
- Git for Windows 다운로드 페이지에서 설치 파일을 내려받아 실행하세요.
- [공식 다운로드](https://git-scm.com/downloads/win)에서 Git for Windows 설치
- 설치 시 권장 옵션:
  - PATH 등록: “Git from the command line…”
  - Line endings: Checkout as-is, commit Unix-style (또는 core.autocrlf=true)



2. **설치 옵션 권장값**
   - **Editor:** 기본값(예: Vim) 그대로 두거나 선호 에디터 선택
   - **PATH 설정:** “Git from the command line…” 선택
   - **HTTPS backend:** OpenSSL 권장
   - **Line endings:** Checkout as-is, commit Unix-style 혹은 “core.autocrlf = true”에 해당하는 옵션
   - **Git Credential Manager:** 설치 체크 유지 (HTTPS 푸시 시 브라우저 인증 연동 편리)

> 설치 후 “Git Bash”, “Git CMD”, “Git GUI”가 함께 제공됩니다. 일반적으로 Git Bash 사용을 권장합니다.

---

## Git 기본 설정

- **사용자 정보 설정 (커밋 작성자 표기)**
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "your.email@example.com"
  ```

- **줄바꿈(Line Ending) 권장 설정 (Windows)**
  ```bash
  git config --global core.autocrlf true
  ```
  - **의미:** 체크아웃 시 LF→CRLF, 커밋 시 CRLF→LF 자동 변환

- **기본 브랜치 이름을 main으로 사용하고 싶다면**
  ```bash
  git config --global init.defaultBranch main
  ```

> 설정 확인: `git config --list`

---

## 로컬 저장소 만들기 및 원격 연결

1. **프로젝트 폴더 생성 또는 이동**
   ```bash
   mkdir D:/WORKDATA/PG/HTML/qr-system-hosting
   cd /d/WORKDATA/PG/HTML/qr-system-hosting
   ```

2. **Git 저장소 초기화**
   ```bash
   git init
   ```
   - **결과:** 현재 폴더에 `.git` 폴더 생성

3. **프로젝트 파일 추가**
   - 파일을 생성하거나 복사해 넣습니다. 예: `README.md`, `web/`, `functions/` 등

4. **(선택) .gitattributes로 줄바꿈 강제 규칙 추가**
   ```gitattributes
   * text=auto
   ```
   - 저장소 루트에 `.gitattributes` 파일로 추가

5. **GitHub에서 원격 저장소 생성**
   - GitHub 웹에서 새 repo 생성 (예: `HWANG-YOUNGWOO/qr-system-hosting`)
   - HTTPS URL 복사: `https://github.com/<username>/<repo>.git`

6. **원격(origin) 연결**
   ```bash
   git remote add origin https://github.com/<username>/<repo>.git
   git remote -v
   ```

7. **브랜치 이름 정리 (main 권장)**
   ```bash
   git branch -M main
   ```
   - 기존이 `master`면 `main`으로 변경, 새 init.defaultBranch가 main이면 이미 main일 수 있습니다.

---

## 첫 커밋 만들기와 푸시

1. **변경사항 스테이징**
   ```bash
   git add -A
   ```

2. **커밋 생성**
   ```bash
   git commit -m "feat: initial project setup"
   ```
   - **주의:** 문서나 코드에 실제 비밀값(예: Twilio Account SID, Auth Token 등)을 절대 넣지 마세요.
     - 문서에는 `<YOUR_TWILIO_ACCOUNT_SID>` 또는 `ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` 같은 더미/플레이스홀더 사용

3. **원격 저장소로 푸시 (main)**
   ```bash
   git push -u origin main
   ```
   - **처음 HTTPS 푸시 시:** 브라우저가 열리며 GitHub 인증을 요구합니다. 로그인 및 권한 승인 후 자동 진행됩니다.
   - `-u`는 upstream 설정으로 이후 `git push`만으로 동일 브랜치에 푸시 가능하게 합니다.

> 기능 브랜치로 작업 중이면 `git push origin HEAD`로 현재 브랜치 이름 그대로 원격에 생성할 수 있습니다. 예: `HEAD -> fix/pr-screenshot-check`

---

## 자주 발생하는 문제와 해결

- **fatal: not a git repository**
  - **원인:** `.git`이 없는 폴더에서 명령 실행
  - **해결:** 프로젝트 폴더로 이동 후 `git init` 다시 수행

- **Author identity unknown (커밋 불가)**
  - **원인:** `user.name`, `user.email` 미설정
  - **해결:**
    ```bash
    git config --global user.name "Your Name"
    git config --global user.email "your.email@example.com"
    ```

- **error: src refspec HEAD does not match any**
  - **원인:** 아직 커밋이 없음
  - **해결:** 먼저 `git add`와 `git commit` 생성 후 다시 푸시

- **fatal: 'origin' does not appear to be a git repository**
  - **원인:** 원격이 설정되지 않음
  - **해결:** `git remote add origin <URL>`로 등록

- **GitHub Push Protection에 의한 차단(GH013)**
  - **원인:** 커밋 히스토리에 비밀값(예: Twilio SID) 포함
  - **해결:** 파일에서 값 제거 + 히스토리에서 완전 제거
    - 첫 커밋만 문제면:
      ```bash
      # 파일 수정 후
      git add README_SRS2.md
      git commit --amend --no-edit
      git push -u origin main --force
      ```
    - 여러 커밋에 걸쳤다면(Windows):
      1) `replacements.txt` 생성
         ```
         Account SID: `<YOUR_TWILIO_ACCOUNT_SID>`==<REDACTED>
         ```
      2) 필터 실행
         ```bash
         git filter-repo --path README_SRS2.md --replace-text replacements.txt
         git push -u origin main --force
         ```
      - 이후 GitHub에서 PR을 만들 때도 비밀값이 노출되지 않도록 환경변수/Secrets 사용

---

## 주의할 점
- **비밀값(Secret, API Key, SID 등)은 절대 커밋하지 말 것**
  - 문서에는 `<YOUR_TWILIO_ACCOUNT_SID>` 같은 플레이스홀더 사용
- 기본 브랜치 이름이 `main`인지 `master`인지 확인 후 푸시
- 에러 발생 시:
  - `not a git repository`: `git init` 안 함 → 다시 초기화
  - `Author identity unknown`: 사용자 정보 미설정 → `git config` 다시
  - `src refspec HEAD does not match any`: 아직 커밋 없음 → 커밋 먼저
  - `origin does not appear to be a git repository`: 원격 미등록 → `git remote add origin`

---