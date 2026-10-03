// x-device-id is a migration hint only, never an authorization credential.
export async function authenticatedUser(req,env,fetcher=fetch){
  const authorization=req.headers.get('Authorization')||'';
  if(!/^Bearer [^\s]+$/.test(authorization))throw Error('auth_required');
  const response=await fetcher(env.get('SUPABASE_URL')+'/auth/v1/user',{
    headers:{apikey:env.get('SUPABASE_ANON_KEY')||env.get('SUPABASE_SERVICE_ROLE_KEY'),Authorization:authorization},
    signal:AbortSignal.timeout(10000),cache:'no-store'
  });
  if(!response.ok){if(response.status===401||response.status===403)throw Error('auth_required');throw Error('auth_unavailable');}
  const user=await response.json();
  if(!/^[a-f0-9-]{36}$/i.test(user.id||'')||!user.email_confirmed_at||user.is_anonymous||!user.email)throw Error('email_verification_required');
  // Never authorize using user_metadata or a client-provided user id.
  return {id:user.id,email:user.email};
}
