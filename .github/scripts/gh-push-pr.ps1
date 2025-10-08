param(
  [string]$Title = $(throw 'Title is required'),
  [string]$Body = '',
  [string]$Base = 'main',
  [switch]$Merge,
  [switch]$ForcePush
)

function Get-CurrentBranch {
  $b = git rev-parse --abbrev-ref HEAD 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'git is not available or not a git repo' }
  return $b.Trim()
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'gh (GitHub CLI) not found in PATH. Install and run `gh auth login` first.'
}

$branch = Get-CurrentBranch
Write-Host "Current branch: $branch"

if ($ForcePush) {
  git push -u origin $branch --force
} else {
  git push -u origin $branch
}

Write-Host "Creating PR against $Base..."
$prCreateArgs = @('--title', $Title, '--body', $Body, '--base', $Base, '--head', $branch, '--json', 'number,url')
$pr = gh pr create @prCreateArgs | ConvertFrom-Json
Write-Host "PR created: $($pr.url) (#$($pr.number))"

if ($Merge) {
  Write-Host "Merging PR #$($pr.number) using --squash..."
  gh pr merge $pr.number --squash --delete-branch
}
