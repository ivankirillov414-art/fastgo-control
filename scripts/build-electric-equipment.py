import sys,pathlib,json,re,hashlib,html,urllib.request,urllib.parse,concurrent.futures,datetime,threading
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=ROOT/'.tmp/electric-reference';OLD=ROOT.parent/'equipment-research'
sys.path.insert(0,str(OLD/'deps'));from bs4 import BeautifulSoup
sys.stdout.reconfigure(encoding='utf8');DATE=datetime.datetime.now(datetime.timezone.utc).date().isoformat();failures=[];lock=threading.Lock()
def txt(v):return re.sub(r'\s+',' ',html.unescape(str(v))).strip()
def soup(raw):return BeautifulSoup(raw,'html.parser')
def fetch(url):
 p=CACHE/(hashlib.sha256(url.encode()).hexdigest()[:16]+'.html')
 if p.exists():return p.read_bytes()
 try:
  op=urllib.request.build_opener(urllib.request.ProxyHandler({}));r=op.open(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25);raw=r.read(3000000);p.write_bytes(raw);return raw
 except Exception as e:
  with lock:failures.append({'url':url,'error':str(e)})
  return None
raw=(ROOT/'warehouse/equipment-data.js').read_text(encoding='utf-8-sig');data=json.loads(raw[raw.index('{'):].rstrip(';\n\r '));original=data['items'];byurl={o['url']:x for x in original for o in x['offers']}
items={x['id']:x for x in original if x['category'].startswith('Электро') or x['category'] in ['Моноколёса','Гироскутеры','Сигвеи']}
for x in items.values():x.update(electric=True,sources=[o['url'] for o in x['offers']],specifications=[])
images={};meta={}
for name in ['index.json','collections.json','extra.json']:
 for r in json.loads((OLD/name).read_text(encoding='utf8')):
  if r.get('file'):meta[r['file']]=r['url']
catmap={'Электросамокаты':'Электросамокаты','Электровелосипеды':'Электровелосипеды','Электромопеды':'Электромопеды','Электромотоциклы':'Электромотоциклы','Моноколеса':'Моноколёса','Мини-сигвеи':'Гироскутеры','Сигвеи':'Сигвеи','Электроскейты':'Электроскейты','Электромобили':'Электромобили'}
brands=['White Siberia','Ninebot-Segway-Xiaomi','LeaperKim','KingSong','Begode','Gotway','Veteran','Inmotion','Ninebot','Segway','Xiaomi','Kugoo','Halten','Dualtron','Minimotors','SpeedWay','E-Twow','Inokim','Joyor','Ultron','Volteco','Eltreco','Airwheel','Ecobike','Sambit','Razor','Currus','Kuickwheel','Lemotion','Robstep','Ruswheel','Wmotion','Gyroor','IPS','Rockwheel','Solowheel','CityCoCo','StarWay','JackHot','IceWheel','TuTu','Yadea','Moza','RUTRIKE','GreenCamel','Syccy','Wanshida','Gelbert']
def ensure(name,category,url,brand=None,price=None):
 x=byurl.get(url)
 if x and x['id'] in items:return items[x['id']]
 if x and x['category']=='Другая техника':x=dict(x);x['category']=category
 else:
  brand=brand or next((b for b in brands if b.lower() in name.lower()),'Не указана');model=re.sub('^'+re.escape(brand)+r'\s+','',name,flags=re.I)
  x={'id':'eq-'+hashlib.sha256((category+'|'+name).lower().encode()).hexdigest()[:20],'name':name,'brand':brand,'model':model,'category':category,'offers':[],'price_min':None,'price_max':None}
 if price and price>=500 and not x['offers']:x['offers']=[{'price':price,'high':price,'url':url,'source':urllib.parse.urlparse(url).hostname,'checked_at':DATE,'from_price':False,'available':None}];x['price_min']=price;x['price_max']=price
 x.update(electric=True,sources=[url],specifications=[]);items[x['id']]=x;byurl[url]=x;return x
seen=set()
for p in OLD.glob('*.html'):
 raw=p.read_bytes()
 if not raw.lstrip().startswith(b'['):continue
 try:products=json.loads(raw)
 except:continue
 for v in products:
  if not isinstance(v,dict) or 'permalink' not in v or v['permalink'] in seen:continue
  category=next((catmap[c['name']] for c in v.get('categories',[]) if c['name'] in catmap),None)
  if not category:continue
  url=v['permalink'];seen.add(url);pr=v.get('prices',{});price=float(pr.get('price') or 0)/10**pr.get('currency_minor_unit',0) if pr.get('currency_code')=='RUB' else None
  x=ensure(txt(v['name']),category,url,price=price)
  for a in v.get('attributes',[]):
   vals=[txt(t.get('name','')) for t in a.get('terms',[])];value=', '.join(filter(None,vals))
   if value:x['specifications'].append({'name':txt(a['name']),'value':value,'source_url':url})
  for tr in soup(v.get('description','')+v.get('short_description','')).select('tr'):
   c=tr.select('th,td')
   if len(c)==2:x['specifications'].append({'name':txt(c[0].get_text(' ',strip=True)),'value':txt(c[1].get_text(' ',strip=True)),'source_url':url})
  if v.get('images'):
   im=v['images'][0];candidates=[]
   for val in im.get('srcset','').split(','):
    m=re.match(r'\s*(https://\S+)\s+(\d+)w',val)
    if m and 300<=int(m[2])<=650:candidates.append((int(m[2]),m[1]))
   images[x['id']]=(max(candidates)[1] if candidates else im.get('thumbnail') or im['src'],url)
# Cached bicycle category cards provide exact photo-to-offer matching.
for filename,url in meta.items():
 p=OLD/filename
 if not p.exists() or p.stat().st_size<10000:continue
 raw=p.read_bytes()
 if raw.lstrip().startswith(b'['):continue
 s=soup(raw)
 for a in s.select('a.product-card__title,a.ah-products-item__name'):
  href=urllib.parse.urljoin(url,a.get('href',''));x=byurl.get(href)
  if not x or x['id'] not in items:continue
  c=a.find_parent(class_='product-card') or a.find_parent(class_='ah-products-item');im=c.select_one('img') if c else None
  if im:
   src=im.get('data-src') or im.get('data-original') or im.get('src','')
   if src and not src.startswith('data:'):images.setdefault(x['id'],(urllib.parse.urljoin(url,src),href))
# Manufacturer electric-only category pages, with bounded pagination.
records=json.loads((CACHE/'electric-categories.json').read_text(encoding='utf8'));pages={r['url']:pathlib.Path(r['file']).read_bytes() for r in records if r.get('file')}
more=set()
for url,raw in pages.items():
 for a in soup(raw).select('a[href*="PAGEN_1="]'):
  href=urllib.parse.urljoin(url,a['href']);m=re.search(r'PAGEN_1=(\d+)',href)
  if m and int(m[1])<=10 and urllib.parse.urlparse(href).path==urllib.parse.urlparse(url).path:more.add(href)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for url,raw in zip(sorted(more),pool.map(fetch,sorted(more))):
  if raw:pages[url]=raw
mapping={'elektroskutery':'Электроскутеры','elektrosamokaty':'Электросамокаты','elektrovelosipedy':'Электровелосипеды','passazhirskie_elektrotritsikly':'Пассажирские электротрициклы','gruzovye_elektrotritsikly':'Грузовые электротрициклы','elektrokvadrotsikly':'Электроквадроциклы','elektromototsikly':'Электромотоциклы'}
for url,raw in pages.items():
 s=soup(raw);category=next((v for k,v in mapping.items() if '/'+k+'/' in url),None)
 if not category:continue
 for c in s.select('.item_block,.product-card[data-entity=item]'):
  a=c.select_one('.item-title a,.product-card__img a');title=c.select_one('.item-title,.product-card__name')
  if not a or not title:continue
  name=txt(title.get_text(' ',strip=True));href=urllib.parse.urljoin(url,a['href'])
  if 'бензин' in name.lower():continue
  pe=c.select_one('.price_matrix_wrapper:not(.strike_block) [data-value],.product-card__price');price=float(pe['data-value']) if pe and pe.has_attr('data-value') else float(re.sub(r'[^0-9]','',pe.get_text()) or 0) if pe else None
  x=ensure(name,category,href,brand='White Siberia' if 'white-siberia' in url else None,price=price)
  specs=[]
  for li in c.select('.product-card__value li'):
   span=li.select_one('span')
   if span:
    value=txt(span.get_text(' ',strip=True));span.extract();specs.append({'name':txt(li.get_text(' ',strip=True)),'value':value,'source_url':href})
  x['specifications']=specs or x['specifications'];im=c.select_one('.image_wrapper_block img,.product-card__img img')
  if im:
   src=im.get('data-src') or im.get('src','')
   if src and not src.startswith('data:'):images[x['id']]=(urllib.parse.urljoin(url,src),href)
print('models',len(items),'image candidates',len(images),'pages',len(pages),flush=True)
# Download source-provided images unchanged; content-address filenames deduplicate models.
media=ROOT/'warehouse/equipment-media';media.mkdir(exist_ok=True)
manifest=CACHE/'image-downloads.json';downloads=json.loads(manifest.read_text()) if manifest.exists() else {}
def imagejob(pair):
 ident,(url,source)=pair
 if not url.startswith('https://'):return ident,None
 try:
  if url in downloads and (ROOT/downloads[url]['src']).exists():return ident,{**downloads[url],'source_url':source}
  op=urllib.request.build_opener(urllib.request.ProxyHandler({}));r=op.open(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20);raw=r.read(700001)
  if len(raw)>700000:raise ValueError('image above 700 KB; no resizing or arbitrary URL substitution')
  ext='jpg' if raw[:3]==b'\xff\xd8\xff' else 'png' if raw[:8]==b'\x89PNG\r\n\x1a\n' else 'webp' if raw[:4]==b'RIFF' and raw[8:12]==b'WEBP' else None
  if not ext:raise ValueError('unsupported image bytes')
  digest=hashlib.sha256(raw).hexdigest();rel='warehouse/equipment-media/'+digest[:24]+'.'+ext;(ROOT/rel).write_bytes(raw)
  entry={'src':rel,'original_url':url,'sha256':digest,'bytes':len(raw),'checked_at':DATE};downloads[url]=entry;return ident,{**entry,'source_url':source}
 except Exception as e:
  with lock:failures.append({'url':url,'error':str(e)})
  return ident,None
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for i,(ident,image) in enumerate(pool.map(imagejob,images.items())):
  if image:items[ident]['image']=image
  if i%50==0:print('photos',i,flush=True);manifest.write_text(json.dumps(downloads),encoding='utf8')
manifest.write_text(json.dumps(downloads),encoding='utf8')
for x in items.values():
 seen=set();x['specifications']=[v for v in x['specifications'] if v['name'] and v['value'] and len(v['name'])<180 and len(v['value'])<400 and not (v['name'].lower() in seen or seen.add(v['name'].lower()))]
used={x['image']['src'] for x in items.values() if x.get('image')}
# Keep only files referenced by the exact catalogue; no recursive operations.
for p in media.iterdir():
 if 'warehouse/equipment-media/'+p.name not in used:p.unlink()
data.update(checked_at=DATE,scope='electric-only',items=sorted(items.values(),key=lambda x:(x['category'],x['brand'].lower(),x['name'].lower())))
(ROOT/'warehouse/equipment-data.js').write_text('export const equipmentData='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
from collections import Counter
report={'checked_at':DATE,'models':len(items),'with_photos':sum(bool(x.get('image')) for x in items.values()),'with_specifications':sum(bool(x['specifications']) for x in items.values()),'categories':dict(Counter(x['category'] for x in items.values())),'media_bytes':sum(p.stat().st_size for p in media.iterdir()),'failures':failures}
(CACHE/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(report,ensure_ascii=False),flush=True)
