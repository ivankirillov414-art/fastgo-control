FastGo Control — Cloudflare Pages package

1. Open Cloudflare Dashboard.
2. Go to Workers & Pages.
3. Create application -> Pages -> Upload assets.
4. Upload this ZIP or the contents of this folder.
5. After deploy, open the generated *.pages.dev URL.

Backend:
- Supabase project: FastGo OS
- The frontend uses the project's publishable key only.
- No service-role key is included.

Current screens:
- Owner login
- Dashboard
- Fleet
- Service / repairs
- Manual payment claims
- Launch checklist

Important:
The owner must exist in Supabase Auth and have role owner/admin in public.profiles.
