// Native fullscreen stays opt-in; ordinary browser and phone headers are unchanged.
export function installWindowControls({bar,native=window.fastgoWindow,document=window.document}={}){
 if(!bar||!native||bar.querySelector('[data-fastgo-window-controls]'))return;
 const style=document.createElement('style');style.textContent=`
 .fastgo-window-controls{display:flex;align-items:center;gap:4px;flex:0 0 auto;order:99;-webkit-app-region:no-drag}
 .fastgo-window-controls button{display:inline-flex;align-items:center;justify-content:center;flex:0 0 36px;width:36px;min-width:36px;min-height:30px;padding:5px!important;border:1px solid #334453;border-radius:6px;background:#0b121e;color:#e7f2fc;cursor:pointer;-webkit-app-region:no-drag}
 .fastgo-window-controls button:hover{background:#0873df}.fastgo-window-controls button:focus-visible{outline:2px solid #47bdff;outline-offset:2px}
 .fastgo-window-controls button svg{width:18px;height:18px;pointer-events:none}.fastgo-window-frame{display:flex;gap:4px}.fastgo-window-frame[hidden]{display:none}
 .fastgo-window-controls [data-window-action=close]:hover{background:#ad3041}
 body.fastgo-window-fullscreen #desktop-status:not(.desktop-status){left:0;width:100%;right:0}
 body.fastgo-window-fullscreen.warehouse-native-window header{padding-right:12px}
 @media print{.fastgo-window-controls{display:none!important}}
 `;document.head.append(style);
 const controls=document.createElement('div');controls.className='fastgo-window-controls';controls.setAttribute('data-fastgo-window-controls','');
 const icon=paths=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">'+paths+'</svg>';
 controls.innerHTML='<button type="button" data-window-action="toggle-fullscreen" aria-label="Полный экран (F11)" title="Полный экран (F11)" aria-pressed="false">'+icon('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>')+'</button><div class="fastgo-window-frame" hidden><button type="button" data-window-action="minimize" aria-label="Свернуть" title="Свернуть">'+icon('<path d="M5 16h14"/>')+'</button><button type="button" data-window-action="restore" aria-label="Вернуть окно" title="Вернуть окно">'+icon('<rect x="5" y="5" width="14" height="14"/>')+'</button><button type="button" data-window-action="close" aria-label="Закрыть" title="Закрыть">'+icon('<path d="m6 6 12 12M6 18 18 6"/>')+'</button></div>';
 bar.append(controls);
 let fullscreen=false;
 const update=state=>{if(!state)return;fullscreen=state.fullscreen===true;document.body.classList.toggle('fastgo-window-fullscreen',fullscreen);const button=controls.querySelector('[data-window-action=toggle-fullscreen]'),label=fullscreen?'Выйти из полного экрана (Esc)':'Полный экран (F11)';button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(fullscreen));controls.querySelector('.fastgo-window-frame').hidden=!fullscreen;};
 const action=async value=>{try{update(await native.command(value));}catch{/* Keep existing native frame and shortcuts available if IPC is closing. */}};
 controls.addEventListener('click',event=>{const button=event.target.closest('[data-window-action]');if(button)void action(button.dataset.windowAction);});
 // A modal keeps its existing Escape-to-close action; the next Escape exits fullscreen.
 const escape=event=>{if(event.key==='Escape'&&fullscreen&&!document.querySelector('dialog[open],[aria-modal="true"]')){event.preventDefault();event.stopPropagation();void action('exit-fullscreen');}};
 document.addEventListener('keydown',escape,true);
 const stop=native.onChanged(update);void native.state().then(update).catch(()=>{});
 return ()=>{stop();document.removeEventListener('keydown',escape,true);controls.remove();style.remove();document.body.classList.remove('fastgo-window-fullscreen');};
}
