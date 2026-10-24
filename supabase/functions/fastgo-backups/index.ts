import {createBackupHandler} from './handler.js';
Deno.serve(createBackupHandler({base:Deno.env.get('SUPABASE_URL')||'',key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',publicBase:Deno.env.get('FASTGO_PUBLIC_URL')||Deno.env.get('SUPABASE_URL')||'',signingKey:Deno.env.get('FASTGO_SIGNING_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}));
