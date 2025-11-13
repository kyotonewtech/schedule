// CIDR-accurate IPv4 allow list (no external libs)
const ORIGIN = "https://schedule-azure-mu.vercel.app"
const ALLOW_CIDR = [
  "203.0.113.0/24",
  "133.15.64.0/24",
  "150.25.0.0/16",
]

function ipToInt(ip){
  const a = ip.split(".").map(x => parseInt(x,10))
  if (a.length !== 4 || a.some(n => Number.isNaN(n) || n<0 || n>255)) return null
  return ((a[0]<<24)>>>0) + (a[1]<<16) + (a[2]<<8) + a[3]
}

function cidrToRange(cidr){
  const [base, bitsStr] = cidr.split("/")
  const bits = parseInt(bitsStr,10)
  const ipInt = ipToInt(base)
  if (ipInt===null || bits<0 || bits>32) return null
  const mask = bits === 0 ? 0 : (~((1<<(32-bits))-1) >>> 0)
  const start = ipInt & mask
  const end = start + (bits===32 ? 0 : ((1<<(32-bits)) - 1))
  return [start>>>0, end>>>0]
}

const RANGES = ALLOW_CIDR.map(c => cidrToRange(c)).filter(Boolean)

function ipAllowed(ip){
  const x = ipToInt(ip)
  if (x===null) return false
  for (const [s,e] of RANGES){
    if (x>=s && x<=e) return true
  }
  return false
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
