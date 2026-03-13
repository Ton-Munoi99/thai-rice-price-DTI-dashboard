param(
    [string]$FromDate = "",
    [string]$ToDate = "",
    [int]$WindowDays = 7,
    [string]$ProductId = "R11001",
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$snapshotPath = Join-Path $projectRoot "frontend\src\data\rice-price.json"
$updateScript = Join-Path $projectRoot "scripts\update_rice_snapshot.py"

if (-not $ToDate) {
    $ToDate = (Get-Date).ToString("yyyy-MM-dd")
}

if (-not $FromDate) {
    $from = (Get-Date $ToDate).AddDays(-1 * ($WindowDays - 1))
    $FromDate = $from.ToString("yyyy-MM-dd")
}

$commitMessage = "Update rice snapshot $FromDate to $ToDate"

Write-Host ""
Write-Host "=== Rice Snapshot Update ===" -ForegroundColor Green
Write-Host "From:   $FromDate"
Write-Host "To:     $ToDate"
Write-Host "Product:$ProductId"
Write-Host ""

Set-Location $projectRoot

python $updateScript --product-id $ProductId --from-date $FromDate --to-date $ToDate --output $snapshotPath
if ($LASTEXITCODE -ne 0) {
    throw "Snapshot update failed."
}

git add $snapshotPath
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
