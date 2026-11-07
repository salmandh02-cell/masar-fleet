import random
random.seed(7)
W,H=1600,1000
o=[]
a=o.append
a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" preserveAspectRatio="xMidYMid slice">')
a('<defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity=".05"/></pattern>'
  '<radialGradient id="v" cx="30%" cy="40%" r="80%"><stop offset="0" stop-color="#155c47"/><stop offset=".6" stop-color="#0b3f30"/><stop offset="1" stop-color="#062a20"/></radialGradient>'
  '<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity=".45"/></filter></defs>')
a(f'<rect width="{W}" height="{H}" fill="url(#v)"/><rect width="{W}" height="{H}" fill="url(#g)"/>')
COL=['#EEF1F3','#EEF1F3','#EEF1F3','#D5DADF','#B9C0C6','#8C959D','#2E363D','#EEF1F3','#EEF1F3','#EEF1F3','#3F5F7D','#EEF1F3']
def car(x,y,rot,c):
    dark = c in ('#2E363D','#3F5F7D','#8C959D')
    roof = '#ffffff' if not dark else '#4a545c'
    s=f'<g transform="translate({x} {y}) rotate({rot})" filter="url(#s)">'
    s+=f'<rect x="-31" y="-64" width="62" height="128" rx="16" fill="{c}"/>'
    s+=f'<rect x="-36" y="-34" width="7" height="10" rx="3" fill="{c}"/><rect x="29" y="-34" width="7" height="10" rx="3" fill="{c}"/>'
    s+='<path d="M-25 -36 Q0 -46 25 -36 L21 -16 Q0 -20 -21 -16Z" fill="#1b262e"/>'
    s+=f'<rect x="-21" y="-14" width="42" height="40" rx="7" fill="{roof}" fill-opacity="{0.55 if not dark else 0.5}"/>'
    s+='<path d="M-21 30 Q0 34 21 30 L24 44 Q0 50 -24 44Z" fill="#1b262e"/>'
    s+='<rect x="-26" y="-63" width="12" height="5" rx="2" fill="#FFF6D5"/><rect x="14" y="-63" width="12" height="5" rx="2" fill="#FFF6D5"/>'
    s+='<rect x="-26" y="59" width="12" height="4" rx="2" fill="#C2362B"/><rect x="14" y="59" width="12" height="4" rx="2" fill="#C2362B"/>'
    return s+'</g>'
AR='٠١٢٣٤٥٦٧٨٩'
LAT={'أ':'A','ب':'B','ح':'J','د':'D','ر':'R','س':'S','ص':'X','ط':'T','ع':'E','ق':'G','ك':'K','ل':'L','م':'Z','ن':'N','ه':'H','و':'U','ى':'V'}
def plate(x,y,num,let,stat=None):
    w,h=150,58
    s=f'<g transform="translate({x} {y})" filter="url(#s)">'
    s+=f'<rect x="0" y="0" width="{w}" height="{h}" rx="7" fill="#fff" stroke="#1b262e" stroke-width="2.5"/>'
    S=26
    s+=f'<rect x="{w-S-2}" y="2" width="{S}" height="{h-4}" rx="5" fill="#E8F0EC"/>'
    s+=f'<text x="{w-S/2-2}" y="25" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="#0E5A44" text-anchor="middle">KSA</text><circle cx="{w-S/2-2}" cy="39" r="5" fill="none" stroke="#0E5A44" stroke-width="1.6"/>'
    iw=w-S-2
    s+=f'<line x1="2" y1="{h/2}" x2="{iw}" y2="{h/2}" stroke="#1b262e" stroke-width="1.5"/><line x1="{iw/2}" y1="3" x2="{iw/2}" y2="{h-3}" stroke="#1b262e" stroke-width="1.5"/><line x1="{iw}" y1="2" x2="{iw}" y2="{h-2}" stroke="#1b262e" stroke-width="1.5"/>'
    lt=' '.join(let); ll=' '.join(LAT[c] for c in reversed(let)); an=''.join(AR[int(d)] for d in num)
    cx1=iw*0.25; cx2=iw*0.75
    s+=f'<text x="{cx1}" y="22" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#1b262e" text-anchor="middle">{an}</text>'
    s+=f'<text x="{cx2}" y="22" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#1b262e" text-anchor="middle">{lt}</text>'
    s+=f'<text x="{cx1}" y="49" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#1b262e" text-anchor="middle">{num}</text>'
    s+=f'<text x="{cx2}" y="49" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#1b262e" text-anchor="middle">{ll}</text>'
    if stat:
        col,txt=stat
        s+=f'<g transform="translate(0 {h+8})"><rect width="{w}" height="26" rx="13" fill="#0b2e24" fill-opacity=".85" stroke="{col}" stroke-opacity=".6"/><circle cx="{w-14}" cy="13" r="5" fill="{col}"/><text x="{w-26}" y="18" font-family="Arial,sans-serif" font-size="13" fill="#fff" text-anchor="end">{txt}</text></g>'
    return s+'</g>'
a('<g transform="rotate(-12 800 500) translate(-120 -60)">')
# الأرضية والمسارات
a('<rect x="-200" y="120" width="2200" height="860" fill="#0a3529" fill-opacity=".55"/>')
for row,y0 in ((0,160),(1,640)):
    for i in range(0,22):
        x=-160+i*96
        a(f'<line x1="{x}" y1="{y0}" x2="{x}" y2="{y0+180}" stroke="#ffffff" stroke-opacity=".28" stroke-width="3"/>')
a('<line x1="-200" y1="490" x2="2000" y2="490" stroke="#ffffff" stroke-opacity=".22" stroke-width="4" stroke-dasharray="40 30"/>')
cars=[]
for row,y0 in ((0,250),(1,730)):
    for i in range(0,21):
        if random.random()<0.2: continue
        x=-112+i*96
        cars.append((x,y0,0 if row==0 else 180,random.choice(COL)))
for c in cars: a(car(*c))
# مركبة متحركة ومسارها
a('<path d="M-200 455 C 300 455, 500 455, 760 455" fill="none" stroke="#C9A227" stroke-width="4" stroke-dasharray="10 12" stroke-opacity=".9"/>')
a(car(830,455,90,'#EEF1F3'))
a('</g>')
# لوحات وبطاقات حالة (خارج الدوران حتى تبقى مقروءة)
P=[(1010,140,'2042','لبق',('#E0A100','استهلاك مرتفع')),(1290,360,'5964','دره',None),(820,610,'1555','ىلص',('#E5484D','الاستمارة منتهية')),
   (1180,690,'7341','ىصه',('#3DD68C','مُسلّمة · ناصر')),(560,250,'3708','دطل',None),(1420,130,'9970','لىو',('#3DD68C','متاحة')),(300,700,'1684','قدق',None)]
for p in P: a(plate(*p))
a('</svg>')
import os; open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','hero-fleet.svg'),'w').write(''.join(o))
