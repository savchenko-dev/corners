#!/usr/bin/env bash
# Usage: ./coolify-api.sh METHOD /path [json-body]
# Talks to Coolify on mycloud through an SSH tunnel; token read from .coolify_token.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TOK="$(tr -d '[:space:]' < "$DIR/.coolify_token")"
METHOD="$1"; P="$2"; BODY="${3:-}"
ssh -o BatchMode=yes mycloud "curl -s -X $METHOD -H 'Authorization: Bearer $TOK' -H 'Content-Type: application/json' -H 'Accept: application/json' ${BODY:+--data-binary @-} http://localhost:8000/api/v1$P" <<<"$BODY"
