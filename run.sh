#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

step() {
  printf "\n==> %s\n" "$1"
}

version_ok() {
  node - <<'NODE'
const raw = process.version.replace(/^v/, '').split('.').map(Number);
const [major, minor, patch] = raw;
const atLeast = (wantMajor, wantMinor, wantPatch) =>
  major > wantMajor ||
  (major === wantMajor && (minor > wantMinor || (minor === wantMinor && patch >= wantPatch)));

if ((major === 20 && atLeast(20, 19, 0)) || (major >= 22 && atLeast(22, 12, 0))) {
  process.exit(0);
}

process.exit(1);
NODE
}

install_hint() {
  echo "Node.js is missing or too old. This project needs Node.js 20.19.0+ or 22.12.0+."

  if [[ "$OSTYPE" == "darwin"* ]] && command -v brew >/dev/null 2>&1; then
    echo "Run: brew install node"
  elif command -v apt-get >/dev/null 2>&1; then
    echo "Install Node.js 22 LTS from https://nodejs.org/ or your distro package manager."
  else
    echo "Install Node.js 22 LTS from https://nodejs.org/."
  fi

  echo "Then open a new terminal and run ./run.sh again."
}

step "Checking Node.js"
if ! command -v node >/dev/null 2>&1 || ! version_ok; then
  install_hint
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Reinstall Node.js from https://nodejs.org/, then run ./run.sh again."
  exit 1
fi

echo "Using Node.js $(node --version)"
echo "Using npm $(npm --version)"

step "Installing project dependencies"
if [[ -d node_modules ]]; then
  echo "node_modules already exists; npm will make sure everything is up to date."
fi
npm install

step "Starting Terminal Escape"
echo "Opening the local dev server. Use Ctrl+C to stop it."
npm run dev
