import datetime,glob,hashlib,json,os,pathlib,re,subprocess,urllib.request
expected='08c6c93c5fde9b47ee30fd0c818cb44340115122f34df8d2b00321cbccab68c9'
certificate='26f79b6746e6b6a93e5f4a8d6630cffb65332669e2c555b36e38f40a4f0ec1f3'
source=os.environ['PUBLIC_SOURCE'];repo='ivankirillov414-art/fastgo-control';relative='warehouse-android/phone/release/FastGo-Android-1.0.17.apk'
roots={'raw':'https://raw.githubusercontent.com/'+repo+'/main/','pages':'https://ivankirillov414-art.github.io/fastgo-control/'}
url=roots[source]+relative if source!='release' else 'https://github.com/'+repo+'/releases/download/fastgo-android-v1.0.17/FastGo-Android-1.0.17.apk'
local=pathlib.Path(relative);assert hashlib.sha256(local.read_bytes()).hexdigest()==expected
jars=glob.glob(os.environ['ANDROID_HOME']+'/build-tools/**/apksigner.jar',recursive=True);assert jars
verification=subprocess.run(['java','-jar',sorted(jars)[-1],'verify','--verbose','--print-certs',str(local)],capture_output=True,text=True,check=True).stdout
assert certificate in verification and re.search(r'Verified using v2 scheme.*true',verification)
digest=hashlib.sha256();count=0
with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'FastGo-Public-Readback-CI'}),timeout=60) as response:
 assert response.status==200
 while True:
  chunk=response.read(1024*1024)
  if not chunk:break
  count+=len(chunk);assert count<=40*1024*1024;digest.update(chunk)
assert count==32929865 and digest.hexdigest()==expected
feed_url=roots['pages' if source=='pages' else 'raw']+'warehouse-android/phone/update.json'
with urllib.request.urlopen(feed_url+'?verify='+os.environ['GITHUB_RUN_ID'],timeout=30) as response:feed=json.load(response)
assert feed['versionCode']==18 and feed['versionName']=='1.0.17' and feed['sha256']==expected
r={'status':'PASS','source':source,'url':url,'sha256':expected,'bytes':count,'certificate_sha256':certificate,'certificate_verification':'Exact streamed public SHA equals locally verified signed APK; v2 signature and production certificate verified with apksigner.','feed_url':feed_url,'feed':feed,'run':int(os.environ['GITHUB_RUN_ID']),'source_commit':os.environ['GITHUB_SHA'],'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'apk_saved_or_uploaded_as_artifact':False}
pathlib.Path('public-readback.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
