import {createVersionHandler} from './handler.js';
// The handler validates the user JWT with Auth and checks active membership.
Deno.serve(createVersionHandler({base:Deno.env.get('SUPABASE_URL')||'',key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}));
