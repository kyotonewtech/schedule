// Simple prefix-based allow list (fastest to set up)
const ORIGIN = "https://schedule-azure-mu.vercel.app"
const ALLOW_PREFIX = [
  "203.0.113.", // sample
  "133.15.",    // sample
  "150.25.",    // sample
]

function ipAllowed(ip) {
  return ALLOW_PREFIX.some(p => ip.startsWith(p))
}

export default {
  async fetch(req) {
    const ip = req.headers.get("cf-connecting-ip") || ""
    if (!ipAllowed(ip)) {
      return new Response("Forbidden", { status: 403 })
    }
    const url = new URL(req.url)
    const target = ORIGIN + url.pathname + url.search
    return fetch(new Request(target, {
      method: req.method,
      headers: req.headers,
      body: (req.method === "GET" || req.method === "HEAD") ? undefined : await req.arrayBuffer(),
    }))
  }
}
