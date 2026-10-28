import sys,pathlib,json,re,hashlib,urllib.request,urllib.parse,concurrent.futures
ROOT=pathlib.Path.cwd();CACHE=ROOT/'.tmp/electric-reference';sys.path.insert(0,str(ROOT.parent/'equipment-research/deps'));from bs4 import BeautifulSoup
sys.stdout.reconfigure(encoding='utf8');p=ROOT/'warehouse/equipment-data.js';s=p.read_text(encoding='utf8');d=json.loads(s[s.index('{'):].rstrip(';\n'));errors=[]
def job(x):
 if x.get('image'):return
 url=x['offers'][0]['url'] if x['offers'] else x['sources'][0];cache=CACHE/(hashlib.sha256(url.encode()).hexdigest()[:16]+'.html')
 try:
  op=urllib.request.build_opener(urllib.request.ProxyHandler({}))
  if cache.exists():raw=cache.read_bytes()
  else:
   raw=op.open(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=12).read(2000000);cache.write_bytes(raw)
  soup=BeautifulSoup(raw,'html.parser');src=None
  for tag in soup.select('script[type="application/ld+json"]'):
   try:node=json.loads(tag.string or tag.get_text())
   except:continue
   stack=node if isinstance(node,list) else [node]
   while stack:
    a=stack.pop()
    if not isinstance(a,dict):continue
    stack.extend(a.get('@graph',[]));typ=a.get('@type');typ=[typ] if isinstance(typ,str) else typ or []
    if 'Product' in typ:
     im=a.get('image');im=im[0] if isinstance(im,list) and im else im;src=im.get('url') if isinstance(im,dict) else im
  if not src:
   og=soup.select_one('meta[property="og:image"]');src=og.get('content') if og else None
  if not src:return
  src=urllib.parse.urljoin(url,src)
  if not src.startswith('https://') or re.search('logo|placeholder|no[_-]?photo|no[_-]?image',src,re.I):return
  raw=op.open(urllib.request.Request(src,headers={'User-Agent':'Mozilla/5.0'}),timeout=12).read(700001)
  if len(raw)>700000:return
  ext='jpg' if raw[:3]==b'\xff\xd8\xff' else 'png' if raw[:8]==b'\x89PNG\r\n\x1a\n' else 'webp' if raw[:4]==b'RIFF' and raw[8:12]==b'WEBP' else None
  if not ext:return
  h=hashlib.sha256(raw).hexdigest();rel='warehouse/equipment-media/'+h[:24]+'.'+ext;(ROOT/rel).write_bytes(raw);x['image']={'src':rel,'original_url':src,'source_url':url,'sha256':h,'bytes':len(raw),'checked_at':d['checked_at']}
  specs=x['specifications']
  if not specs:
   for tr in soup.select('table tr'):
    c=tr.select('th,td')
    if len(c)==2:
     name=c[0].get_text(' ',strip=True).rstrip(':');value=c[1].get_text(' ',strip=True)
     if 1<len(name)<100 and 0<len(value)<200:specs.append({'name':name,'value':value,'source_url':url})
 except Exception as e:errors.append({'url':url,'error':str(e)})
missing=[x for x in d['items'] if not x.get('image')];print('checking exact product pages',len(missing),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for i,_ in enumerate(pool.map(job,missing)):
  if i%40==0:print('checked',i,flush=True)
p.write_text('export const equipmentData='+json.dumps(d,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8');print('photos',sum(bool(x.get('image')) for x in d['items']),flush=True);(CACHE/'detail-failures.json').write_text(json.dumps(errors,ensure_ascii=False),encoding='utf8')
