import {pickupCode,REPAIR_PICKUP_ROLES} from '../_shared/parts-pickup-code.js';
const fail=(message,status)=>{throw Object.assign(new Error(message),{status});};
const id=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// The caller authenticates the account; getRepair retains normal card access checks.
// The account is an audit requester, never an assigned repair worker or stock holder.
export async function requestRepairPickup(params,{storageMode,member,actorId,getRepair,key}){
 if(member?.active===false||!REPAIR_PICKUP_ROLES.includes(member?.role)||!id(actorId))fail('Нет доступа к ремонту',403);
 if(storageMode!=='postgres'||params.kind!=='repair'||!id(params.id))fail('Откройте рабочий ремонт',400);
 const repair=await getRepair(params.id);
 if(!repair||repair.id!==params.id)fail('Ремонт не найден',404);
 if(['ready','issued','cancelled'].includes(repair.status))fail('Ремонт уже готов или закрыт',409);
 return pickupCode({...repair,requested_by:actorId,pickup_scope:'repair'},key);
}
