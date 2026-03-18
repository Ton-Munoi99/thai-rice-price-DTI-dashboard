param(
    [string]$FromDate = "",
    [string]$ToDate = "",
    [int]$HistoryYears = 3,
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$updateScript = Join-Path $projectRoot "scripts\update_rice_snapshot.py"
$latestBundlePath = Join-Path $projectRoot "frontend\src\data\rice-latest.json"
$latestPublicPath = Join-Path $projectRoot "frontend\public\data\rice-latest.json"
$historySnapshotPath = Join-Path $projectRoot "frontend\public\data\rice-history"

if (-not $ToDate) {
    $ToDate = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
}

if (-not $FromDate) {
    $from = (Get-Date $ToDate).AddDays(-1 * (($HistoryYears * 365) - 1))
    $FromDate = $from.ToString("yyyy-MM-dd")
}

$commitMessage = "Update rice dashboard snapshot $FromDate to $ToDate"

Write-Host ""
Write-Host "=== Rice Dashboard Snapshot Update ===" -ForegroundColor Green
Write-Host "From:   $FromDate"
Write-Host "To:     $ToDate"
Write-Host "Years:  $HistoryYears"
Write-Host ""

Set-Location $projectRoot

python $updateScript --from-date $FromDate --to-date $ToDate --latest-bundle-output $latestBundlePath --latest-public-output $latestPublicPath --history-dir $historySnapshotPath
if ($LASTEXITCODE -ne 0) {
    throw "Snapshot update failed."
}

git add $latestBundlePath
git add $latestPublicPath
git add $historySnapshotPath
if ($LASTEXITCODE -ne 0) {
    throw "git add failed."
}

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "No snapshot changes detected. Nothing to commit." -ForegroundColor Yellow
    exit 0
}

git commit -m $commitMessage
if ($LASTEXITCODE -ne 0) {
    throw "git commit failed."
}

git push origin $Branch
if ($LASTEXITCODE -ne 0) {
    throw "git push failed."
}

Write-Host ""
Write-Host "Snapshot updated and pushed successfully." -ForegroundColor Green
Write-Host "Netlify will deploy the latest snapshot from GitHub." -ForegroundColor Green
