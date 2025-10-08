# GitHub CLI를 활용한 브랜치 작업과 Pull Request(PR) 생성·머지 전체 과정 정리

이 문서는 **Windows 환경에서 Git과 GitHub CLI(gh)를 사용하여 브랜치 생성 → 커밋/푸시 → PR 생성 → CI 확인 → 머지**까지의 과정을 **배경(왜/무엇)**과 **주의사항**을 포함해 단계별로 정리한 가이드입니다.

---

## 1. 배경과 목적

- **왜 이 과정을 하는가?**
  - 협업 개발에서는 기능별로 브랜치를 나누어 작업 후, `main` 브랜치로 병합하기 전에 **Pull Request(PR)**를 통해 코드 리뷰와 CI(자동 테스트)를 거칩니다.
  - GitHub CLI(`gh`)를 사용하면 브라우저를 열지 않고도 터미널에서 PR 생성, 상태 확인, 리뷰 요청, 병합까지 처리할 수 있습니다.

- **무엇을 달성하는가?**
  - 로컬에서 작업한 변경 사항을 원격 저장소에 안전하게 반영
  - PR을 통해 코드 품질 검증 및 협업 프로세스 준수
  - CI 체크와 리뷰 과정을 거쳐 안정적으로 `main`에 병합

---

## 2. 사전 준비

### Git 설치 및 확인
```powershell
git --version
```
- 정상 출력 예: `git version 2.51.0.windows.2`

### GitHub CLI 설치 및 로그인
```powershell
gh --version
gh auth login
```
- HTTPS 또는 SSH 방식으로 인증 가능

### 환경 변수 설정
- Git이 인식되지 않는 경우, **환경 변수 PATH**에 Git 설치 경로 추가 필요
  - 개인 PC → 사용자 변수(User variables)
  - 공용/여러 계정 PC → 시스템 변수(System variables)
- 일반 경로:
  ```
  C:\Program Files\Git\cmd
  C:\Program Files\Git\bin
  ```

---

## 3. 브랜치 작업

### 현재 브랜치 확인
```powershell
git branch --show-current
```
- 출력 예: `fix/pr-screenshot-check`

### 변경 사항 확인
```powershell
git status --porcelain
```
- `M` = 수정됨, `??` = 추적되지 않는 파일

### 변경 사항 스테이징
```powershell
git add .github/workflows/pr-image-check.yml .github/workflows/pr-image-check-kr.yml .github/scripts/pr-image-check.clean.js
```
- 필요한 파일만 선택적으로 스테이징하는 것이 바람직

### 커밋
```powershell
git commit -m "Fix PR screenshot check: run Node script and use @actions/* for stable comment/update behavior"
```

### 푸시
```powershell
git push origin HEAD
```
- 현재 브랜치를 원격에 푸시
- 최초 푸시라면:
  ```powershell
  git push -u origin <현재브랜치명>
  ```

---

## 4. 기준 브랜치(main) 동기화

### 원격 main과 로컬 main 불일치 시
```powershell
git checkout main
git pull origin main
```
- Fast-forward로 최신 상태 동기화
- 충돌 발생 시 수동 해결 후 커밋 필요

---

## 5. Pull Request 생성

### 작업 브랜치로 이동
```powershell
git checkout fix/pr-screenshot-check
```

### PR 생성
```powershell
gh pr create --title "Fix PR screenshot check workflow" --body "Update workflow and script for stable comment/update behavior." --base main --head fix/pr-screenshot-check
```

- `--base main` : 병합 대상 브랜치
- `--head fix/pr-screenshot-check` : 작업 브랜치

### PR 상태 확인
```powershell
gh pr status
```
- Checks pending / failing / passing 상태 확인 가능

---

## 6. CI 체크와 리뷰

- **왜 필요한가?**
  - 자동화된 테스트와 린트 검사로 코드 품질 보장
  - 리뷰어가 코드 변경을 검토해 버그나 보안 문제 예방

- **체크 실패 시**
  - 로그 확인 → 코드 수정 → 다시 커밋/푸시
  - PR은 자동으로 업데이트됨

- **리뷰어/라벨 추가**
  ```powershell
  gh pr edit 2 --add-reviewer <username>
  gh pr edit 2 --add-label "<label-name>"
  ```
  > 주의: 라벨은 저장소에 미리 정의되어 있어야 함

---

## 7. PR 병합

### 병합 명령
```powershell
gh pr merge 2 --merge
```

### 다른 병합 전략
- Squash (커밋 압축)
  ```powershell
  gh pr merge 2 --squash
  ```
- Rebase (선형 히스토리 유지)
  ```powershell
  gh pr merge 2 --rebase
  ```

> 팀 규칙에 맞는 병합 전략을 선택하세요.

---

## 8. 주의사항 요약

- **브랜치 혼선 방지:** 항상 `git branch --show-current`로 현재 브랜치 확인
- **PR 생성 실패 원인:**
  - `No commits between …` → 브랜치 간 차이 없음 → 새 커밋 필요
  - `no history in common` → orphan 브랜치 문제 → main 재생성 필요
- **비밀값 푸시 차단:** API 키, 토큰 등은 커밋하지 말고 GitHub Secrets 사용
- **PowerShell 입력:** 여러 줄은 백틱(`) 사용, 인수에 공백 있으면 따옴표로 감싸기

---

## ✅ 전체 흐름 요약

1. Git/gh 설치 및 로그인  
2. main 최신화 (`git pull origin main`)  
3. 작업 브랜치 생성 및 변경 커밋  
4. 원격 푸시 (`git push origin HEAD`)  
5. PR 생성 (`gh pr create …`)  
6. CI 체크 및 리뷰 → 필요 시 수정 후 재푸시  
7. 병합 (`gh pr merge …`)  

---

👉 이 과정을 따르면 **“왜 PR이 필요한지”**와 **“어떻게 안전하게 main에 반영하는지”**를 이해하면서, 실무에서 바로 활용 가능한 GitHub CLI 기반 워크플로우를 완주할 수 있습니다.