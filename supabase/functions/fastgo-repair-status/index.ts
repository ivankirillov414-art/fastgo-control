import {createStatusHandler} from './handler.js';
// JWT verification is inside the issue route; public reads require an HMAC capability.
Deno.serve(createStatusHandler({base:Deno.env.get('SUPABASE_URL')||'',key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}));
