export const LABELS_PER_SHEET=24;
export function labelRows(parts,received=false){
  const rows=new Map();
  for(const part of parts){
    if(!part.barcode)continue;
    const key=String(part.id||part.barcode),quantity=received?Number(part.quantity):1;
    if(rows.has(key)){if(received)rows.get(key).quantity+=quantity;continue;}
    rows.set(key,{part,key,selected:received,quantity});
  }
  return [...rows.values()];
}
export function labelJobs(rows){
  const jobs=rows.filter(x=>x.selected);
  if(!jobs.length)throw new Error('Выберите хотя бы один товар');
  for(const x of jobs)if(!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>10000)throw new Error('Количество этикеток должно быть целым числом от 1 до 10 000');
  if(jobs.reduce((n,x)=>n+x.quantity,0)>10000)throw new Error('За один раз можно напечатать не более 10 000 этикеток');
  return jobs;
}
export function labelDocument(labels,format='a4'){
  const a4=format==='a4',pages=[];
  if(a4)for(let i=0;i<labels.length;i+=LABELS_PER_SHEET)pages.push(`<section class="sheet">${labels.slice(i,i+LABELS_PER_SHEET).join('')}</section>`);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Этикетки FastGo</title><style>@page{size:${a4?'A4':'58mm 30mm'};margin:${a4?'10mm':'0'}}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.sheet{display:grid;grid-template-columns:repeat(3,58mm);grid-auto-rows:30mm;gap:2mm;break-after:page}.sheet:last-child{break-after:auto}.label{width:58mm;height:30mm;padding:2mm;display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden;break-inside:avoid;${a4?'':'break-after:page'}}.label:last-child{break-after:auto}.name{font-size:9pt;font-weight:700;text-align:center;line-height:1.05;max-height:8mm;overflow:hidden}.meta{font-size:7pt;margin:1mm 0}svg{width:54mm;height:14mm;flex-shrink:0}</style></head><body>${a4?pages.join(''):labels.join('')}<script>onload=()=>setTimeout(()=>print(),150);<\/script></body></html>`;
}
