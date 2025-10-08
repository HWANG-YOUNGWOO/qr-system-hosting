<#
Regenerate functions/package-lock.json safely.
Usage:
  # Interactive (recommended)
  .\.github\scripts\regenerate-functions-lock.ps1

  # Non-interactive: auto-commit and push changes
  .\.github\scripts\regenerate-functions-lock.ps1 -AutoCommit

Requirements:
- PowerShell (Windows)
- Node.js v22.x (recommended) available on PATH
- Git configured with correct user.name/user.email and push permissions

What it does:
- Shows git status and asks for confirmation
- Checks Node version (warns if major < 22)
- Backs up existing package-lock.json to package-lock.json.bak
- Runs npm install inside functions/ to regenerate package-lock.json
- Shows diff of package-lock.json
- Optionally commits and pushes the updated lockfile
#>
[CmdletBinding()]
param(
    [switch]$AutoCommit
)

function Abort($msg) {
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit 1
}

# Resolve repository root (assume script is in .github\scripts)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")
Set-Location $repoRoot
Write-Host "Repository root:" $repoRoot

# Ensure we're in a git repo
if (-not (Test-Path .git)) { Abort "Not a git repository root. Run this from the repository root." }

# Show basic git status and confirm
Write-Host "Git status (short):" -ForegroundColor Cyan
git status --short

# Ensure working tree is clean (or prompt the user)
$status = git status --porcelain
if ($status) {
    Write-Host "Git working tree is not clean. Please commit or stash changes before regenerating lockfile." -ForegroundColor Yellow
    Write-Host $status
    if (-not $AutoCommit) {
        $ok = Read-Host "Working tree not clean. Proceed anyway? This may commit additional changes. (y/N)"
        if ($ok.Trim().ToLower() -ne 'y') { Write-Host 'Aborted by user.'; exit 0 }
    }
}

# Check Node version
$nodeVersion = try { (node -v) } catch { $null }
if (-not $nodeVersion) { Abort "Node is not installed or not on PATH. Install Node v22 and retry." }

# Parse major version
if ($nodeVersion -match '^v(\d+)') { $major = [int]$Matches[1] } else { $major = 0 }
Write-Host "Detected node version: $nodeVersion"
if ($major -lt 22) {
    Write-Host "ERROR: Node major version is $major (<22). You should use Node 22 to regenerate functions lockfile to match Cloud Functions runtime." -ForegroundColor Red
    Abort "Please switch to Node v22 and re-run the script. For example use nvm, nvm-windows, or the Node 22 installer."
}

# Enter functions directory
$functionsDir = Join-Path $repoRoot 'functions'
if (-not (Test-Path $functionsDir)) { Abort "functions/ directory not found at $functionsDir" }
Set-Location $functionsDir
Write-Host "Working in: $(Get-Location)"

# Backup existing lockfile
$lock = Join-Path $functionsDir 'package-lock.json'
if (Test-Path $lock) {
    $bak = Join-Path $functionsDir 'package-lock.json.bak'
    Copy-Item -Force $lock $bak
    Write-Host "Backed up package-lock.json -> package-lock.json.bak"
}

# Remove node_modules to ensure clean install
if (Test-Path 'node_modules') {
    Write-Host "Removing node_modules (to ensure clean install)..."
    Remove-Item -Recurse -Force node_modules
}

# Run npm install
Write-Host "Running npm install (this will regenerate package-lock.json)..." -ForegroundColor Cyan
$npm = Start-Process -FilePath npm -ArgumentList 'install' -NoNewWindow -Wait -PassThru
if ($npm.ExitCode -ne 0) { Abort "npm install failed with exit code $($npm.ExitCode). Check npm logs above." }
Write-Host "npm install completed."

# Show brief diff for package-lock.json
if (Test-Path $lock) {
    Write-Host "package-lock.json exists. Showing git diff -- package-lock.json" -ForegroundColor Cyan
    git --no-pager diff -- package-lock.json | Out-Host
} else {
    Write-Host "package-lock.json still missing after npm install." -ForegroundColor Yellow
}

# Optionally commit and push
if ($AutoCommit) {
    # Ensure git user configured
    $name = git config user.name
    $email = git config user.email
    if (-not $name -or -not $email) {
        Write-Host "Git user.name/user.email not configured locally. Attempting to read global config..." -ForegroundColor Yellow
        $name = git config --global user.name
        $email = git config --global user.email
    }
    if (-not $name -or -not $email) {
        Abort "Git user.name and user.email are not configured. Set them or run the script without -AutoCommit."
    }

    Write-Host "Auto-commit enabled: staging package-lock.json and pushing..." -ForegroundColor Green
    git add package-lock.json
    $msg = "chore(functions): regenerate package-lock.json for Node $nodeVersion"
    git commit -m $msg
    if ($LASTEXITCODE -ne 0) { Write-Host "git commit may have failed or no changes to commit." -ForegroundColor Yellow }
    else { Write-Host "Committed: $msg" -ForegroundColor Green }

    Write-Host "Pushing to origin HEAD..." -ForegroundColor Cyan
    git push origin HEAD
    if ($LASTEXITCODE -ne 0) { Write-Host "git push failed; check remote permissions." -ForegroundColor Red }
    else { Write-Host "Committed and pushed changes." -ForegroundColor Green }
} else {
    Write-Host "No auto-commit. If the lockfile looks good, commit and push manually:" -ForegroundColor Cyan
    Write-Host "  cd functions; git add package-lock.json; git commit -m 'chore(functions): regenerate package-lock.json'; git push"
}

Write-Host "Done. You can now re-run CI (GitHub UI or 'gh run rerun <id>')." -ForegroundColor Green
