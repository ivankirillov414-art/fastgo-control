"""Apply the reviewed cutover changes; run from repository root in CI."""
from pathlib import Path
import shutil
root=Path('.')
def change(path,old,new):
    p=root/path
    text=p.read_text()
    if old not in text:
        if new in text:return
        raise RuntimeError('Expected source marker absent: '+path+' '+old[:50])
    p.write_text(text.replace(old,new),encoding='utf-8')
# Import the inventory UI already built on the migration branch, not unrelated projects.
migration=Path('../migration/workshop')
for p in migration.glob('inventory-*'):
    shutil.copy2(p,root/'workshop'/p.name)
change('workshop/core.js','AbortSignal.timeout(40000)','AbortSignal.timeout(120000)')
change('workshop/orders.js',"{kind,id,content_type:q.file.type", "{kind,id,slot,content_type:q.file.type")
change('workshop/orders.js',"await api('documents',{kind,id,slot,paths:[q.path]});q.attached=true;", "q.attached=true; /* Attached by the Google gateway. */")
change('workshop/app.js','Мастерская / ${esc(nav.find', 'Google Sheets · Мастерская / ${esc(nav.find')
# Notify auxiliary modules on explicit logout as well as token expiry.
change('workshop/core.js',"localStorage.removeItem('fastgo_token');}","localStorage.removeItem('fastgo_token');window.dispatchEvent(new Event('workshop-session-cleared'));}")
for name in ['inventory-ui.js','inventory-launcher.js']:
    p=root/'workshop'/name
    text=p.read_text().replace("window.addEventListener('workshop-auth-required',", "window.addEventListener('workshop-session-cleared',")
    p.write_text(text)
# Preserve a request ID while retrying the same sale, so a timeout cannot double-sell.
change('workshop/inventory-ui.js','const cart=new Map();',"const cart=new Map();\nlet pendingSale=null;")
change('workshop/inventory-ui.js',"try{const result=await api('sale',{request_id:crypto.randomUUID(),payment_method:$('sale-payment').value,note:$('sale-note').value,items:[...cart.values()].map(x=>({part_id:x.part.id,quantity:x.qty}))});cart.clear();", "try{const payload={payment_method:$('sale-payment').value,note:$('sale-note').value,items:[...cart.values()].map(x=>({part_id:x.part.id,quantity:x.qty}))};const signature=JSON.stringify(payload);if(!pendingSale||pendingSale.signature!==signature)pendingSale={signature,id:crypto.randomUUID()};const result=await api('sale',{request_id:pendingSale.id,...payload});pendingSale=null;cart.clear();")
change('workshop/inventory-ui.js',"$('receipt-save').onclick=async()=>{", "const receiptId=crypto.randomUUID();\n  $('receipt-save').onclick=async()=>{")
change('workshop/inventory-ui.js',"note:String(f.get('note')||'Приёмка по штрих-коду'),request_id:crypto.randomUUID()", "note:String(f.get('note')||'Приёмка по штрих-коду'),request_id:receiptId")
# Do not offer the migration script's unsafe public product-photo upload.
change('workshop/inventory-ui.js','name="photo" type="file"','name="photo" disabled type="file"')
change('workshop/inventory-ui.js','name="category_primary" type="checkbox"','name="category_primary" disabled type="checkbox"')
change('workshop/inventory-ui.js','<label>Основное фото<input','<p class="muted">Фото товарных карточек временно недоступны. Фото клиентских приёмок сохраняются приватно на Drive.</p><label>Основное фото<input')
# Restore the sales dialog after scanner cancellation; stop a late-opened camera.
change('workshop/inventory-ui.js',"if(!done)$('scan-status').textContent='Камера активна';", "if(done){controls?.stop();}else $('scan-status').textContent='Камера активна';")
change('workshop/inventory-ui.js',"const code=await scanCode('Сканирование продажи');if(!code)return;", "const code=await scanCode('Сканирование продажи');if(!code){await openSales();return;}")
change('workshop/inventory-launcher.js',"if(!document.querySelector('.shell'))return;", "if(!document.querySelector('.shell')){role=null;document.getElementById('inventory-sale-fab')?.remove();return;}")
# Include warehouse/checkout tools with versioned entry points.
html=(root/'workshop.html').read_text()
for css in ['inventory-ui.css','inventory-launcher.css']:
    marker='workshop/'+css
    if marker not in html:html=html.replace('</head>',f'<link rel="stylesheet" href="{marker}?v=google-20260912"></head>')
for js in ['inventory-ui.js','inventory-import.js','inventory-launcher.js']:
    marker='workshop/'+js
    if marker not in html:html=html.replace('</head>',f'<script type="module" src="{marker}?v=google-20260912"></script></head>')
html=html.replace('src="workshop/app.js"','src="workshop/app.js?v=google-20260912"')
(root/'workshop.html').write_text(html)
# Syntax-check every changed browser module before the generated commit is published.
import subprocess
for p in (root/'workshop').glob('*.js'):subprocess.run(['node','--check',str(p)],check=True)
