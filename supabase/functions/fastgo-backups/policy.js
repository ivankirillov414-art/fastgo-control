export const policy={version:2,retention_days:7,time_zone:'Asia/Yekaterinburg',max_bytes:512*1024*1024};
export function backupDay(time){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:policy.time_zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time));
 const value=type=>parts.find(x=>x.type===type).value;
 return `${value('year')}-${value('month')}-${value('day')}`;
}
// Legacy archives are not relabelled as full-project, verified daily backups.
export function dailyHistory(rows){
 const seen=new Set();return [...rows].filter(x=>x.completed_at&&x.backup_day&&x.manifest?.policy_version===2)
 .sort((a,b)=>b.backup_day.localeCompare(a.backup_day)||b.created_at.localeCompare(a.created_at))
 .filter(x=>{if(seen.has(x.backup_day))return false;seen.add(x.backup_day);return true;}).slice(0,policy.retention_days);
}
export function summary(snapshot){return {id:snapshot.id,day:snapshot.backup_day,created_at:snapshot.created_at,completed_at:snapshot.completed_at,source_version:snapshot.source_version,sha256:snapshot.sha256,bytes:snapshot.bytes,key_id:snapshot.key_id,media_expected:snapshot.manifest.media.length};}
export function retentionPlan(rows,media){
 const retained=dailyHistory(rows);if(retained.length<policy.retention_days)return {retained,expired:[],media:[]};
 const oldest=retained.at(-1).backup_day,keep=new Set(retained.map(x=>x.id));
 // Do not discard an incomplete/new-day archive, even if it missed its date.
 const expired=rows.filter(x=>!keep.has(x.id)&&x.created_at<retained[0].created_at&&(!x.backup_day||x.backup_day<oldest||x.completed_at));
 const remove=new Set(expired.map(x=>x.id));
 const referenced=new Set(rows.filter(x=>!remove.has(x.id)).flatMap(x=>x.manifest.media.map(f=>f.id)));
 return {retained,expired,media:media.filter(x=>!referenced.has(x.id))};
}
