let pending=0;
export const uploadsPending=()=>pending>0;
export function uploadStatus(host){
 host.classList.add('photo-upload-status');host.setAttribute('role','status');
 host.setAttribute('aria-live','polite');
 const label=document.createElement('span'),bar=document.createElement('progress');
 bar.setAttribute('aria-label','Загрузка фотографии');host.replaceChildren(label,bar);
 return {
  show(text){host.hidden=false;label.textContent=text;},
  busy(text){host.dataset.state='busy';bar.hidden=false;bar.removeAttribute('value');this.show(text);},
  done(text='Фотографии сохранены'){host.dataset.state='done';bar.hidden=true;this.show(text);},
  error(text){host.dataset.state='error';bar.hidden=true;this.show(text);}
 };
}
export function holdUpload(container){
 pending++;container?.setAttribute('aria-busy','true');
 const controls=[...(container?.querySelectorAll('button,input,select')||[])].map(el=>[el,el.disabled]);
 controls.forEach(([el])=>el.disabled=true);
 const cancel=e=>e.preventDefault();container?.addEventListener('cancel',cancel);
 let finished=false;
 return ()=>{if(finished)return;finished=true;pending--;container?.removeAttribute('aria-busy');container?.removeEventListener('cancel',cancel);controls.forEach(([el,disabled])=>el.disabled=disabled);};
}
