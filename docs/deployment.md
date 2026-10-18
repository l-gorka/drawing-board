# Cloudflare Workers Builds deployment

The Board deploys as one Cloudflare Worker. It serves the built web app and
handles `/api/*` and `/ws` on the same `workers.dev` origin. The Board itself
is stored by the Worker’s Durable Object. Cloudflare Workers Builds connects
the GitHub repository, builds it, and deploys each change that reaches `main`.

## Connect the repository

1. Create and verify a Cloudflare account at
   [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. Complete any dashboard prompts required to activate Workers. A custom domain
   is not needed: this app uses the free `workers.dev` URL.
3. In **Workers & Pages**, select **Create application**, then **GitHub**.
   Authorize Cloudflare's GitHub app to access `l-gorka/drawing-board`.
4. Select the repository and configure the Worker:
   - **Worker name:** `drawing-board`
   - **Production branch:** `main`
   - **Root directory:** repository root
   - **Build command:** `bun run build`
   - **Deploy command:** `bun run --cwd server deploy`
   - **Build variable:** `BUN_VERSION` = `1.4.3`
5. Keep Cloudflare's automatically generated deployment API token. It remains
   in Cloudflare and is not a GitHub secret.
6. Select **Save and Deploy**. Cloudflare installs the locked dependencies,
   runs the build command, and deploys the Worker. On the first deployment,
   Cloudflare also creates the Durable Object storage declared in
   `server/wrangler.jsonc`.

The Worker name must match the `name` in `server/wrangler.jsonc`. The deploy
command runs Wrangler from `server/`, where that configuration lives.

Cloudflare builds only code already pushed to GitHub. It cannot deploy
uncommitted local changes.

## Planned quality gate

Cloudflare Workers Builds deploys every push to `main`. It does not provide a
pre-deployment test gate. Issue #14 will add a GitHub Actions quality gate and
GitHub branch protection so only a pull request that passes lint, typecheck,
tests, and the production build can reach `main`.

## Smoke test

1. Open the deployment URL in two separate browser windows.
2. Draw in one window and confirm the other window receives the Draw.
3. Select a Palette color and verify it Draws the expected color.
4. Press Reset and confirm both windows reset.
5. Reload a window and confirm the Board retains its state.

If a deployment needs to be rolled back, open the Worker’s **Deployments** page
in the Cloudflare dashboard and promote the previous deployment. The Board’s
stored state is not erased by a Worker rollback.
