// This script runs inside actions/github-script context where
// `github`, `context`, and `core` are available.

// 검사 대상 예시 이미지 목록
const required = [
  '.github/assets/gcp-service-accounts.png',
  '.github/assets/gcp-create-service-account.png',
  '.github/assets/github-new-secret.png',
  '.github/assets/gcp-secret-create.png'
];

async function run() {
  const pr = context.payload.pull_request;
  if (!pr) {
    core.info('pull_request payload 없음 — 스킵');
    return;
  }

  const prNumber = pr.number;
  core.info('PR #' + prNumber + ' — 스크린샷 검사 시작');

  const body = pr.body || '';
  const foundInBody = required.filter(fn => body.indexOf(fn) !== -1);

  const files = await github.paginate(github.rest.pulls.listFiles, { owner: context.repo.owner, repo: context.repo.repo, pull_number: prNumber, per_page: 200 });
  const changed = files.map(f => f.filename || '');
  const foundInFiles = required.filter(fn => changed.indexOf(fn) !== -1);

  core.info('본문에서 발견: ' + JSON.stringify(foundInBody));
  core.info('변경 파일에서 발견: ' + JSON.stringify(foundInFiles));

  if (foundInBody.length === 0 && foundInFiles.length === 0) {
    const checklist = ['- [ ] 스크린샷을 .github/assets/에 추가', '- [ ] 민감 정보는 블러/가림 처리', '- [ ] PR 설명에 이미지 링크 추가'].join('\n');
    const howto = '예: ![서비스 계정](.github/assets/gcp-service-accounts.png)';
    const examples = required.map(r => '- ' + r).join('\n');

    const prTemplateLines = [
      '## 변경 내용 요약',
      '',
      '- 무엇을 변경했나요?',
      '- 왜 변경했나요?',
      '',
      '## 확인 방법',
      '',
      '- 로컬에서 확인하는 방법 (예: Firebase emulator 실행, 브랜치에서 빌드 등)',
      '',
      '## 추가 참고 (선택 사항)'
    ].join('\n');

    const commentBody = [
      ':warning: **스크린샷이 없습니다**',
      '',
      '리뷰가 원활히 진행되도록 아래 체크리스트를 따라주시면 감사하겠습니다.',
      '',
      '**간단 체크리스트**',
      checklist,
      '',
      '**이미지 추가 방법**',
      howto,
      '',
      '**예시 파일 (.github/assets/)**',
      examples,
      '',
      '---',
      '아래는 PR 설명에 복사하여 붙여넣을 수 있는 간단한 템플릿입니다. 필요에 맞게 수정하세요.',
      '',
      prTemplateLines,
      '',
      '---',
      '자동 알림: PR 스크린샷 검사봇'
    ].join('\n');

    const comments = await github.rest.issues.listComments({ owner: context.repo.owner, repo: context.repo.repo, issue_number: prNumber, per_page: 200 });
    const botMarker = '자동 알림: PR 스크린샷 검사봇';
    const existing = comments.data.find(c => c.user && c.user.type === 'Bot' && c.body && c.body.indexOf(botMarker) !== -1);

    if (existing) {
      await github.rest.issues.updateComment({ owner: context.repo.owner, repo: context.repo.repo, comment_id: existing.id, body: commentBody });
      core.info('기존 봇 코멘트를 업데이트했습니다.');
    } else {
      await github.rest.issues.createComment({ owner: context.repo.owner, repo: context.repo.repo, issue_number: prNumber, body: commentBody });
      core.info('새로운 봇 코멘트를 생성했습니다.');
    }

    throw new Error('스크린샷이 PR에 없습니다. 코멘트를 확인하세요.');
  }
}

run().catch(err => { core.setFailed(err.message || String(err)); });
// This script runs inside actions/github-script context where
// `github`, `context`, and `core` are available.

// 검사 대상 예시 이미지 목록
const required = [
  '.github/assets/gcp-service-accounts.png',
  '.github/assets/gcp-create-service-account.png',
  '.github/assets/github-new-secret.png',
  '.github/assets/gcp-secret-create.png'
];

async function run() {
  const pr = context.payload.pull_request;
  if (!pr) {
    core.info('pull_request payload 없음 — 스킵');
    return;
  }

  const prNumber = pr.number;
  core.info('PR #' + prNumber + ' — 스크린샷 검사 시작');

  const body = pr.body || '';
  const foundInBody = required.filter(fn => body.indexOf(fn) !== -1);

  const files = await github.paginate(github.rest.pulls.listFiles, { owner: context.repo.owner, repo: context.repo.repo, pull_number: prNumber, per_page: 200 });
  const changed = files.map(f => f.filename || '');
  const foundInFiles = required.filter(fn => changed.indexOf(fn) !== -1);

  core.info('본문에서 발견: ' + JSON.stringify(foundInBody));
  core.info('변경 파일에서 발견: ' + JSON.stringify(foundInFiles));

  if (foundInBody.length === 0 && foundInFiles.length === 0) {
    const checklist = ['- [ ] 스크린샷을 .github/assets/에 추가', '- [ ] 민감 정보는 블러/가림 처리', '- [ ] PR 설명에 이미지 링크 추가'].join('\n');
    const howto = '예: ![서비스 계정](.github/assets/gcp-service-accounts.png)';
    const examples = required.map(r => '- ' + r).join('\n');

    const prTemplateLines = [
      '## 변경 내용 요약',
      '',
      '- 무엇을 변경했나요?',
      '- 왜 변경했나요?',
      '',
      '## 확인 방법',
      '',
      '- 로컬에서 확인하는 방법 (예: Firebase emulator 실행, 브랜치에서 빌드 등)',
      '',
      '## 추가 참고 (선택 사항)'
    ].join('\n');

    const commentBody = [
      ':warning: **스크린샷이 없습니다**',
      '',
      '리뷰가 원활히 진행되도록 아래 체크리스트를 따라주시면 감사하겠습니다.',
      '',
      '**간단 체크리스트**',
      checklist,
      '',
      '**이미지 추가 방법**',
      howto,
      '',
      '**예시 파일 (.github/assets/)**',
      examples,
      '',
      '---',
      '아래는 PR 설명에 복사하여 붙여넣을 수 있는 간단한 템플릿입니다. 필요에 맞게 수정하세요.',
      '',
      prTemplateLines,
      '',
      '---',
      '자동 알림: PR 스크린샷 검사봇'
    ].join('\n');

    const comments = await github.rest.issues.listComments({ owner: context.repo.owner, repo: context.repo.repo, issue_number: prNumber, per_page: 200 });
    const botMarker = '자동 알림: PR 스크린샷 검사봇';
    const existing = comments.data.find(c => c.user && c.user.type === 'Bot' && c.body && c.body.indexOf(botMarker) !== -1);

    if (existing) {
      await github.rest.issues.updateComment({ owner: context.repo.owner, repo: context.repo.repo, comment_id: existing.id, body: commentBody });
      core.info('기존 봇 코멘트를 업데이트했습니다.');
    } else {
      await github.rest.issues.createComment({ owner: context.repo.owner, repo: context.repo.repo, issue_number: prNumber, body: commentBody });
      core.info('새로운 봇 코멘트를 생성했습니다.');
    }

    throw new Error('스크린샷이 PR에 없습니다. 코멘트를 확인하세요.');
  }
}

run().catch(err => { core.setFailed(err.message || String(err)); });
