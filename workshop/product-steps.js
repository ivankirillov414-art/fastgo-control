export function mountProductSteps(form,save,{warehouse=false}={}){
 if(!form||!save)return;
 if(!document.getElementById('product-steps-style')){const link=document.createElement('link');link.id='product-steps-style';link.rel='stylesheet';link.href='workshop/product-steps.css?v=20261028';document.head.append(link);}
 form.classList.add('product-step-form');save.dataset.productSave='true';
 const nav=document.createElement('nav');nav.className='product-step-nav';nav.setAttribute('aria-label','Приёмка товара');
 nav.innerHTML='<ol><li>Товар</li><li>Размер и цены</li><li>Количество и фото</li></ol><p role="status"></p>';
 const titles=['Товар','Размер и цены','Количество и фото'],groups=titles.map((title,i)=>{const section=document.createElement('section');section.dataset.productStep=i;const heading=document.createElement('h3');heading.textContent=title;section.append(heading);return section;});
 for(const [i,names]of [[0,['name','category']],[1,['model','unit_cost','retail_price']],[2,['initial_quantity','photo','category_primary']]])for(const name of names){const input=form.elements.namedItem(name),label=input?.closest('label');if(label)groups[i].append(label);}
 for(const img of form.querySelectorAll('img'))groups[2].append(img);
 for(const p of form.querySelectorAll('p.muted'))groups[2].append(p);
 const controls=document.createElement('div');controls.className='product-step-controls';controls.innerHTML='<button type="button" data-product-back>Назад</button><button type="button" data-product-next>Далее</button>';
 const back=controls.firstElementChild,next=controls.lastElementChild;back.className=warehouse?'':'btn secondary';next.className=warehouse?'primary':'btn';
 const heading=form.querySelector(':scope>h2');form.prepend(...(heading?[heading]:[]),nav,...groups);form.append(controls);let current=0;
 const busy=()=>save.disabled;
 function draw(focus=false){form.dataset.productCurrent=current;groups.forEach((g,i)=>g.hidden=i!==current);nav.querySelector('p').textContent=`Шаг ${current+1} из 3`;[...nav.querySelectorAll('li')].forEach((li,i)=>{if(i===current)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});save.hidden=current!==2;next.hidden=current===2;back.disabled=current===0||busy();next.disabled=busy();if(focus){const h=groups[current].querySelector('h3');h.tabIndex=-1;h.focus({preventScroll:true});h.scrollIntoView({block:'nearest'});}}
 function reveal(input){const section=input.closest('[data-product-step]');if(section){current=Number(section.dataset.productStep);draw();}}
 function advance(){if(busy())return;for(const input of groups[current].querySelectorAll('input[required]'))if(!['file','number'].includes(input.type))input.value=input.value.trim();const invalid=[...groups[current].querySelectorAll('input,select,textarea')].find(x=>x.willValidate&&!x.validity.valid);if(invalid){reveal(invalid);invalid.reportValidity();invalid.focus();return;}current=Math.min(2,current+1);draw(true);}
 next.onclick=advance;back.onclick=()=>{if(!busy()){current=Math.max(0,current-1);draw(true);}};
 form.addEventListener('invalid',e=>reveal(e.target),true);
 form.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'&&current<2&&!e.defaultPrevented){e.preventDefault();advance();}});
 form.addEventListener('submit',e=>{if(current<2){e.preventDefault();e.stopImmediatePropagation();advance();}},true);
 const observer=new MutationObserver(()=>{if(!form.isConnected){observer.disconnect();return;}back.disabled=current===0||busy();next.disabled=busy();});observer.observe(save,{attributes:true,attributeFilter:['disabled']});draw();
}
