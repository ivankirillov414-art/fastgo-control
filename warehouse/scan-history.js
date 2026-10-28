// Buffer edits happen before a sale or parts issue; USB acknowledgements stay intact.
export function rememberScan(draft,partId){
 draft.scan_history=[...(Array.isArray(draft.scan_history)?draft.scan_history:[]),partId].slice(-1000);
}
export function lastBufferedScan(draft){
 return [...(Array.isArray(draft?.scan_history)?draft.scan_history:[])].reverse().find(id=>draft.items.some(x=>x.part_id===id&&Number.isSafeInteger(x.quantity)&&x.quantity>0))||'';
}
export function editScanBuffer(draft,removePart){
 if(!draft||draft.kind!=='sale'||draft.pickup)throw Error('Этот буфер нельзя изменить');
 const id=removePart||lastBufferedScan(draft),item=draft.items.find(x=>x.part_id===id);
 if(!item)return null;
 if(!Number.isSafeInteger(item.quantity)||item.quantity<1)throw Error('Проверьте количество товара');
 const history=Array.isArray(draft.scan_history)?[...draft.scan_history]:[];
 if(removePart){for(let i=history.length-1;i>=0;i--)if(history[i]===id)history.splice(i,1);}
 else history.splice(history.lastIndexOf(id),1);
 const next={...draft,items:draft.items.map(x=>x.part_id!==id?{...x}:!removePart&&x.quantity>1?{...x,quantity:x.quantity-1}:null).filter(Boolean),scan_history:history};
 next.last_part_id=lastBufferedScan(next)||next.items[next.items.length-1]?.part_id||'';
 return next;
}
