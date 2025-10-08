# Quick Secrets Setup (for README)

Add this short guide to your repository README to help contributors set up required secrets quickly.

## Step-by-step (hand-hold)

### A. Create a service account (GCP Console)
1. Open https://console.cloud.google.com/ and select your project.
2. Go to `IAM & Admin` → `Service accounts` → `CREATE SERVICE ACCOUNT`.
3. Fill `Service account name` (e.g. `qr-system-deployer`) and `Description`, then `Create`.
4. Assign roles (minimum):
	 - `Cloud Functions Admin`
	 - `Firebase Hosting Admin`
	 - `Secret Manager Secret Accessor`
	 Click `Continue` and `Done`.
5. On the service account row, open `⋮` → `Manage keys` → `Add Key` → `Create new key` → `JSON` → `Create`.
6. A JSON file will download (keep it safe). This is the content you will paste into GitHub Secrets.

Suggested screenshots to capture (place files in `.github/assets/` and reference here):

![GCP Service Accounts list](.github/assets/gcp-service-accounts.png)
_Capture the Service accounts page showing your newly created account._

![Create service account dialog](.github/assets/gcp-create-service-account.png)
_Capture the create dialog with roles selected._

### B. Add secrets to GitHub
1. Open your GitHub repo → `Settings` → `Secrets and variables` → `Actions` → `New repository secret`.
2. Create these secrets:
	 - `FIREBASE_SERVICE_ACCOUNT`: open the downloaded JSON file and paste the entire contents.
	 - `FIREBASE_TOKEN` (optional): run `firebase login:ci` locally and paste the token.
	 - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` or `TWILIO_VERIFY_SID`: paste Twilio credentials.

Suggested screenshots:

![GitHub new secret](.github/assets/github-new-secret.png)
_Show adding a new repository secret._

### C. Verify secret format (quick local check)
On your machine, verify the service account JSON is valid JSON before pasting it to GitHub:

```powershell
python -c "import json,sys; json.load(open('service-account.json')); print('ok')"
```

If you don't have Python, use an online JSON validator (avoid uploading secrets to unknown sites).

### D. Optional: Generate FIREBASE_TOKEN locally

```powershell
npm i -g firebase-tools
firebase login:ci
# Follow the web flow and copy the token output
```

### E. Secret Manager: store Twilio credentials (recommended)
1. GCP Console → `Secret Manager` → `Create Secret`.
2. Name: `TWILIO_ACCOUNT_SID` (and create another for `TWILIO_AUTH_TOKEN`).
3. Paste the secret value and create.
4. Grant the `qr-system-deployer` service account the `Secret Manager Secret Accessor` role on those secrets.

Suggested screenshot:

![GCP Secret Manager create secret](.github/assets/gcp-secret-create.png)
_Show the create secret dialog._

### F. Minimal validation in GitHub Actions (optional step in workflow)
You can add an early workflow step to check that `FIREBASE_SERVICE_ACCOUNT` is valid JSON:

```yaml
- name: Validate service account JSON
	run: |
		echo "$FIREBASE_SERVICE_ACCOUNT" > $HOME/fsa.json
		if ! jq -e . $HOME/fsa.json >/dev/null 2>&1; then
			echo "FIREBASE_SERVICE_ACCOUNT is not valid JSON"; exit 1;
		fi
	env:
		FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
```

Note: `jq` is available on ubuntu runners; on Windows runners use PowerShell's ConvertFrom-Json.

---

Keep screenshots in `.github/assets/` (not required) and update paths above if you add images.

If you want, I can generate placeholder images and add the assets/ references in the repo, or add the `Validate service account JSON` step directly to the workflow. Which would you prefer?

## Screenshot capture guide
When contributing screenshots for the guide, follow these simple rules so images are consistent and safe to publish:

- Format: PNG preferred (lossless). Use 800–1200 px width for clarity.
- File names and path (store in repo): `.github/assets/<filename>.png`.
- Blur or redact any sensitive values (account emails, keys, tokens) before committing.
- Show only relevant UI parts: crop to the panel that matters (e.g., service account row, Create Secret dialog).
- Include a short caption in the README where image is embedded.

Example filenames used in this repo:
- `.github/assets/gcp-service-accounts.png`
- `.github/assets/gcp-create-service-account.png`
- `.github/assets/github-new-secret.png`
- `.github/assets/gcp-secret-create.png`

How to add a screenshot to the README:

1. Place the file in `.github/assets/`.
2. Edit `README_SECRETS.md` (or `README.md`) and insert markdown image:

```markdown
![GCP Service Accounts list](.github/assets/gcp-service-accounts.png)
```

3. Commit and push. Use a PR so others can review whether any sensitive data is visible.

That's it — follow this guide and the screenshots will be consistent and safe to publish.