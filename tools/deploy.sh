#!/bin/bash
# ينشر التطبيق على Netlify. المفتاح يُقرأ من /root/.netlify_token (لا يُحفظ في المستودع)
set -e
cd "$(dirname "$0")/.."
SITE=b77a682e-f03d-4456-b363-340daaab3764
TMP=$(mktemp -d); cp index.html fb.js sw.js config.js manifest.json icon.svg icon-192.png icon-512.png "$TMP"/
(cd "$TMP" && zip -qr site.zip .)
curl -sS -m 120 -H "Authorization: Bearer $(cat /root/.netlify_token)" -H "Content-Type: application/zip" \
  --data-binary @"$TMP/site.zip" "https://api.netlify.com/api/v1/sites/$SITE/deploys" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('state'),d.get('id'),d.get('deploy_ssl_url') or d)"
rm -rf "$TMP"
