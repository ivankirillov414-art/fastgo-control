// A downloaded installer may wait indefinitely; losing a form is never acceptable.
export function installUpdateSafety({window,document,now=()=>Date.now()}){
 let lastInteraction=now(),locked=false;
 for(const event of ['pointerdown','keydown','input','change','wheel','hashchange'])window.addEventListener(event,()=>{lastInteraction=now();},true);
 const reason=(immediate=false)=>{
  if(locked)return 'Подготавливаем перезапуск';
  if(typeof window.fastgoHasUnsavedChanges!=='function')return 'Дожидаемся загрузки приложения';
  if(window.fastgoHasUnsavedChanges())return 'Сохраните изменения в карточке и дождитесь загрузки файлов';
  const route=(window.location.hash.slice(1)||'home').split('?')[0];
  if(!['home','repairs','storage','preorders','staff',...(immediate?['order']:[])].includes(route))return 'Завершите работу на этой странице и откройте главную';
  if(document.querySelector('dialog[open]:not(#desktop-update-progress),.modal'))return 'Закройте открытое окно редактирования';
  if(document.activeElement?.matches('input,textarea,select,[contenteditable]')&&!document.activeElement.closest?.('.preorder-filters'))return 'Завершите ввод в поле';
  if(!immediate&&now()-lastInteraction<120000)return 'Ожидаем две минуты бездействия';
  return '';
 };
 const safe=(immediate=false)=>!reason(immediate);
 window.fastgoUpdateBlockReason=reason;
 window.fastgoUpdateSafe=safe;
 window.fastgoLockForUpdate=(immediate=false)=>{if(!safe(immediate))return false;locked=true;document.body.inert=true;return true;};
 window.fastgoReleaseUpdateLock=()=>{if(locked){locked=false;document.body.inert=false;lastInteraction=now();}};
 return {safe};
}
