**경고와 해결책**

경고 사항과 해결 방법을 포함시켜야겠어요. 만약 main과 fix 브랜치가 동일한 커밋을 가질 경우 대체 경로를 제시해야죠. 예를 들어, 새로운 커밋을 만들어서 차이를 만들도록 말이죠. 이 방식으로 진행하면 되겠네요.

# Windows에서 GitHub CLI로 브랜치 푸시부터 PR 머지까지 전체 워크플로우

아래 단계는 실제로 겪었던 이슈들까지 포함해, 시작부터 마지막 병합까지 깔끔하게 재현할 수 있도록 정리한 가이드입니다.

---

## 준비 사항

- **필수:** Git for Windows와 GitHub CLI(gh) 설치
- **권장:** PowerShell 사용, GitHub 로그인 완료
  ```powershell
  gh auth login
  ```

---

## 브랜치 상태 확인과 기본 푸시

1. **현재 브랜치 확인**
   - 명령:
     ```bash
     git branch
     ```
   - 기대 결과: 작업 브랜치에 `* fix/pr-screenshot-check` 등으로 표시

2. **원격 브랜치 푸시 및 추적 설정**
   - 명령:
     ```bash
     git push -u origin fix/pr-screenshot-check
     ```
   - 설명: 최초 푸시 시 upstream 설정되어 이후 `git push`만으로 동기화 가능

3. **PowerShell 줄바꿈 주의 (중요)**
   - **Tip:** PowerShell에서는 역슬래시 `\`가 줄바꿈 연산자가 아닙니다. 여러 줄로 쓰려면 백틱 `` ` ``를 사용하거나 한 줄로 입력하세요.
   - 예시(한 줄):
     ```powershell
     gh pr create --title "Add PR screenshot-check workflow" --body "..." --base main
     ```
   - 예시(여러 줄, 백틱 사용):
     ```powershell
     gh pr create `
       --title "Add PR screenshot-check workflow" `
       --body "..." `
       --base main
     ```

---

## 푸시 보호(Secret Scanning) 차단 이슈 해결

1. **차단 원인 확인**
   - **설명:** 푸시 보호가 Twilio SID 등 비밀로 인식되는 문자열을 감지하면 푸시를 거부합니다.

2. **민감 값 제거 및 커밋 수정**
   - 명령:
     ```bash
     # 파일에서 민감 값 제거 후
     git add README_GIT.md
     git commit --amend --no-edit
     git push -f
     ```
   - **주의:** `--amend`는 마지막 커밋을 덮어써 히스토리에서 민감 값을 제거합니다.

3. **여러 커밋에 걸친 경우(선택)**
   - **Tip:** 히스토리 전체에서 제거하려면 `git filter-repo` 같은 도구를 사용하세요. 이 가이드는 최근 커밋 수정 기준입니다.

---

## 기준 브랜치(main) 생성과 히스토리 정렬

1. **원격에 기준 브랜치가 없는 경우 main 생성**
   - 명령:
     ```bash
     git checkout --orphan main
     git commit --allow-empty -m "chore: initialize main branch"
     git push -u origin main
     ```
   - **설명:** orphan은 공통 조상 없이 새 히스토리를 만듭니다.

2. **PR 실패: 공통 히스토리 없음 해결**
   - **원인:** orphan으로 만든 main은 기존 작업 브랜치와 공통 조상이 없어 PR 생성이 차단됩니다.
   - **권장 해결(간단):** 작업 브랜치를 기반으로 main 재생성
     ```bash
     # 기존 orphan main 제거
     git branch -D main
     git push origin --delete main

     # 작업 브랜치에서 main 재생성
     git checkout fix/pr-screenshot-check
     git checkout -b main
     git push -u origin main
     ```
   - **대안(히스토리 유지 필요 시):** 패치 방식으로 차이를 강제 적용
     ```bash
     git checkout fix/pr-screenshot-check
     git format-patch main --stdout > changes.patch

     git checkout main
     git apply changes.patch
     git commit -am "Apply changes from fix/pr-screenshot-check"
     git push
     ```

3. **브랜치가 동일해 PR 불가한 경우 차이 만들기**
   - 명령:
     ```bash
     git checkout fix/pr-screenshot-check
     echo "test change" >> README.md
     git add README.md
     git commit -m "docs: test change for PR"
     git push
     ```
   - **설명:** 기준(main)과 작업 브랜치 간에 최소 1개 커밋 차이가 있어야 PR 생성 가능

---

## PR 생성, 점검, 편집, 병합

1. **PR 생성**
   - 명령(현재 브랜치가 작업 브랜치일 때):
     ```powershell
     gh pr create --title "Add PR screenshot-check workflow" --body "Promote clean screenshot-check workflow and script. Test for comment/update behavior." --base main --head fix/pr-screenshot-check
     ```
   - **설명:** `--base`는 대상 브랜치, `--head`는 작업 브랜치(명시하면 브랜치 혼선 방지)

2. **PR 상태 확인**
   - 명령:
     ```bash
     gh pr status
     ```
   - **설명:** 체크 실패 개수, 연결된 PR 여부 확인

3. **PR 편집(선택)**
   - **Assignee 추가:**
     ```bash
     gh pr edit 1 --add-assignee <your-github-username>
     ```
   - **라벨 추가(라벨이 미리 정의되어 있어야 함):**
     ```bash
     gh pr edit 1 --add-label "<existing-label>"
     ```

4. **병합**
   - 명령(일반 병합):
     ```bash
     gh pr merge 1 --merge
     ```
   - **대안 병합 전략:**
     ```bash
     gh pr merge 1 --squash
     gh pr merge 1 --rebase
     ```

---

## 참고 팁

- **현재 브랜치 확인:** 항상 PR 전 `git branch`로 `*` 표시 브랜치 확인
- **커밋 누락 방지:** PR 생성 실패 시 대부분 “커밋 차이 없음” 또는 “기준 브랜치 오지정” 문제
- **PowerShell 안전 입력:** 여러 줄 명령은 백틱 `` ` `` 사용, 또는 한 줄로 입력
- **체크 실패 대응:** CI가 실패해도 정책상 머지가 가능할 수 있으나, 원인 파악 후 수정 권장

---

## Windows: 자동화 스크립트 사용 예시 (PowerShell)

저장소 루트에서 제공되는 PowerShell 헬퍼 스크립트를 사용하면 브랜치 푸시 → PR 생성 → 선택적 병합을 안전하게 자동화할 수 있습니다.

1. 스크립트 위치: `.github\scripts\gh-push-pr.ps1`

2. 간단 사용 예시:

```powershell
# 브랜치 푸시 및 PR 생성 (병합은 하지 않음)
. .\.github\scripts\gh-push-pr.ps1 -Title "Add PR screenshot-check workflow" -Body "프로세스 설명을 여기에" -Base main

# 브랜치 푸시 및 PR 생성 후 자동 머지(스쿼시) 및 브랜치 삭제
. .\.github\scripts\gh-push-pr.ps1 -Title "Small fix" -Body "작업 설명" -Base main -Merge

# 강제 푸시를 사용하려면 -ForcePush 스위치 추가
. .\.github\scripts\gh-push-pr.ps1 -Title "Force push test" -Body "..." -ForcePush
```

3. 준비사항

- Git과 GitHub CLI(gh) 설치 및 로그인 필요: `gh auth login`
- PowerShell의 실행정책 때문에 스크립트 차단 시 임시로 허용:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

이 스크립트는 일반적인 Windows 워크플로우를 단순화하기 위한 도구입니다. 원하시면 `--squash` 대신 `--rebase`나 `--merge` 전략을 선택하는 옵션을 추가해 드리겠습니다.
