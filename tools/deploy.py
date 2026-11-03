"""ينشر الموقع والدوال (functions) على Netlify عبر الـ API.
التوكن من متغير البيئة NETLIFY_AUTH_TOKEN فقط (لا يُحفظ في ملف ولا في المستودع).
الموقع من NETLIFY_SITE_ID. والدوال تُجمَّع مسبقاً في build/*.js (esbuild).
الاستخدام: NETLIFY_AUTH_TOKEN=... NETLIFY_SITE_ID=... python3 tools/deploy.py build/push.js build/remind.js
"""
import hashlib, io, json, os, sys, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.environ.get('NETLIFY_SITE_ID', '')
TOKEN = os.environ.get('NETLIFY_AUTH_TOKEN', '')
if not TOKEN or not SITE: raise SystemExit('NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID are required')
# حماية: لا يُنشر نظام SaaS فوق موقع منهل الحالي
if SITE == 'b77a682e-f03d-4456-b363-340daaab3764': raise SystemExit('refusing to deploy over the live Manhal site')
FILES = ['index.html', 'admin.html', 'fb.js', 'sw.js', 'config.js', 'qr.js', 'i18n.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', '_redirects',
         'welcome.html', 'privacy.html', 'terms.html', 'pay.html', 'invoice.js', 'moyasar.js', 'moyasar.css']
# الدوال المجمّعة: python3 tools/deploy.py build/push.js build/remind.js
BUNDLES = sys.argv[1:]
SCHEDULES = {'remind': '0 4,5,6 * * *'}  # 7 و8 و9 صباحاً بتوقيت الرياض

def api(method, path, body=None, ctype='application/json'):
    data = body if isinstance(body, (bytes, type(None))) else json.dumps(body).encode()
    req = urllib.request.Request('https://api.netlify.com/api/v1' + path, data=data, method=method,
                                 headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': ctype})
    with urllib.request.urlopen(req, timeout=120) as r:
        t = r.read()
        return json.loads(t) if t else {}

files = {}
for f in FILES:
    b = open(os.path.join(ROOT, f), 'rb').read(); files['/' + f] = (hashlib.sha1(b).hexdigest(), b)
body = {'files': {p: h for p, (h, _) in files.items()}}
zips = {}
for b in BUNDLES:
    name = os.path.splitext(os.path.basename(b))[0]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(b, name + '.js')
    zips[name] = buf.getvalue()
if zips:
    body['functions'] = {n: hashlib.sha256(z).hexdigest() for n, z in zips.items()}
    sch = [{'name': n, 'cron': c} for n, c in SCHEDULES.items() if n in zips]
    if sch: body['function_schedules'] = sch
d = api('POST', f'/sites/{SITE}/deploys', body)
did = d['id']
for p, (h, b) in files.items():
    if h in d.get('required', []):
        api('PUT', f'/deploys/{did}/files{p}', b, 'application/octet-stream')
for n, z in zips.items():
    if body['functions'][n] in d.get('required_functions', []):
        api('PUT', f'/deploys/{did}/functions/{n}?runtime=js', z, 'application/octet-stream')
print('deploy', did, 'required files:', len(d.get('required', [])), 'functions:', d.get('required_functions'))
