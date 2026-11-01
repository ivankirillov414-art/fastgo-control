// Missing purpose is the original intake protocol. Unknown purposes must never
// silently fall back to an intake sheet after the cloud dispatch boundary.
export function printDocumentType(job){
 const type=job.document_type??'master';
 if(!['master','completion'].includes(type)||type==='completion'&&job.kind!=='repair')throw Error('Неизвестный шаблон печати');
 return type;
}
