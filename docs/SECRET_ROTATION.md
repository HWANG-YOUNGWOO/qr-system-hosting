# Secret rotation & history scrub guide

This document explains emergency steps when secrets are accidentally committed to the repository.

Important: If any secret (API key, token, password) has been published in a public repo or pushed to a remote, assume it is compromised — rotate it immediately.

1) Rotate the leaked secret(s)
- For Twilio: go to Twilio Console → Project Settings / API Keys and revoke/regenerate credentials.
- For Google Service Accounts: revoke the service account key and create a new key; update `FIREBASE_SERVICE_ACCOUNT` secret in GitHub.

2) Remove secrets from repository files (already done in README_SRS2.md)
- Replace secrets in files with placeholders like `<REDACTED>` and commit the changes.

3) Remove secret from git history (rewrite history)
- If repository is small and you are the only contributor, the easiest is to use `git filter-repo` or the BFG Repo-Cleaner. Example with `git filter-repo`:

```powershell
# Install git-filter-repo (Python)
pip install git-filter-repo

# Make a backup clone
git clone --mirror https://github.com/<owner>/<repo>.git repo-mirror.git
cd repo-mirror.git

# Replace the secret string across history
git filter-repo --replace-text ../replacements.txt
# where replacements.txt contains lines like:
# OLD_SECRET==>REPLACEMENT_TEXT

# Push the cleaned mirror (force)
git push --force
```

- BFG Repo-Cleaner is an alternative with similar behavior (Java required).

4) Invalidate cached clones and notify collaborators
- After rewriting history you must force-push and inform all collaborators to reclone the repository.

5) Update CI/CD secrets
- Update GitHub Actions secrets (Settings → Secrets → Actions) with the newly rotated secrets.

6) Optional: scan repository for other secrets
- Use the included `.github/scripts/find-secrets.ps1` to scan for common patterns (API keys, tokens). This is a heuristic tool — review matches manually.

7) Monitor and audit
- Watch the services for unusual activity
- Check billing usage (Twilio) and Cloud logs

If you'd like, I can prepare the `replacements.txt` for the exact strings found and show commands to run `git filter-repo` safely. If the repo is hosted publicly, rotate immediately before attempting history rewrite.
