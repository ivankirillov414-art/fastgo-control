import json,base64,pathlib,subprocess
p=pathlib.Path('warehouse-release/latest.yml')
s=p.read_text()
name='FastGo-Warehouse-Setup-1.0.0-Windows-x64.exe'
s=s.replace(name,'https://github.com/'+__import__('os').environ['GH_REPO']+'/releases/download/fastgo-warehouse-v1.0.0/'+name)
repo=__import__('os').environ['GH_REPO'];url='repos/'+repo+'/contents/warehouse/update/latest.yml'
r=subprocess.run(['gh','api',url],capture_output=True,text=True)
old=json.loads(r.stdout) if r.returncode==0 else {}
body={'message':'Publish tested warehouse auto-update feed','content':base64.b64encode(s.encode()).decode()}
if old.get('sha'):body['sha']=old['sha']
pathlib.Path('/tmp/warehouse-feed.json').write_text(json.dumps(body))
subprocess.run(['gh','api','--method','PUT',url,'--input','/tmp/warehouse-feed.json'],check=True,stdout=subprocess.DEVNULL)
