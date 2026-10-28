// Baseline Chrome 61 / older Android WebView. Keep this file free of modern syntax.
if(!Promise.prototype.finally){Promise.prototype.finally=function(fn){return this.then(function(v){return Promise.resolve(fn()).then(function(){return v;});},function(e){return Promise.resolve(fn()).then(function(){throw e;});});};}
function terminalError(){var el=document.getElementById('message');if(el)el.textContent='Не удалось загрузить FastGo. Проверьте интернет, закройте и откройте приложение. Если ошибка повторится, обновите Android System WebView на терминале.';}
window.addEventListener('error',terminalError,true);window.addEventListener('unhandledrejection',terminalError);
