# Google Sign-In setup (CostMCP)

Connect the **costmcp** Google Cloud project to the **costmcp** Supabase project (`bylrekkhwcwosdmcgfsg`).

## 1. Google Cloud Console (`costmcp`)

Open: https://console.cloud.google.com/apis/credentials?project=costmcp

### Consent screen

1. Go to **Google Auth Platform → Branding** (or APIs & Services → OAuth consent screen).
2. Set app name to **CostMCP** and support email to your Google account.
3. Under **Data Access**, ensure these scopes are added:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`

### OAuth client (Web application)

1. **Create credentials → OAuth client ID → Web application**.
2. **Authorized JavaScript origins**
   - `https://costmcp.com`
   - `https://www.costmcp.com`
   - `http://localhost:3001`
3. **Authorized redirect URIs** (Supabase callback — required)
   - `https://bylrekkhwcwosdmcgfsg.supabase.co/auth/v1/callback`
4. Save the **Client ID** and **Client secret**.

## 2. Supabase Dashboard

Open: https://supabase.com/dashboard/project/bylrekkhwcwosdmcgfsg/auth/providers

**Status: configured** — Google is enabled with client ID `429659438932-…gonq8.apps.googleusercontent.com`.

If you need to rotate credentials:

1. Enable **Google**.
2. Paste the Google **Client ID** and **Client secret**.
3. Save.

### URL configuration

Open: https://supabase.com/dashboard/project/bylrekkhwcwosdmcgfsg/auth/url-configuration

**Status: configured** — verified redirect allow list accepts:

- `https://costmcp.com/auth/callback`
- `https://www.costmcp.com/auth/callback`

Localhost URLs are removed from production config. For local dev, run `supabase start` with the `[auth]` block in `supabase/config.toml` (add localhost URLs back only in a local override if needed).

**Site URL** should be `https://costmcp.com`.

To push `supabase/config.toml` auth settings to the hosted project:

```powershell
npx supabase login
./scripts/push-supabase-auth-config.ps1
```

## 3. Local development

Copy `.env.example` to `.env` at the repo root and set Supabase keys from:
https://supabase.com/dashboard/project/bylrekkhwcwosdmcgfsg/settings/api

For `supabase start`, also set in `.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## 4. Verify

1. Run web app: `npm run dev` (from `apps/web` or monorepo root).
2. Open http://localhost:3001/login
3. Click **Continue with Google** → consent → redirect to `/dashboard`.
4. Confirm profile shows Google name/avatar in the sidebar.

## Connection checklist

| Link | Value |
|------|--------|
| GCP project | `costmcp` (`956980183552`) |
| Supabase project | `bylrekkhwcwosdmcgfsg` |
| Supabase OAuth callback | `https://bylrekkhwcwosdmcgfsg.supabase.co/auth/v1/callback` |
| App OAuth callback | `{origin}/auth/callback` |
| Google origins | `costmcp.com`, `localhost:3001` |
