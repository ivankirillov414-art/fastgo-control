import {createHandler} from './handler.js';
Deno.serve(createHandler({base:Deno.env.get('SUPABASE_URL')||'',key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}));
