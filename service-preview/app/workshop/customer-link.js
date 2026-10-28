import {BASE} from './core.js';
export async function customerRepairLink(id){
 let session;try{session=JSON.parse(localStorage.getItem('fastgo_workshop_session')||'null');}catch{}
 const token=session?.access_token||localStorage.getItem('fastgo_token');
 if(!token)throw new Error('Войдите снова, чтобы напечатать клиентский QR');
 const response=await fetch(BASE+'/functions/v1/fastgo-repair-status',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'issue',id}),signal:AbortSignal.timeout(30000)});
 const result=await response.json();if(!response.ok||!result.data?.token)throw new Error(result.error||'Не удалось создать клиентский QR');
 const url=new URL('https://ivankirillov414-art.github.io/fastgo-control/repair-status.html');url.hash=result.data.token;return url.href;
}
