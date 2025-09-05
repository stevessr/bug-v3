Deno Deploy proxy for Pixiv images

Files:

- `deno_deploy.ts` - Deno Deploy compatible proxy server.

Quick deploy steps:

1. Create a new Deno Deploy project and upload `deno_deploy.ts` or connect to this repo.
2. In Deno Deploy project settings, add a secret `PROXY_PASSWORD` with your chosen password.
3. Deploy the project.
4. Use the endpoint like:
   `https://<your-deploy>.deno.dev/?url=https://i.pximg.net/..../xxx.png&pw=<your-password>`

Notes:

- The script white-lists `i.pximg.net` only. Modify `ALLOWED_HOSTS` if you need more.
- If you use local Deno for testing, ensure environment variable `PROXY_PASSWORD` is set.
