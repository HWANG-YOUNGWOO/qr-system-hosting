**구성 및 작성 계획**

먼저, Git과 GitHub CLI 설치, 설정, 인증, 구성부터 다루어야겠어요. SSH와 HTTPS 비교도 꼭 필요하고, 글로벌 설정, 리포지토리 생성, 브랜치 만들기, 푸시, PR 생성 등 기본적인 사용법도 포함해야 해요. PowerShell 관련 사항, 비밀 키 검사, 고립된 이슈, 레이블, 리뷰어, 병합 전략, CI 검사도 빼놓을 수 없죠. 모든 항목을 목록적으로 정리하면서, 제목을 두고 필요한 부분을 세분화하는 게 중요할 것 같아요.

# Windows에서 Git과 GitHub CLI 설치부터 PR 머지까지 전체 워크플로우 가이드

이 가이드는 Windows 환경에서 Git과 GitHub CLI(gh)를 설치하고, 저장소 초기화부터 브랜치 작업, Pull Request 생성, CI 확인, 병합까지 전체 과정을 상세히 다룹니다. 실제로 발생하기 쉬운 오류와 주의사항도 함께 포함했습니다.

---

## 설치 및 초기 설정

### Git 설치

- **다운로드:** 공식 사이트에서 최신 Git for Windows 설치 파일 다운로드
- **설치 옵션 권장:**
  - **Editor:** Visual Studio Code(추천) 또는 기본 Vim
  - **PATH:** “Git from the command line and also from 3rd-party software”
  - **HTTPS transport backend:** “Use the OpenSSL library”
  - **Line endings:** “Checkout Windows-style, commit Unix-style (recommended)”
  - **Default branch name:** main
- **설치 확인:**
  ```powershell
  git --version
  ```

### GitHub CLI(gh) 설치

- **다운로드:** GitHub CLI for Windows 설치
- **설치 확인:**
  ```powershell
  gh --version
  ```

### 전역 Git 설정

- **사용자 정보 등록:**
  ```powershell
  git config --global user.name "Your Name"
  git config --global user.email your-email@example.com
  ```
- **편집기 설정(선택):**
  ```powershell
  git config --global core.editor "code --wait"
  ```
- **자동 라인 엔딩 확인(권장):**
  ```powershell
  git config --global core.autocrlf true
  ```

### 인증 방식 선택: HTTPS vs SSH

- **HTTPS(간단, 보편적):**
  - **GitHub 로그인:**  
    ```powershell
    gh auth login
    ```
    - Github.com 선택 → 프로토콜 HTTPS → 로그인(Browser) → 권한 승인
  - **자격 증명 저장:** Windows의 Credential Manager가 저장소별 토큰을 관리합니다.
- **SSH(보안, 팀 협업 추천):**
  - **키 생성:**
    ```powershell
    ssh-keygen -t ed25519 -C "your-email@example.com"
    ```
  - **공개키 등록:** GitHub → Settings → SSH and GPG keys → New SSH key → `~/.ssh/id_ed25519.pub` 내용 붙여넣기
  - **연결 테스트:**
    ```powershell
    ssh -T git@github.com
    ```

> 주의: 회사 네트워크/프록시 환경에서는 HTTPS가 더 안정적일 수 있습니다. SSH는 방화벽에서 막히는 경우가 있습니다.

---

## 저장소 준비와 브랜치 전략

### 기존 저장소 클론 또는 새 저장소 생성

- **클론(HTTPS 예시):**
  ```powershell
  git clone https://github.com/<USER>/<REPO>.git
  cd <REPO>
  ```
- **클론(SSH 예시):**
  ```powershell
  git clone git@github.com:<USER>/<REPO>.git
  cd <REPO>
  ```
- **새 저장소 초기화(로컬 → 원격):**
  ```powershell
  git init
  git add .
  git commit -m "chore: initial commit"
  gh repo create <REPO> --public --source . --remote origin --push
  ```

### 브랜치 생성과 기준 브랜치 설정

- **현재 브랜치 확인:**
  ```powershell
  git branch
  ```
- **작업 브랜치 생성:**
  ```powershell
  git checkout -b fix/pr-screenshot-check
  ```
- **원격에 브랜치 푸시 및 추적 설정:**
  ```powershell
  git push -u origin fix/pr-screenshot-check
  ```

> 주의: 기준 브랜치(main)는 작업 브랜치의 “부모”여야 합니다. main을 생성할 때 `--orphan`을 사용하면 기존 브랜치와 공통 히스토리가 없어 PR이 불가능해질 수 있습니다.

---

## 변경 작업, 커밋, 푸시

### 일반 작업 흐름

1. **변경 반영:**
   ```powershell
   git add .
   ```
2. **커밋:**
   ```powershell
   git commit -m "fix: apply code changes for screenshot-check workflow"
   ```
3. **푸시:**
   ```powershell
   git push
   ```

### PowerShell 입력 팁

- **여러 줄 명령:** 백틱 `` ` ``로 줄바꿈합니다.
- **따옴표:** 본문이나 라벨에 공백이 있으면 `"..."`로 감싸세요.

> 주의: Git Bash에서는 `\`가 줄바꿈 역할을 하지만 PowerShell에서는 아닙니다. PowerShell에서는 백틱을 사용하거나 한 줄로 입력하세요.

### 비밀값(Secrets) 주의

- **푸시 보호로 차단될 수 있는 항목:** API 키, 토큰, Twilio SID 등
- **해결:** 비밀값을 제거/마스킹 후 커밋 수정
  ```powershell
  git add <file>
  git commit --amend --no-edit
  git push -f
  ```
> 주의: 이미 원격에 올라간 비밀은 폐기하고 새 키를 발급하세요.

---

## PR 생성과 히스토리 문제 해결

### PR 생성

- **현재 브랜치가 작업 브랜치일 때(권장):**
  ```powershell
  gh pr create --title "Add PR screenshot-check workflow" --body "Promote clean screenshot-check workflow and script. Test for comment/update behavior." --base main --head fix/pr-screenshot-check
  ```
- **상태 확인:**
  ```powershell
  gh pr status
  ```

### “No commits between …” 오류 해결

- **원인:** 기준(main)과 작업 브랜치가 동일하거나, 공통 히스토리가 없음
- **동일 커밋 문제:** 작업 브랜치에 최소 1개 커밋 추가
  ```powershell
  echo "test change" >> README.md
  git add README.md
  git commit -m "docs: test change for PR"
  git push
  ```
- **공통 히스토리 없음(오픈한 main을 orphan으로 만든 경우):** 작업 브랜치 기반으로 main 재생성
  ```powershell
  git branch -D main
  git push origin --delete main
  git checkout fix/pr-screenshot-check
  git checkout -b main
  git push -u origin main
  ```
- **대안(히스토리 유지가 꼭 필요):** 패치로 변경을 강제 적용
  ```powershell
  git checkout fix/pr-screenshot-check
  git format-patch main --stdout > changes.patch
  git checkout main
  git apply changes.patch
  git commit -am "Apply changes from fix/pr-screenshot-check"
  git push
  ```

> 주의: orphan main을 생성하면 기존 브랜치와 공통 조상이 없어 PR이 차단됩니다. 가급적 main을 먼저 만들고 그 위에서 작업 브랜치를 파생하세요.

---

## PR 편집, 리뷰, 병합, CI 체크

### PR 편집

- **Assignee 추가:**
  ```powershell
  gh pr edit 1 --add-assignee <your-github-username>
  ```
- **리뷰어 추가:**
  ```powershell
  gh pr edit 1 --add-reviewer <reviewer-username>
  ```
- **라벨 추가(라벨이 미리 정의되어 있어야 함):**
  ```powershell
  gh pr edit 1 --add-label "<existing-label>"
  ```

> 주의: 존재하지 않는 라벨은 추가할 수 없습니다. GitHub 웹에서 먼저 라벨을 생성하세요.

### CI 체크 확인

- **PR 상태:**
  ```powershell
  gh pr status
  ```
- **상세 체크 확인(웹 권장):** PR 페이지의 Checks 탭에서 실패 원인을 확인하고 수정 후 재푸시

> 주의: 저장소 정책에 따라 체크 실패 시 병합이 차단될 수 있습니다. 병합 버튼이 비활성화되면 체크를 통과하거나 관리자 권한이 필요합니다.

### 병합

- **일반 병합(commit history 유지):**
  ```powershell
  gh pr merge 1 --merge
  ```
- **Squash 병합(커밋 압축):**
  ```powershell
  gh pr merge 1 --squash
  ```
- **Rebase 병합(선형 히스토리):**
  ```powershell
  gh pr merge 1 --rebase
  ```

> 주의: 병합 전략은 팀 규칙에 맞추세요. Squash는 기능 단위로 커밋을 깨끗하게 유지할 때 유용합니다.

---

## 문제 해결 체크리스트

- **브랜치 혼선:**  
  - 현재 브랜치가 맞는지 `git branch`로 확인  
  - PR 생성 시 `--head`와 `--base`를 명시
- **PR 불가(커밋 차이 없음):**  
  - 작업 브랜치에 새 커밋 추가
- **PR 불가(공통 히스토리 없음):**  
  - orphan main 제거 후 작업 브랜치에서 main 재생성
- **푸시 차단(비밀 누출):**  
  - 비밀값 제거 → `git commit --amend` → `git push -f`  
  - 누출된 키 폐기 및 재발급
- **PowerShell 명령 오류:**  
  - 여러 줄은 백틱 `` ` `` 사용 또는 한 줄로 입력  
  - 인수에 공백이 있으면 따옴표 사용

---

## 마무리 및 권장 워크플로우 요약

1. **git/gh 설치 및 인증 완료**
2. **main 기준 브랜치 준비(정상 히스토리)**
3. **작업 브랜치 생성 및 변경 커밋**
4. **원격 푸시(`-u`로 추적 설정)**
5. **PR 생성(`--base main --head <branch>`)**
6. **CI 체크 확인 및 수정**
7. **리뷰/라벨/Assignee 관리**
8. **적합한 전략으로 병합**