#!/bin/bash
# End-to-end test for the git-panel host service: rebuilds a scratch repo
# (local bare remote + diverged branches) and runs scripts/test-host.ts.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE=/tmp/gitpanel-test

rm -rf "$BASE" && mkdir -p "$BASE/remote.git"
git init --bare -q "$BASE/remote.git"
cd "$BASE"
git clone -q "$BASE/remote.git" work
cd work
git config user.email test@test.com
git config user.name Tester
git config pull.rebase true
git checkout -q -b main
echo a > a.txt; git add .; git commit -qm "feat: init"
echo b >> a.txt; git add .; git commit -qm "feat: second commit"
git checkout -qb feature/alpha
echo x > x.txt; git add .; git commit -qm "feat: alpha work"
git checkout -q main
git push -q -u origin main feature/alpha
git -C "$BASE/remote.git" symbolic-ref HEAD refs/heads/main
echo c >> a.txt; git add .; git commit -qm "feat: local ahead commit"
git clone -q "$BASE/remote.git" "$BASE/pusher"
cd "$BASE/pusher"
git config user.email push@test.com
git config user.name Pusher
echo d > d.txt && git add . && git commit -qm "feat: remote ahead commit"
git push -q origin main

cd "$ROOT"
npx esbuild scripts/test-host.ts --bundle --format=cjs --platform=node \
  --target=node20 --external:@deepseek-ai/* --outfile=/tmp/test-host.cjs >/dev/null
node /tmp/test-host.cjs
