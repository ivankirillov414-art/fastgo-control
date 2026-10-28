const keys={й:'q',ц:'w',у:'e',к:'r',е:'t',н:'y',г:'u',ш:'i',щ:'o',з:'p',х:'[',ъ:']',ф:'a',ы:'s',в:'d',а:'f',п:'g',р:'h',о:'j',л:'k',д:'l',ж:';',э:"'",я:'z',ч:'x',с:'c',м:'v',и:'b',т:'n',ь:'m',б:',',ю:'.',ё:'`'};
const shifted={'[':'{',']':'}',';':':',"'":'"',',':'<','.':'>','`':'~'};
const punctuation={'"':'@','№':'#',';':'$',':':'^','?':'&','.':'/',',':'?','/':'|'};
const clean=value=>String(value??'').replace(/^[\x00-\x20\uFEFF]+|[\x00-\x20]+$/g,'');
const aim=value=>value.replace(/^\][a-z][0-9]/i,'');

// HID keyboard scanners follow the active Windows layout. Recover only known
// FastGo codes/URLs; arbitrary Cyrillic product SKUs keep their literal value.
export function normalizeScan(value){
 const raw=clean(value);
 if(/[а-яё]/i.test(raw)){
  const mapped=aim([...raw].map(c=>{const low=c.toLowerCase(),key=keys[low];if(key)return c===low?key:shifted[key]||key.toUpperCase();return punctuation[c]||c;}).join(''));
  if(/^(?:FGP-\d|FGC-|FGPARTS1\.|https?:\/\/)/i.test(mapped))return mapped;
 }
 return aim(raw);
}
