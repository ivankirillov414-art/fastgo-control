import {createAvitoHandler} from './handler.js';
Deno.serve(createAvitoHandler({base:Deno.env.get('SUPABASE_URL')||'',key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}));
