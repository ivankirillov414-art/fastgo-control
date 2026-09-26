import { createHandler } from '../_shared/server.mjs';
Deno.serve(createHandler('submit-daily-evidence'));
