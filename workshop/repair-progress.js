// Keep the available actions aligned with the server's repair workflow.
const transitions = {
 accepted: ['diagnostics', 'cancelled'],
 diagnostics: ['repair', 'waiting_parts', 'cancelled'],
 waiting_parts: ['repair', 'diagnostics', 'cancelled'],
 repair: ['ready', 'waiting_parts', 'diagnostics', 'cancelled'],
 ready: ['issued', 'repair', 'cancelled'],
};
export const repairActionLabels = {
 diagnostics: 'Начать диагностику', repair: 'Начать ремонт',
 waiting_parts: 'Ждём запчасти', ready: 'Ремонт готов',
 issued: 'Выдать клиенту', cancelled: 'Отменить ремонт',
};
export function repairActions(status, permissions = {}) {
 const rights = {ready: 'can_mark_ready', issued: 'can_issue', cancelled: 'can_cancel'};
 return (transitions[status] || []).filter(next => !rights[next] || permissions[rights[next]]);
}
export function repairAmount(values) {
 if(values.total_override!==null&&values.total_override!==undefined)return Number(values.total_override);
 return [...(values.works || []), ...(values.parts || [])]
  .reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 1), 0)-Number(values.discount||0);
}
const partReference=line=>typeof(line?.part_id||line?.id)==='string'?String(line.part_id||line.id).trim():'';
const validLinkedPart=line=>partReference(line)&&typeof line.quantity!=='boolean'&&Number.isSafeInteger(Number(line.quantity))&&Number(line.quantity)>0;
export function repairPartsCondition(record,values={}){
 const saved=(Array.isArray(record.parts)?record.parts:[]).filter(validLinkedPart),selected=Array.isArray(values.parts)?values.parts:saved;
 // A proposed line cannot prove that stock was issued. Only persisted repair
 // allocations count, including valid allocations made by older app versions.
 const linked=selected.filter(line=>validLinkedPart(line)&&saved.some(old=>partReference(old)===partReference(line)&&Number(old.quantity)===Number(line.quantity)&&String(old.tsd_issue_id||'')===String(line.tsd_issue_id||'')));
 const sameMaster=String(values.assigned_master_id??record.assigned_master_id??'')===String(record.assigned_master_id||'');
 const none=values.no_parts===true||(!Object.hasOwn(values,'no_parts')&&!values.reopen_reason&&sameMaster&&record.parts_status?.mode==='none');
 return {mode:linked.length?'issued':none?'none':'pending',quantity:linked.reduce((sum,line)=>sum+Number(line.quantity),0)};
}
export function repairNoPartsAllowed(record,actor,values={}){
 const master=String(values.assigned_master_id??record.assigned_master_id??'');
 return ['owner','developer'].includes(actor?.role)||!!master&&actor?.profile_id===master||actor?.role==='mechanic'&&!master;
}
// Request missing information in the same dialog as the action, instead of
// requiring the user to discover fields in other collapsed panels.
export function repairRequirements(record, values) {
 const status = values.status, required = [], amount = repairAmount(values);
 if (['waiting_parts', 'repair', 'ready', 'issued'].includes(status) && !String(values.diagnostics_notes || '').trim()) required.push('diagnostics');
 const approved = record.approved_amount !== null && record.approved_amount !== undefined
  && record.approved_amount !== '' && Number.isFinite(Number(record.approved_amount))
  && Math.abs(Number(record.approved_amount) - amount) < .005;
 if ((['repair', 'ready', 'issued'].includes(status) && amount > 0 && !approved && !values.approve)
  || (values.approve && !String(values.approval_note || '').trim())) required.push('approval');
 if (['ready', 'issued'].includes(status) && status!==record.status && repairPartsCondition(record,values).mode==='pending') required.push('parts');
 if (['ready', 'issued'].includes(status) && !values.quality_checked) required.push('quality');
 if (status === 'issued' && !String(values.handover_notes || '').trim()) required.push('handover');
 if (status === 'cancelled' && !String(values.note || '').trim()) required.push('cancel');
 return required;
}
