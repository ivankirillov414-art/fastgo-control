import {icon} from './icons.js';
import {searchSelect} from './autocomplete.js';

const $=id=>document.getElementById(id);
const make=(tag,className)=>Object.assign(document.createElement(tag),{className});

// Move the existing controls, preserving their form ownership and business handlers.
export function layoutRepairCard(){
 const progress=$('repair-progress-panel');if(!progress)return false;
 const workspace=$('workspace'),form=$('order-form'),columns=workspace.querySelector('.detail-columns');
 const client=columns.querySelector('section.panel'),payment=$('payment-work-costs').closest('.panel');
 const settlement=$('sum-total').closest('.panel'),vehicle=workspace.querySelector('.order-vehicle-card');
 const media=$('photo-grid').closest('.panel'),documents=$('signed-list').closest('.panel');
 const oldDetails=$('repair-details-panel'),heading=workspace.querySelector('.order-detail-head');
 workspace.classList.add('repair-workspace');
 const card=make('div','repair-card'),rail=make('aside','repair-visual'),main=make('div','repair-main');
 const top=make('div','repair-card-top'),brand=make('div','repair-brand');
 brand.innerHTML='<a class="brand" href="#home" aria-label="FastGo — главная">Fast<span>Go</span></a><button type="button" class="repair-menu-button" aria-label="Разделы">'+icon('more')+'</button>';
 brand.querySelector('button').onclick=()=>$('more-nav').click();
 const back=workspace.querySelector(':scope > .back');back.textContent='← Ремонты';brand.append(back);
 top.append(brand,heading);
 const status=heading.querySelector('.order-detail-status'),actions=progress.querySelector('.repair-next-actions');
 if(actions){
  const menu=make('details','repair-status-menu'),summary=document.createElement('summary');
  summary.innerHTML='<span class="repair-status-dot" aria-hidden="true"></span><span>Статус: </span>';
  summary.append(...status.childNodes);summary.insertAdjacentHTML('beforeend',icon('chevron'));
  menu.append(summary);const options=actions.querySelector('.actions');
  options.querySelectorAll('button').forEach(button=>{button.setAttribute('form','order-form');button.addEventListener('click',()=>menu.open=false);});
  menu.append(options);actions.remove();status.append(menu);
 }else status.classList.add('repair-status-closed');
 heading.querySelector('.order-detail-print').insertAdjacentHTML('afterbegin',icon('print'));

 // Compact client summary; less frequent information stays in the disclosure.
 client.id='repair-client-panel';const clientInfo=client.querySelector('.info'),items=[...clientInfo.children];
 const identity=make('div','repair-client-identity'),equipment=make('div','repair-client-equipment');
 identity.append(items[0].querySelector('p'),items[1].querySelector('p'));
 equipment.innerHTML=icon('equipment');equipment.append(items[2].querySelector('p'));
 clientInfo.replaceChildren(identity,equipment);
 const details=make('details','panel repair-details');details.id='repair-details-panel';
 const summary=document.createElement('summary');summary.innerHTML=icon('catalog')+'<span>Подробная информация</span>'+icon('chevron');
 const detailBody=make('div','repair-details-body');oldDetails.querySelector('h2').remove();detailBody.append(...oldDetails.childNodes);
 const extra=make('section','repair-details-section');extra.innerHTML='<h3>О технике</h3><div class="info"></div>';extra.querySelector('.info').append(...items.slice(3));detailBody.prepend(extra);
 details.append(summary,detailBody);oldDetails.remove();

 const photoThumbs=make('div','repair-photo-thumbnails');photoThumbs.id='repair-photo-thumbnails';photoThumbs.setAttribute('aria-label','Фотографии техники');
 vehicle.append(photoThumbs);rail.append(vehicle);
 const uploads=make('button','btn ghost repair-photo-add');uploads.type='button';uploads.textContent='+ Фото и видео';
 uploads.onclick=()=>{details.open=true;media.scrollIntoView({block:'start',behavior:'smooth'});};rail.append(uploads);

 // Payment totals and entry stay visible; approval inputs remain available below.
 payment.id='repair-payment-panel';const paymentOptions=make('details','repair-payment-options');
 const optionSummary=document.createElement('summary');optionSummary.textContent='Согласование стоимости и проверка';paymentOptions.append(optionSummary);
 const paymentTitle=payment.querySelector('h2');paymentTitle.innerHTML=icon('finance')+'Оплата';
 paymentOptions.append(...[...payment.childNodes].filter(node=>node!==paymentTitle));
 const totals=make('div','repair-payment-summary');
 const sums=[...settlement.querySelectorAll('.summary-total')];
 sums[0].querySelector('span').textContent='Итого';sums[1].querySelector('b').id='repair-paid';sums[2].querySelector('span').textContent='К оплате';sums[2].querySelector('b').id='repair-due';
 totals.append(...sums);
 const payActions=settlement.querySelector('.actions');if(payActions)totals.append(payActions);
 for(const button of totals.querySelectorAll('button'))button.type='button';const payButton=totals.querySelector('#payment');if(payButton)payButton.innerHTML=icon('finance')+'Внести оплату';
 payment.append(totals);
 const approvalFields=document.createElement('fieldset');approvalFields.disabled=form.querySelector('fieldset').disabled;approvalFields.style.cssText='border:0;padding:0;margin:0;min-width:0';
 paymentOptions.querySelectorAll('input,select,textarea,button').forEach(control=>control.setAttribute('form','order-form'));approvalFields.append(paymentOptions);detailBody.append(approvalFields);
 const events=settlement.querySelectorAll('.event');if(events.length){settlement.querySelector('h2').textContent='История оплат';detailBody.append(settlement);}else settlement.remove();

 for(const section of [media,documents,...columns.querySelectorAll('.detail-side > .panel')]){
  section.classList.add('repair-details-section');detailBody.append(section);
 }
 client.querySelector('h2').insertAdjacentHTML('afterbegin',icon('account'));
 progress.querySelector('h2').insertAdjacentHTML('afterbegin',icon('repairs'));
 client.querySelector('#edit-intake')?.replaceChildren(document.createTextNode('Изменить'));

 // A single search and a compact tools menu replace the wide parts toolbar.
 const partSection=$('part-rows').closest('.repair-flow-costs');partSection.classList.add('repair-parts-section');
 progress.querySelectorAll('.row-labels').forEach(labels=>{const no=document.createElement('span');no.textContent='№';labels.prepend(no);});
 const footer=progress.querySelector('.repair-progress-footer');
 if(footer){footer.classList.add('repair-card-save');$('repair-save').setAttribute('form','order-form');$('repair-save').insertAdjacentHTML('afterbegin',icon('save'));}
 form.querySelector('.savedbar')?.remove();
 main.append(client,form,details);if(footer)main.append(footer);
 // Notices and closed-order actions stay visible without reserving an empty row.
 const extras=[...workspace.children].filter(node=>node!==columns&&node!==card&&node!==top&&node!==oldDetails);
 card.append(top,rail,main);workspace.replaceChildren(card);
 for(const node of extras){if(node.matches('.notice')||(node.matches('.actions')&&node.childElementCount))main.prepend(node);}
 return true;
}

export function createRepairPhotoGallery({cover,thumbnails,paths,selected,onSelect}){
 const photos=paths.filter(path=>!/\.(mp4|mov|webm)$/i.test(path));
 let current=photos.includes(selected)?selected:photos[0];const urls=new Map(),failed=new Set(),buttons=new Map();
 cover.replaceChildren();thumbnails.replaceChildren();thumbnails.hidden=photos.length<2;
 const show=()=>{
  cover.replaceChildren();for(const [path,button] of buttons)button.setAttribute('aria-pressed',String(path===current));
  if(!current||!urls.has(current)){
   const message=make('p','muted');message.textContent=!current?'Фото техники пока не добавлено':failed.has(current)?'Фото не загрузилось. Нажмите «Обновить фото» в подробной информации.':'Загружаем фото техники…';cover.append(message);return;
  }
  const link=document.createElement('a');link.href=urls.get(current);link.target='_blank';link.rel='noopener';link.setAttribute('aria-label','Открыть фотографию техники');
  const img=document.createElement('img');img.alt='Фото техники клиента';img.src=urls.get(current);img.decoding='async';
  const displayed=current;img.onerror=()=>{urls.delete(displayed);failed.add(displayed);if(current===displayed)show();};link.append(img);cover.append(link);
 };
 photos.forEach((path,index)=>{
  const button=make('button','repair-photo-thumbnail');button.type='button';button.setAttribute('aria-label','Фото '+(index+1));button.textContent=String(index+1);button.onclick=()=>{current=path;onSelect(path);show();};buttons.set(path,button);thumbnails.append(button);
 });show();
 return {loaded(path,url){if(!buttons.has(path))return;urls.set(path,url);const img=document.createElement('img');img.alt='';img.src=url;img.loading='lazy';img.onerror=()=>buttons.get(path).replaceChildren(document.createTextNode('Фото '+(photos.indexOf(path)+1)));buttons.get(path).replaceChildren(img);if(path===current)show();},failed(path){failed.add(path);if(path===current)show();}};
}
