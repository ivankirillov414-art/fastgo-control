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
 if (['ready', 'issued'].includes(status) && !(values.parts||record.parts||[]).length && values.no_parts!==true && record.parts_status?.mode!=='none') required.push('parts');
 if (['ready', 'issued'].includes(status) && !values.quality_checked) required.push('quality');
 if (status === 'issued' && !String(values.handover_notes || '').trim()) required.push('handover');
 if (status === 'cancelled' && !String(values.note || '').trim()) required.push('cancel');
 return required;
}
