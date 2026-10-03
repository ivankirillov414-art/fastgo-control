import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.mjs';

let client;
export async function initializeAuth(onChange){
  const {createClient}=await import('./vendor/auth-sdk.mjs');
  client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
    auth:{flowType:'pkce',storageKey:'arise-auth-v2',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  client.auth.onAuthStateChange((event,session)=>{
    // Never await SDK calls inside its auth callback: it holds a session lock.
    setTimeout(()=>onChange(session,event),0);
  });
  const {data,error}=await client.auth.getSession();
  if(error)throw error;
  // Remove one-use authorization codes and provider errors from the visible URL.
  const url=new URL(location.href);
  for(const key of ['code','error','error_code','error_description'])url.searchParams.delete(key);
  history.replaceState(null,'',url.pathname+url.search+url.hash);
  return data.session;
}
export async function sendLoginLink(email){
  if(!client)throw Error('Модуль входа ещё не загружен. Обнови страницу.');
  const redirect=new URL('achievements.html',location.href);redirect.hash='';redirect.search='';
  const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:redirect.href,shouldCreateUser:true}});
  if(error)throw error;
}
export async function accessToken(){
  if(!client)throw Error('auth_required');
  const {data,error}=await client.auth.getSession();
  if(error||!data.session?.access_token)throw Error('auth_required');
  return data.session.access_token;
}
export async function signOut(){
  if(!client)return;
  const {error}=await client.auth.signOut({scope:'global'});
  if(error)throw error;
}
export function authMessage(error){
  const code=error?.code||error?.message||'';
  if(/rate|over_email_send|429/i.test(code))return 'Письмо уже запрошено. Подожди минуту перед повторной отправкой.';
  if(/email_address_not_authorized|smtp|email.*send|unexpected_failure/i.test(code))return 'Почтовая отправка ещё не настроена на сервере. Данные сохранены; нужен действующий SMTP.';
  if(/otp_expired|flow_state|code.*verifier/i.test(code))return 'Ссылка устарела или открыта в другом браузере. Запроси новую и открой её в этом же браузере.';
  if(/email.*invalid|validation_failed/i.test(code))return 'Проверь адрес электронной почты.';
  return 'Не удалось войти. Проверь интернет, затем запроси новую ссылку.';
}
