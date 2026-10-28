// Photo writes do not change balances, prices, statuses or other cards.
export function mediaChange(action,p={}){
 if(['part_photo_upload','part_photo_primary'].includes(action)&&p.part_id)return {scope:'media',part_id:p.part_id};
 return null;
}
export function mediaReadMatches(key,change){
 let read;try{read=JSON.parse(key);}catch{return false;}
 const p=read.params||{};
 if(change.part_id)return read.action==='catalog'||['part_photos','part_photo_url'].includes(read.action)&&(p.part_id===change.part_id||!!p.category);
 return false;
}
