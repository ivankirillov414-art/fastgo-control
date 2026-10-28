export function scanError(kind,code){
 if(!kind)return 'Сначала выберите раздел сканирования';
 const value=String(code||'').trim(),link=/^[a-z][a-z0-9+.-]*:/i.test(value)||/^www\./i.test(value),pickup=value.startsWith('FGPARTS1.');
 if(!value)return 'Проверьте код';
 if(kind==='repair'){try{const u=new URL(value);if(u.protocol==='https:'&&u.hostname==='ivankirillov414-art.github.io'&&!u.username&&!u.password&&(u.pathname==='/fastgo-control/repair-status.html'||u.pathname==='/fastgo-control/workshop.html'&&u.hash.startsWith('#order?')&&u.hash.includes('kind=repair')))return '';}catch{}return 'В оплате ремонта сканируйте только QR ремонта';}
 if(kind==='parts')return pickup||!link?'':'Откройте раздел «Оплата ремонта»';
 if(!['receipt','sale'].includes(kind))return 'Сначала выберите раздел сканирования';
 return pickup?'QR мастера принимается только в выдаче запчастей':link?'В этом разделе сканируйте штрихкод товара. Для QR ремонта откройте «Оплата ремонта»':'';
}
