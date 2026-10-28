import {repairGuide} from './repair-progress.js';
import {esc,money} from './core.js';

let dispose=()=>{};
export function mountRepairGuide({record,actor,values,advance}){
 dispose();
 const card=document.querySelector('.repair-card');if(!card)return;
 const guide=document.createElement('section');guide.className='repair-guide';guide.setAttribute('aria-label','Текущий этап ремонта');
 card.querySelector('.repair-pane-tabs').before(guide);
 let pending=false,scheduled=false;
 const draw=()=>{
  if(!guide.isConnected)return;
  const step=repairGuide(record,values(),actor);
  guide.innerHTML='<ol class="repair-guide-progress" aria-label="Этапы ремонта">'+step.stages.map(([id,label],i)=>'<li'+(i===step.index?' aria-current="step"':'')+'><span aria-hidden="true">'+(i<step.index?'✓':i+1)+'</span>'+esc(label)+'</li>').join('')+'</ol><div class="repair-guide-task"><div><h2>'+esc(step.title)+'</h2><p class="repair-guide-detail">'+esc(step.detail)+(record.status==='ready'&&step.due>0&&actor.role!=='mechanic'?' '+money(step.due):'')+'</p></div>'+(step.target?'<button type="button" class="btn" data-guide-advance'+(pending||step.disabled?' disabled':'')+'>'+esc(step.label)+'</button>':'')+'</div>';
  const button=guide.querySelector('[data-guide-advance]');
  if(button)button.onclick=async()=>{if(pending||step.disabled)return;pending=true;button.disabled=true;const invalid=[...document.getElementById('order-form').elements].find(x=>x.willValidate&&!x.validity.valid);document.querySelector('[data-repair-pane="'+(!invalid&&step.target==='issued'?'payment':'work')+'"]')?.click();try{await advance(step.target,button);}finally{pending=false;draw();}};
 };
 const update=e=>{if(guide.contains(e.target)||scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;draw();});};
 for(const event of ['input','change','click'])card.addEventListener(event,update);
 dispose=()=>{for(const event of ['input','change','click'])card.removeEventListener(event,update);guide.remove();};
 draw();return dispose;
}
