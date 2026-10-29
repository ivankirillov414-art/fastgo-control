import {nativeNoticeSession} from './core.js';
let actor='',timer;
export function startStaffNotices(me){
 const id=me?.profile_id||me?.id;if(!id||typeof window.FastGoPhone?.configureNotices!=='function')return;
 const configure=()=>{try{const s=nativeNoticeSession();if(s?.actor_id===id)window.FastGoPhone.configureNotices(JSON.stringify(s));}catch{}};
 if(actor===id)return;stopStaffNotices(false);actor=id;configure();timer=setInterval(configure,60000);
}
export function stopStaffNotices(clear=true){clearInterval(timer);timer=null;actor='';if(clear)try{window.FastGoPhone?.clearNotices?.();}catch{}}
window.addEventListener('workshop-session-cleared',()=>stopStaffNotices());
