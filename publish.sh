#!/usr/bin/env bash
# ブランチを main に fast-forward でマージし、origin に push する。
#
# 使い方:
#   ./publish.sh           現在のブランチを公開する（main にいるときは push のみ）
#   ./publish.sh <branch>  指定したブランチを公開する
#
# 成功すると main に切り替わった状態で終わる。途中で失敗したら元のブランチに戻る。
set -euo pipefail

MAIN=main
REMOTE=origin

cd "$(git rev-parse --show-toplevel)"

start=$(git branch --show-current)
branch=${1:-$start}

if [[ -z $branch ]]; then
  echo "エラー: ブランチ上にいません。ブランチ名を指定してください。" >&2
  exit 1
fi
if ! git rev-parse --verify --quiet "refs/heads/$branch" >/dev/null; then
  echo "エラー: ブランチ '$branch' がありません。" >&2
  exit 1
fi
if [[ -n $(git status --porcelain) ]]; then
  echo "エラー: 未コミットの変更があります。先にコミットしてください。" >&2
  git status --short >&2
  exit 1
fi

restore() {
  local status=$?
  if [[ $status -ne 0 && -n $start && $(git branch --show-current) != "$start" ]]; then
    git switch --quiet "$start" || true
    echo "失敗したため '$start' に戻りました。" >&2
  fi
  exit "$status"
}
trap restore EXIT

git switch --quiet "$MAIN"
git pull --quiet --ff-only "$REMOTE" "$MAIN"

if [[ $branch != "$MAIN" ]]; then
  if ! git merge --quiet --ff-only "$branch"; then
    echo "エラー: '$branch' は $MAIN から分岐しています。次を実行してからやり直してください。" >&2
    echo "  git switch $branch && git rebase $MAIN" >&2
    exit 1
  fi
fi

git push --quiet "$REMOTE" "$MAIN"
echo "完了: '$branch' を $MAIN にマージし、$REMOTE に push しました ($(git rev-parse --short HEAD))。"
