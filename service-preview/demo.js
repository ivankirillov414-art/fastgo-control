// Visual review only. Sessions and operations remain in memory inside this frame.
(() => {
const data=new Map(),storage={getItem:k=>data.get(String(k))??null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size;}};
Object.defineProperty(window,'localStorage',{value:storage,configurable:true});Object.defineProperty(window,'sessionStorage',{value:storage,configurable:true});
const stage=new URLSearchParams(location.search).get('stage')||'accepted',master='11111111-1111-4111-8111-111111111111';
const role=['intake','payment','handover','issued'].includes(stage)?'receiver':'mechanic';
storage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'preview-only',user_id:master,expires_at:4102444800}));window.print=()=>{};
const stages={accepted:'accepted',intake:'accepted',diagnostics:'diagnostics',repair:'repair',parts:'repair',pickup:'repair','order-part':'repair',waiting:'waiting_parts',finish:'repair',ready:'ready',payment:'ready',handover:'ready',issued:'issued'},status=stages[stage]||'accepted',advanced=!['accepted','diagnostics'].includes(status),finished=['ready','issued'].includes(status),withParts=['finish','ready','payment','handover','issued'].includes(stage);
const services=[['steering','Регулировка рулевой стойки',1000],['brakes','Настройка тормозов',500],['diagnostics','Диагностика электроники',800],['tire','Замена камеры и покрышки',700],['bearing','Замена подшипников',1200],['controller','Замена контроллера',1500],['wiring','Восстановление проводки',1000],['chain','Регулировка переключения передач',600]].map(([id,title,labor_price])=>({id,title,labor_price,active:true}));
const record={id:'demo-repair',repair_number:1042,revision:1,status,brand:'Kugoo',model:'M4 Pro',equipment_name:'Kugoo M4 Pro',last_name:'Иванов',first_name:'Алексей',phone:'+79990000000',created_at:'2026-10-28T08:30:00Z',promised_date:'2026-10-30',issue_description:'Люфт рулевой стойки, требуется настройка тормозов',condition_notes:'Следы эксплуатации на деке. Дисплей и рама целые.',accessories:'Самокат, зарядное устройство',serial_number:'DEMO-1042',assigned_master_id:master,assigned_master_name:'Алексей Иванов',master_first_name:'Алексей',works:advanced?[{catalog_id:'steering',name:'Регулировка рулевой стойки',quantity:1,price:1000},{catalog_id:'brakes',name:'Настройка тормозов',quantity:1,price:500}]:[],parts:withParts?[{catalog_id:'cable',name:'Тормозной трос',quantity:1,price:350,tsd_issue_id:'demo-issue'}]:[],parts_status:{mode:withParts?'issued':'none'},quality_checked:finished,paid_amount:['handover','issued'].includes(stage)?1850:0,total_amount:advanced?(withParts?1850:1500):0,fault_photo_paths:[],signed_document_paths:[],step_state:{waiting_part:status==='waiting_parts'?'Тормозной трос':'',waiting_due:status==='waiting_parts'?'2026-11-02':'',master_comment:['finish','ready','payment','handover','issued'].includes(stage)?'Рулевая стойка закреплена, тормоза настроены. Проведён тестовый проезд.':'',...(finished?{completion_request_id:'22222222-2222-4222-8222-222222222222',completed_at:'2026-10-28T12:00:00Z',master_first_name:'Алексей'}:{})}};
const events=[{id:'demo-event',created_at:record.created_at,action:'create',actor_name:'Приёмщик',details:'Техника принята в ремонт'}],payments=[],receipts=new Map();
const me={profile_id:master,role,name:'Алексей Иванов',active:true,backend:'POSTGRES_GOOGLE_MIRROR',status_permissions:{can_mark_ready:true,can_issue:role!=='mechanic',can_cancel:role!=='mechanic'}};
function simulate(action,p={}){
 switch(action){
 case 'request_access':return {active:true};
 case 'me':return me;
 case 'catalog':return {services,parts:[{id:'cable',name:'Тормозной трос',retail_price:350,quantity:8,active:true},{id:'tube',name:'Камера 10 дюймов',retail_price:600,quantity:5,active:true}],staff:[{id:master,profile_id:master,name:'Алексей Иванов',role:'mechanic',active:true}],categories:[]};
 case 'get':return {record,events,payments,linked:[],legal:{}};
 case 'list':return {items:[record],count:1};
 case 'customers':return [];
 case 'create':Object.assign(record,p,{id:'demo-repair',repair_number:1042,status:'accepted'});return record;
 case 'update':{
  if(receipts.has(p.request_id))return receipts.get(p.request_id);
  if(p.step_flow){const next={diagnose:'diagnostics',save_works:p.works?.length?'repair':record.status,wait_parts:'waiting_parts',complete:'ready',handover:'issued'}[p.flow_action];if(p.flow_action==='save_works'&&record.status==='waiting_parts')p.status='waiting_parts';else if(next)p.status=next;
   if(p.flow_action==='wait_parts')Object.assign(record.step_state,{waiting_part:p.waiting_part,waiting_due:p.waiting_due});
   if(p.master_comment!==undefined)record.step_state.master_comment=p.master_comment;
   if(p.flow_action==='complete')Object.assign(record.step_state,{completion_request_id:p.request_id,completed_at:new Date().toISOString(),master_first_name:'Алексей'});
  }
  Object.assign(record,p,{revision:record.revision+1});record.total_amount=[...record.works,...record.parts].reduce((n,x)=>n+Number(x.price)*Number(x.quantity),0);if(p.no_parts)record.parts_status={mode:'none'};
  const result=structuredClone(record);receipts.set(p.request_id,result);return result;
 }
 case 'parts_pickup':return {code:'FGPARTS1.DEMONSTRATION_ONLY.NOT_A_REAL_TICKET',number:1042,vehicle:'Kugoo M4 Pro',master_name:'Алексей'};
 case 'payment':if(role==='mechanic')throw Error('Оплату принимает приёмщик');record.paid_amount+=Number(p.amount);payments.push(p);return {id:'demo-payment',...p};
 case 'legal':return {};
 case 'overview':return {repairs:1,ready:finished?1:0,overdue:0,storage:0,storage_due:0,debt:record.total_amount-record.paid_amount,today_payments:0};
 default:return {};
 }
}
const originalFetch=window.fetch.bind(window);window.fetch=async(input,init={})=>{const url=new URL(input?.url||input,location.href);if(url.hostname.endsWith('.supabase.co')){let body={};try{body=JSON.parse(init.body||'{}');}catch{}let result;try{if(url.pathname.includes('fastgo-print-api'))result={enabled:true,id:'demo-print'};else if(url.pathname.includes('fastgo-repair-status'))result={token:'DEMO_PREVIEW_ONLY'};else result=simulate(body.action,body.params);return new Response(JSON.stringify({data:result}),{headers:{'Content-Type':'application/json'}});}catch(e){return new Response(JSON.stringify({error:e.message}),{status:400,headers:{'Content-Type':'application/json'}});}}if(url.origin!==location.origin)throw Error('Во внешнем запросе нет необходимости для демонстрации');return originalFetch(input,init);};
})();
