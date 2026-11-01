#!/bin/bash
# الطريقة المعتمدة للنشر هي tools/deploy.py (تنشر الموقع والدوال معاً)
echo "استخدم: NETLIFY_AUTH_TOKEN=... NETLIFY_SITE_ID=... python3 tools/deploy.py build/push.js build/remind.js" >&2
exit 1
