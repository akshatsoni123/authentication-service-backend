#!/usr/bin/env bash
set -euo pipefail

# End-to-end curl runbook for Authentication Service
# Uses jq if available for nicer parsing; otherwise prints raw responses.

BASE_URL="${BASE_URL:-http://localhost:3000}"
EMAIL="${EMAIL:-curltest$(date +%s)@example.com}"
PASSWORD="${PASSWORD:-Str0ng1Pass}"
NEW_PASSWORD="${NEW_PASSWORD:-N3wStr0ngPass}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/auth-cookies.txt}"

echo "BASE_URL=$BASE_URL"
echo "EMAIL=$EMAIL"

register_payload=$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")
echo
echo "== Register =="
register_res=$(curl -sS -X POST "$BASE_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  --data "$register_payload")
echo "$register_res"

echo
echo "== Verify Email =="
echo "Grab token from logs/email, then run:"
echo "curl -X POST \"$BASE_URL/api/v1/auth/verify-email\" -H \"Content-Type: application/json\" --data '{\"token\":\"<token>\"}'"

echo
echo "== Login =="
login_res=$(curl -sS -c "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  --data "$register_payload")
echo "$login_res"

access_token=""
if command -v jq >/dev/null 2>&1; then
  access_token=$(printf "%s" "$login_res" | jq -r '.data.accessToken // empty')
fi

if [[ -n "$access_token" ]]; then
  echo
  echo "== /users/me (Bearer) =="
  curl -sS "$BASE_URL/api/v1/users/me" \
    -H "Authorization: Bearer $access_token"
  echo
fi

echo
echo "== Refresh (cookie) =="
curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/refresh"
echo

echo
echo "== Forgot Password =="
forgot_payload=$(printf '{"email":"%s"}' "$EMAIL")
curl -sS -X POST "$BASE_URL/api/v1/auth/forgot-password" \
  -H "Content-Type: application/json" \
  --data "$forgot_payload"
echo
echo "Grab reset token from logs/email, then run:"
echo "curl -X POST \"$BASE_URL/api/v1/auth/reset-password\" -H \"Content-Type: application/json\" --data '{\"token\":\"<token>\",\"newPassword\":\"$NEW_PASSWORD\"}'"

echo
echo "Lifecycle script complete."
