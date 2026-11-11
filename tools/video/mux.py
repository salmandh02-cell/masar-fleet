import json,subprocess,sys
d,k,pad,out=sys.argv[1],sys.argv[2],float(sys.argv[3]),sys.argv[4]
c=json.load(open(d+'/cut.json'))
ins=['-ss',str(c['start']),'-to',str(c['end']),'-i',c['file']];flt=[]
for i,m in enumerate(c['marks']):
    ins+=['-i',f'/tmp/claude-0/e2e/vo/{k}{i+1}.wav'];ms=int((m+pad)*1000);flt.append(f'[{i+1}:a]adelay={ms}|{ms}[a{i}]')
n=len(c['marks']);flt.append(''.join(f'[a{i}]' for i in range(n))+f'amix=inputs={n}:normalize=0,apad[aout]')
subprocess.run(['ffmpeg','-y','-loglevel','error',*ins,'-filter_complex',';'.join(flt),'-map','0:v','-map','[aout]','-shortest','-c:v','libx264','-preset','slow','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',out],check=True)
print(c['marks'])
