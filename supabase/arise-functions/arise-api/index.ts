import {createHandler} from '../_shared/server.mjs';
Deno.serve((req:Request)=>{
  const action=new URL(req.url).pathname.split('/').filter(Boolean).at(-1)||'';
  return createHandler(action==='arise-api'?'rpg-progress':action)(req);
});
