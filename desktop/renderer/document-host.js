import {renderDocument} from './workshop/documents.js';
const context=await window.fastgoDesktop.printContext();
await renderDocument({me:context.me,mount:html=>{document.getElementById('print-host').innerHTML=html;return true;},href:(page,p)=>'#'+page+'?'+new URLSearchParams(p)}, {...context,type:'master'},0);
await document.fonts.ready;
await Promise.all([...document.querySelectorAll('.print-page img')].map(img=>img.decode()));
await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
await window.fastgoDesktop.printReady();
