<#
Simple PowerShell secret scanner (heuristic). It searches for common key patterns in the repository files.
Usage:
  .\.github\scripts\find-secrets.ps1

Notes:
- This is not a replacement for specialized tools (truffleHog, git-secrets, detect-secrets).
- Review matches manually before taking action.
#>

# Patterns to check (regex)
$patterns = @(
    # Twilio-ish tokens (hex-like)
    '(?:AC|SK|PK)[0-9a-fA-F]{32,}',
    '[0-9a-fA-F]{32,}',
    'AIza[0-9A-Za-z_-]{35}',
    '-----BEGIN PRIVATE KEY-----',
    'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+', # JWT-ish
    'xox[baprs]-[0-9a-zA-Z]{8,}',
    'AKIA[0-9A-Z]{16}',
    'sbx_[0-9a-zA-Z]{32,}'
)

$repoRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) '..\..')
Set-Location $repoRoot
Write-Host "Scanning repository: $repoRoot"

$files = Get-ChildItem -Recurse -File -Include *.js,*.ts,*.json,*.md,*.env,*.yaml,*.yml -ErrorAction SilentlyContinue
$matches = @()
foreach ($f in $files) {
    $text = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
    foreach ($p in $patterns) {
        $m = [regex]::Matches($text, $p)
        if ($m.Count -gt 0) {
            foreach ($match in $m) {
                $matches += [PSCustomObject]@{ File = $f.FullName; Pattern = $p; Match = $match.Value }
            }
        }
    }
}

if ($matches.Count -eq 0) { Write-Host "No likely secrets found by heuristics." -ForegroundColor Green; exit 0 }

Write-Host "Possible secrets found:" -ForegroundColor Yellow
$matches | Format-Table -AutoSize

# Save to file
$out = Join-Path $repoRoot '.github\scripts\secret-scan-results.txt'
$matches | Out-File -FilePath $out -Encoding utf8
Write-Host "Results saved to $out" -ForegroundColor Cyan
