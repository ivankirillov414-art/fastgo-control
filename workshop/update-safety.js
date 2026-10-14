// A downloaded installer may wait indefinitely; losing a form is never acceptable.
export function installUpdateSafety({window,document,now=()=>Date.now()}){
 let lastInteraction=now(),locked=false;
 for(const event of ['pointerdown','keydown','input','change','wheel','hashchange'])window.addEventListener(event,()=>{lastInteraction=now();},true);
 const safe=(immediate=false)=>!locked&&typeof window.fastgoHasUnsavedChanges==='function'&&!window.fastgoHasUnsavedChanges()&&
  (immediate||now()-lastInteraction>=120000)&&['home','repairs','storage'].includes((window.location.hash.slice(1)||'home').split('?')[0])&&
  !document.querySelector('dialog[open],.modal')&&!document.activeElement?.matches('input,textarea,select,[contenteditable]');
 window.fastgoUpdateSafe=safe;
 window.fastgoLockForUpdate=(immediate=false)=>{if(!safe(immediate))return false;locked=true;document.body.inert=true;return true;};
 window.fastgoReleaseUpdateLock=()=>{if(locked){locked=false;document.body.inert=false;lastInteraction=now();}};
 return {safe};
}
