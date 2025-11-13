# Cloudflare Workers IP Gate (Free, No IT needed)

## Files
- `worker-simple.js` : Prefix-based allow list (quick start)
- `worker-cidr.js`   : CIDR-accurate IPv4 allow list
- `wrangler.toml`    : Minimal config for workers.dev
- `ALLOW.sample.json`: Put your allowed prefixes/CIDRs here and paste into the worker

## Quick Start (Dashboard only)
1. Cloudflare → Workers & Pages → Create Worker → Quick edit
2. Open `worker-simple.js`, paste entire code, and set:
   - `const ORIGIN = "https://schedule-azure-mu.vercel.app"`
   - `const ALLOW_PREFIX = ["203.0.113.", "133.15.", "150.25."]`
3. Save & Deploy → share `https://<name>.workers.dev` with internal users.

## CLI Deploy (optional)
```bash
npm i -g wrangler
wrangler login
wrangler init ip-filter-proxy --yes
# Replace generated files with those in this folder
wrangler deploy
```

## Switch to CIDR-accurate version
1. Use `worker-cidr.js` instead of `worker-simple.js`
2. Fill `ALLOW_CIDR` with IPv4 CIDRs, e.g.:
   `["203.0.113.0/24", "133.15.64.0/24", "150.25.0.0/16"]`

## Notes
- workers.dev is free (~100k requests/day free tier).
- Add IPv6 logic if your org uses IPv6 ranges.
- Keep the raw Vercel URL private externally.
