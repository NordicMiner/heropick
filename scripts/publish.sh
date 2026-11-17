#!/usr/bin/env bash
# Publish a code-only snapshot of HEAD to the public repo (remote "public", branch main).
# Planning notes (docs/) and local history stay private; each publish is one commit on top of the last public one.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
msg="${1:-Update HeroPick}"
export GIT_INDEX_FILE="$(git rev-parse --git-dir)/publish-index"
git read-tree HEAD
git rm -r -q --cached --ignore-unmatch docs .superpowers .vitest samples > /dev/null
tree=$(git write-tree)
rm -f "$GIT_INDEX_FILE"
unset GIT_INDEX_FILE
parent=$(git ls-remote public refs/heads/main | cut -f1)
if [ -n "$parent" ]; then
  git fetch -q public main
  if [ "$(git rev-parse "$parent^{tree}")" = "$tree" ]; then echo "public is already up to date"; exit 0; fi
  commit=$(git commit-tree "$tree" -p "$parent" -m "$msg")
else
  commit=$(git commit-tree "$tree" -m "$msg")
fi
git push public "$commit:refs/heads/main"
echo "published $commit"
