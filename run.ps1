$ErrorActionPreference = "Stop"

function Write-Step($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Test-Command($name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Add-NodeToCurrentPath {
  $candidatePaths = @(
    "$env:ProgramFiles\nodejs",
    "${env:ProgramFiles(x86)}\nodejs",
    "$env:LOCALAPPDATA\Programs\nodejs"
  )

  foreach ($path in $candidatePaths) {
    if ([string]::IsNullOrWhiteSpace($path)) {
      continue
    }

    $nodeExe = Join-Path $path "node.exe"
    if ((Test-Path $nodeExe) -and (($env:Path -split ";") -notcontains $path)) {
      $env:Path = "$path;$env:Path"
    }
  }
}

function Convert-Version($value) {
  $clean = $value.TrimStart("v")
  return [Version]::Parse($clean)
}

function Test-NodeVersion($value) {
  $version = Convert-Version $value
  $node20Minimum = [Version]::Parse("20.19.0")
  $node22Minimum = [Version]::Parse("22.12.0")

  return (($version.Major -eq 20 -and $version -ge $node20Minimum) -or
    ($version.Major -ge 22 -and $version -ge $node22Minimum))
}

function Install-NodeWithWinget {
  if (-not (Test-Command "winget")) {
    return $false
  }

  Write-Host "Node.js is missing or too old. Installing Node.js LTS with winget..."
  winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements

  if ($LASTEXITCODE -ne 0) {
    return $false
  }

  Add-NodeToCurrentPath
  return $true
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

Write-Step "Checking Node.js"
Add-NodeToCurrentPath

if (-not (Test-Command "node")) {
  if (-not (Install-NodeWithWinget)) {
    Write-Host "Install Node.js 22 LTS from https://nodejs.org/, then run this script again." -ForegroundColor Yellow
    exit 1
  }

  if (-not (Test-Command "node")) {
    Write-Host "Node.js was installed, but this terminal cannot see it yet." -ForegroundColor Yellow
    Write-Host "Close this window, open a new terminal, and run .\run.bat again." -ForegroundColor Yellow
    exit 1
  }
}

$nodeVersion = (& node --version)
if (-not (Test-NodeVersion $nodeVersion)) {
  Write-Host "Found Node.js $nodeVersion, but this project needs Node.js 20.19.0+ or 22.12.0+." -ForegroundColor Yellow

  if (-not (Install-NodeWithWinget)) {
    Write-Host "Upgrade Node.js from https://nodejs.org/, then run this script again." -ForegroundColor Yellow
    exit 1
  }

  $nodeVersion = (& node --version)
  if (-not (Test-NodeVersion $nodeVersion)) {
    Write-Host "Node.js still reports $nodeVersion. Close and reopen the terminal, then run this script again." -ForegroundColor Yellow
    exit 1
  }
}

if (-not (Test-Command "npm")) {
  Write-Host "npm was not found. Close and reopen the terminal, then run this script again." -ForegroundColor Yellow
  exit 1
}

Write-Host "Using Node.js $nodeVersion"
Write-Host "Using npm $(& npm --version)"

Write-Step "Installing project dependencies"
if (Test-Path "node_modules") {
  Write-Host "node_modules already exists; npm will make sure everything is up to date."
}
npm install

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Step "Starting Terminal Escape"
Write-Host "Opening the local dev server. Use Ctrl+C to stop it."
npm run dev
