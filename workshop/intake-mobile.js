// Present the existing intake form in short mobile steps without duplicating data.
export function mountMobileIntake(form) {
 if (!form || form.dataset.mobileIntake) return;
 form.dataset.mobileIntake = 'true';
 if (!document.getElementById('intake-mobile-style')) {
  const link=document.createElement('link');link.id='intake-mobile-style';link.rel='stylesheet';link.href='workshop/intake-mobile.css?v=20261028';document.head.append(link);
 }
 const panels=[...form.querySelectorAll('.form-layout > div > .panel')];
 const aside=form.querySelector('.side-sticky');
 if(panels.length!==3||!aside)return;
 panels.forEach((panel,i)=>panel.dataset.intakeStep=String(i));aside.dataset.intakeStep='2';
 const nav=document.createElement('nav');nav.className='intake-step-nav';nav.setAttribute('aria-label','Этап приёмки');
 nav.innerHTML='<ol><li>Клиент</li><li>Техника</li><li>Фото и сохранение</li></ol><p aria-live="polite"></p>';
 form.prepend(nav);
 const controls=document.createElement('div');controls.className='intake-step-controls';
 controls.innerHTML='<button type="button" class="btn secondary" data-intake-back>Назад</button><button type="button" class="btn" data-intake-next>Далее</button>';
 form.append(controls);
 const back=controls.querySelector('[data-intake-back]'),next=controls.querySelector('[data-intake-next]');
 let current=0;
 const media=matchMedia('(max-width:760px)');
 function draw(focus=false){
  form.dataset.intakeCurrent=String(current);
  for(const panel of [...panels,aside])panel.classList.toggle('intake-step-inactive',Number(panel.dataset.intakeStep)!==current);
  [...nav.querySelectorAll('li')].forEach((li,i)=>{if(i===current)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
  nav.querySelector('p').textContent=`Шаг ${current+1} из 3`;
  back.disabled=current===0;next.hidden=current===2;
  if(focus){nav.scrollIntoView({block:'start'});const heading=panels[current].querySelector('h2');heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
 }
 function reveal(control){const panel=control?.closest('[data-intake-step]');if(panel){current=Number(panel.dataset.intakeStep);draw();}const details=control?.closest('details');if(details)details.open=true;}
 next.onclick=()=>{
  for(const input of panels[current].querySelectorAll('input[required]'))input.value=input.value.trim();
  const invalid=[...panels[current].querySelectorAll('input,select,textarea')].find(el=>el.willValidate&&!el.validity.valid);
  if(invalid){reveal(invalid);invalid.reportValidity();invalid.focus();return;}
  if(current===0){const phone=form.querySelector('[name="phone"]');let digits=phone.value.replace(/\D/g,'');if(digits[0]==='8')digits='7'+digits.slice(1);if(!/^7\d{10}$/.test(digits)){phone.setCustomValidity('Введите полный телефон: 11 цифр, начиная с 7 или 8');phone.reportValidity();phone.oninput=()=>phone.setCustomValidity('');return;}}
  current=Math.min(2,current+1);draw(true);
 };
 back.onclick=()=>{current=Math.max(0,current-1);draw(true);};
 form.addEventListener('invalid',e=>{if(media.matches)reveal(e.target);},true);
 form.addEventListener('submit',e=>{
  if(!media.matches)return;
  const invalid=[...form.elements].find(el=>el.willValidate&&!el.validity.valid);
  if(invalid){reveal(invalid);return;}
  if(current<2){e.preventDefault();e.stopImmediatePropagation();next.click();}
 },true);
 form.addEventListener('keydown',e=>{if(media.matches&&current<2&&e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();next.click();}});
 const photos=form.querySelector('#intake-photos');
 if(photos){
  const picker=document.createElement('label');picker.className='btn secondary intake-photo-picker';picker.htmlFor=photos.id;picker.textContent='Добавить фото или видео';
  photos.classList.add('intake-photo-input');photos.before(picker);
  const selected=document.createElement('p');selected.className='intake-photo-selected';selected.setAttribute('role','status');photos.after(selected);
  const update=()=>{selected.textContent=photos.files.length?[...photos.files].map(f=>f.name).join(' · '):'Файлы ещё не выбраны';};photos.addEventListener('change',update);update();
  const help=photos.parentElement.querySelector('small');if(help){const details=document.createElement('details');details.className='intake-extra';const summary=document.createElement('summary');summary.textContent='Требования к фото и видео';details.append(summary);help.replaceWith(details);details.append(help);}
 }
 draw();
}
