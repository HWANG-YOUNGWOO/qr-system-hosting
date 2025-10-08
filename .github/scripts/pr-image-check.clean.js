// Node script for GitHub Actions - uses @actions/core and @actions/github
const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');

const required = [
  '.github/assets/gcp-service-accounts.png',
  '.github/assets/gcp-create-service-account.png',
  '.github/assets/github-new-secret.png',
  '.github/assets/gcp-secret-create.png'
];

async function run() {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return core.info('No GITHUB_TOKEN available, skipping.');

    const octokit = github.getOctokit(token);
    const context = github.context;
    const pr = context.payload.pull_request;
    if (!pr) return core.info('No pull_request payload, skipping');
    const prNumber = pr.number;

    const body = pr.body || '';
    const foundInBody = required.filter(fn => body.includes(fn));

    const files = await octokit.paginate(octokit.rest.pulls.listFiles, { owner: context.repo.owner, repo: context.repo.repo, pull_number: prNumber, per_page: 100 });
    const changed = files.map(f => f.filename || '');
    const foundInFiles = required.filter(fn => changed.includes(fn));

    if (foundInBody.length === 0 && foundInFiles.length === 0) {
      const checklist = ['- [ ] Add screenshots to `.github/assets/`', '- [ ] Redact/blur sensitive data', '- [ ] Link images in PR description'].join('\n');
      const howto = 'You can add images by committing them to the branch under .github/assets/ or by inserting markdown image links in the PR description.';
      const examples = required.map(r => '- `' + r + '`').join('\n');

      const commentBody = [
        ':warning: **Screenshots missing**',
        '',
        'Quick checklist:',
        checklist,
        '',
        howto,
        '',
        '**Examples**',
        examples,
        '',
        '---',
        'PR Screenshot Check - automated reminder'
      ].join('\n');

      const comments = await octokit.rest.issues.listComments({ owner: context.repo.owner, repo: context.repo.repo, issue_number: prNumber, per_page: 100 });
      const botSignature = 'PR Screenshot Check - automated reminder';
      const existing = comments.data.find(c => c.user && c.user.type === 'Bot' && c.body && c.body.includes(botSignature));

      if (existing) {
        await octokit.rest.issues.updateComment({ owner: context.repo.owner, repo: context.repo.repo, comment_id: existing.id, body: commentBody });
        core.info('Updated existing bot comment.');
      } else {
        await octokit.rest.issues.createComment({ owner: context.repo.owner, repo: context.repo.repo, issue_number: prNumber, body: commentBody });
        core.info('Created new bot comment.');
      }

      core.setFailed('Required screenshots missing from PR (see comment)');
    } else {
      core.info('Required screenshots found in PR.');
    }
  } catch (err) {
    core.setFailed(err.message || String(err));
  }
}

run();
