import {createOperationsHandler} from './handler.js';
Deno.serve(createOperationsHandler({base:Deno.env.get('SUPABASE_URL')||'',key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}));
