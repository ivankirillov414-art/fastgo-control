// The central ARISE API verifies the account JWT and ownership on every request.
Deno.serve(async (req:Request)=>{const url=new URL(req.url);url.pathname='/functions/v1/arise-api/push-subscribe';return fetch(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req.body}),redirect:'error'});});
