/* Runs before the application bundle. Only the existing session key moves to Keystore. */
(function(){
 if(!window.FastGoBackup||typeof FastGoBackup.backupSession!=='function')return;
 var key='fastgo_workshop_session',storage=window.localStorage,original={get:Storage.prototype.getItem,set:Storage.prototype.setItem,remove:Storage.prototype.removeItem};
 var migrated=original.get.call(storage,key),secured=FastGoBackup.backupSession();
 if(!secured&&migrated){FastGoBackup.saveBackupSession(migrated);secured=FastGoBackup.backupSession();if(!secured)throw Error('Не удалось защитить сессию');}
 // An older plaintext session must not overwrite a newer background refresh.
 if(migrated)original.remove.call(storage,key);
 Storage.prototype.getItem=function(k){return this===storage&&k===key?(FastGoBackup.backupSession()||null):original.get.call(this,k);};
 Storage.prototype.setItem=function(k,v){if(this===storage&&k===key){FastGoBackup.saveBackupSession(String(v));return;}return original.set.call(this,k,v);};
 Storage.prototype.removeItem=function(k){if(this===storage&&k===key){FastGoBackup.saveBackupSession('');return;}return original.remove.call(this,k);};
 var pending={},sequence=0;
 window.fastgoNativeSessionResult=function(id,value){var p=pending[id];if(!p)return;delete pending[id];if(value.error)p.reject(Error(value.error));else p.resolve(value.session);};
 window.fastgoNativeRefreshSession=function(staleAccess){return new Promise(function(resolve,reject){var id=String(++sequence);pending[id]={resolve:resolve,reject:reject};FastGoBackup.refreshBackupSession(id,staleAccess||'');});};
 function statusButton(){if(document.getElementById('fastgo-backup-status'))return;var host=document.querySelector('.profile');if(!host)return;var button=document.createElement('button');button.id='fastgo-backup-status';button.className='btn ghost small';button.textContent='Резервные копии';button.onclick=function(){FastGoBackup.showBackupStatus();};host.appendChild(button);}
 new MutationObserver(statusButton).observe(document.documentElement,{subtree:true,childList:true});document.addEventListener('DOMContentLoaded',statusButton);
 // The mobile More menu can always open the same status, even while offline.
 document.addEventListener('click',function(e){if(!e.target.closest||!e.target.closest('#more-nav'))return;setTimeout(function(){var host=document.querySelector('[role="dialog"],dialog,.modal,.compact-panel,.more-menu');if(host&&!host.querySelector('[data-backup-status]')){var b=document.createElement('button');b.setAttribute('data-backup-status','');b.className='btn secondary';b.textContent='Резервные копии';b.onclick=function(){FastGoBackup.showBackupStatus();};host.appendChild(b);}},0);});
})();
