export const DEVICE_KEY='personal-rpg-device-id';
export const CACHE_KEY='arise-progress-cache-v1';
export const VALID_DEVICE=/^[a-zA-Z0-9_-]{16,80}$/;
export function getDevice(storage, makeId=()=>crypto.randomUUID()) {
  for(const key of [DEVICE_KEY,'personal_rpg_device_id','device_id']) {
    const value=storage.getItem(key);
    if(value&&VALID_DEVICE.test(value)){storage.setItem(DEVICE_KEY,value);return value;}
  }
  const value=makeId();if(!VALID_DEVICE.test(value))throw Error('Не удалось создать личный ключ.');
  storage.setItem(DEVICE_KEY,value);return value;
}
export function safeRead(storage,key,fallback){try{return JSON.parse(storage.getItem(key))??fallback;}catch{return fallback;}}
export function levelFor(value){let level=1,remaining=Math.max(0,Math.floor(Number(value)||0));while(level<150&&remaining>=500+(level-1)*250){remaining-=500+(level-1)*250;level++;}const need=500+(level-1)*250;return {level,remaining,need,percent:level===150?100:Math.min(100,remaining/need*100)};}
export function cleanProgress(data){if(!data||!Number.isFinite(Number(data.xp))||!Array.isArray(data.completed_quests))throw Error('Сервер вернул некорректный прогресс.');return {xp:Math.max(0,Number(data.xp)),completed_quests:[...new Set(data.completed_quests.filter(x=>Number.isInteger(x)&&x>=0))],updated_at:data.updated_at||null};}
export function available(quest,quests,done){const previous=quests.filter(x=>x.track===quest.track&&x.id<quest.id);return previous.every(x=>done.includes(x.id));}
export function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function validateFile(file){if(!file||!file.size)throw Error('Выбери непустой файл.');if(file.size>20*1024*1024)throw Error('Файл больше 20 МБ. Сожми его и попробуй снова.');const ext=file.name.split('.').pop().toLowerCase();if(!['png','jpg','jpeg','webp','stl','step','stp','f3d','3mf','pdf','txt','mp4','webm','m4a','mp3','wav'].includes(ext))throw Error('Поддерживаются изображения, CAD, PDF, текст, аудио и видео.');return true;}
export function messageFor(error){const raw=String(error?.message||error);const known={auth_required:'Войди в аккаунт заново.',email_verification_required:'Сначала подтверди электронную почту.',auth_unavailable:'Сервис входа временно недоступен.',camera_required:'Для этих врат нужна локальная камера.',already_completed:'Эти врата уже пройдены.',invalid_session:'Попытка не найдена. Начни заново.',session_expired:'Время попытки вышло. Начни заново.',insufficient_result:'Пока недостаточно данных для сохранения результата.',daily_expired:'Дедлайн прошёл. Этот дейлик уже нельзя отправить.',daily_not_active:'Задание уже завершено или находится на проверке.',quest_locked:'Сначала заверши предыдущий узел этой ветки.',file_too_large:'Файл больше 20 МБ.',invalid_device:'Личный ключ не распознан. Открой настройки.',verification_required:'Нужно отправить доказательство выполнения.',rate_limited:'Слишком много отправок. Попробуй чуть позже.'};return known[raw]||(/Failed to fetch|NetworkError|fetch failed|abort|timeout/i.test(raw)?'Нет связи с сервером. Проверь интернет и повтори.':raw);}
export async function request(base,path,{device,fetcher=fetch,timeout=20000,...options}={}){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),timeout);try{const r=await fetcher(base+path,{...options,signal:ctrl.signal,cache:'no-store',headers:{...(device?{'x-device-id':device}:{}),...options.headers}});let j;try{j=await r.json();}catch{throw Error('Сервер вернул непонятный ответ. Повтори позже.');}if(!r.ok)throw Error(j.error||`Ошибка сервера (${r.status}).`);return j;}finally{clearTimeout(timer);}}
