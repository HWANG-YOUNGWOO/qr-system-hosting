## Pull Request Checklist

Please fill out this checklist before requesting review.

- [ ] I have added a clear description of the change and why it's needed.
- [ ] I have run lint and build locally for `functions` and `web`.
- [ ] I have added/updated tests where applicable.

### Secrets & Security
- [ ] I did NOT commit any secrets, tokens, or service account JSON to the repo.
- [ ] If new secrets are required, I updated `README_SECRETS.md` and added corresponding GitHub Secrets.

### Screenshots / Visuals (required for UI or docs changes)
- [ ] I added screenshots to `.github/assets/` for any UI or docs changes that require visual review.
  - Required filenames (if applicable):
    - `.github/assets/gcp-service-accounts.png`
    - `.github/assets/gcp-create-service-account.png`
    - `.github/assets/github-new-secret.png`
    - `.github/assets/gcp-secret-create.png`
- [ ] I blurred/redacted any sensitive data in screenshots.

### Testing / QA
- [ ] I tested the end-to-end flow locally (emulator) if backend or auth changes were made.
- [ ] For production-impacting changes, I documented testing steps in the PR description.

Thank you — a reviewer will be assigned shortly.
