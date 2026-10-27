// One listener set per window, shared by service and warehouse entry points.
// visualViewport accounts for the phone keyboard without locking the page body.
const key=Symbol.for('fastgo.viewport-layout');
export function installViewportLayout({header=null}={}){
 const win=window,root=document.documentElement;
 if(win[key]){if(header)win[key].observeHeader(header);win[key].update();return win[key].dispose;}
 let frame=0,observer=null,observedHeader=null,disposed=false;
 const set=(name,value)=>{if(root.style.getPropertyValue(name)!==value)root.style.setProperty(name,value);};
 function update(){
  if(disposed)return;if(frame){win.cancelAnimationFrame(frame);frame=0;}
  // Pinch zoom also shrinks visualViewport; let the browser pan normally in that case.
  const viewport=win.visualViewport,useVisual=viewport&&Math.abs((viewport.scale||1)-1)<.05;
  const height=Math.round((useVisual&&viewport.height)||win.innerHeight),top=useVisual?Math.max(0,Math.round(viewport.offsetTop||0)):0;
  const constrained=height<win.innerHeight-80;
  if(height>0){set('--fastgo-viewport-height',height+'px');set('--fastgo-viewport-top',top+'px');if(constrained)root.setAttribute('data-fastgo-visual-constrained','');else root.removeAttribute('data-fastgo-visual-constrained');}
  if(observedHeader?.isConnected)set('--warehouse-header-height',Math.ceil(observedHeader.getBoundingClientRect().height)+'px');
  // A fixed modal cannot rely on the document's automatic keyboard scroll.
  // Scroll only its own content, preserving the surrounding desktop/page position.
  const active=document.activeElement,panel=active?.closest?.('dialog[open],.compact-panel-body.is-open,.repair-pane-body');
  if(constrained&&panel&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)){
   const bounds=panel.getBoundingClientRect(),toolbar=panel.querySelector('.product-dialog-toolbar');
   const lower=Math.min(bounds.bottom,top+height)-20,upper=Math.max(bounds.top,top)+(toolbar?.getBoundingClientRect().height||12);
   const editor=active.closest('.metric-editor')?.getBoundingClientRect(),field=editor&&editor.height<=lower-upper?editor:active.getBoundingClientRect();
   if(field.bottom>lower)panel.scrollTop+=field.bottom-lower;else if(field.top<upper)panel.scrollTop-=upper-field.top;
  }
 }
 const schedule=()=>{if(!disposed&&!frame)frame=win.requestAnimationFrame(update);};
 function observeHeader(value){
  if(value===observedHeader)return;observer?.disconnect();observedHeader=value;
  if(value&&win.ResizeObserver){observer=new win.ResizeObserver(schedule);observer.observe(value);}
  schedule();
 }
 function dispose(){
  if(disposed)return;disposed=true;if(frame)win.cancelAnimationFrame(frame);observer?.disconnect();win.removeEventListener('resize',schedule);win.removeEventListener('orientationchange',schedule);win.visualViewport?.removeEventListener('resize',schedule);win.visualViewport?.removeEventListener('scroll',schedule);delete win[key];
 }
 win.addEventListener('resize',schedule);win.addEventListener('orientationchange',schedule);win.visualViewport?.addEventListener('resize',schedule);win.visualViewport?.addEventListener('scroll',schedule);
 win[key]={update,dispose,observeHeader};observeHeader(header);update();return dispose;
}
