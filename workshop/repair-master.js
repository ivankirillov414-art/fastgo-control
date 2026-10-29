import {api,esc} from './core.js';

// Assignment is a guided step for owners; a mechanic takes an unassigned repair themselves.
export async function ensureRepairMaster(ctx,record){
 if(record.assigned_master_id)return record;
 if(ctx.me.role==='mechanic')return api('update',{kind:'repair',id:record.id,revision:record.revision,step_flow:true,flow_action:'save_comment',assigned_master_id:ctx.me.profile_id||ctx.me.id,request_id:crypto.randomUUID()});
 const staff=(await ctx.catalog(true)).staff.filter(x=>x.active===true&&x.role==='mechanic');
 let saved=null;
 return new Promise(resolve=>{
  ctx.modal('Назначить мастера',`<p>Выберите, кто выполняет этот ремонт. Назначение сохранится в карточке.</p>${staff.length?`<label>Мастер ремонта<select name="assigned_master_id" required><option value="">Выбрать мастера</option>${staff.map(x=>`<option value="${esc(x.profile_id||x.id)}">${esc(x.name)}</option>`).join('')}</select></label>`:'<p role="status">Активных мастеров пока нет. Добавьте или включите сотрудника в разделе «Сотрудники».</p>'}`,
   staff.length?async values=>{saved=await api('update',{kind:'repair',id:record.id,revision:record.revision,step_flow:true,flow_action:'save_comment',assigned_master_id:values.assigned_master_id,request_id:crypto.randomUUID()});}:null,
   ()=>{const dialog=document.getElementById('dialog');dialog.addEventListener('close',()=>resolve(saved),{once:true});const submit=dialog.querySelector('button[type=submit]');if(submit)submit.textContent='Назначить мастера';});
 });
}
