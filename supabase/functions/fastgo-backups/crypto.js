const encoder=new TextEncoder(),decoder=new TextDecoder();
export const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
export const unb64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof bytes==='string'?encoder.encode(bytes):bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function encryptArchive(data,key,meta){
 const iv=crypto.getRandomValues(new Uint8Array(12)),header=encoder.encode(JSON.stringify({format:1,...meta,iv:b64(iv)})),raw=typeof data==='string'?encoder.encode(data):data;
 const imported=await crypto.subtle.importKey('raw',unb64(key),'AES-GCM',false,['encrypt']);
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:header},imported,raw));
 const prefix=encoder.encode('FGARCHIVE1\n'+header.length+'\n'),out=new Uint8Array(prefix.length+header.length+cipher.length);out.set(prefix);out.set(header,prefix.length);out.set(cipher,prefix.length+header.length);return out;
}
export async function decryptArchive(bytes,key){
 const first=bytes.indexOf(10),second=bytes.indexOf(10,first+1);if(decoder.decode(bytes.subarray(0,first))!=='FGARCHIVE1')throw Error('Unknown recovery archive');
 const length=Number(decoder.decode(bytes.subarray(first+1,second)));if(!Number.isSafeInteger(length)||length<1||length>8192||bytes.length<second+length+18)throw Error('Invalid recovery archive');
 const header=bytes.subarray(second+1,second+1+length),meta=JSON.parse(decoder.decode(header));if(meta.format!==1)throw Error('Unsupported recovery archive');
 const imported=await crypto.subtle.importKey('raw',unb64(key),'AES-GCM',false,['decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(meta.iv),additionalData:header},imported,bytes.subarray(second+1+length));return {meta,bytes:new Uint8Array(plain)};
}
export async function wrapKey(key,publicKey){const rsa=await crypto.subtle.importKey('spki',unb64(publicKey),{name:'RSA-OAEP',hash:'SHA-256'},true,['encrypt']);if(rsa.algorithm.modulusLength<2048||rsa.algorithm.modulusLength>4096)throw Error('Invalid recovery public key');return b64(new Uint8Array(await crypto.subtle.encrypt({name:'RSA-OAEP'},rsa,unb64(key))));}
