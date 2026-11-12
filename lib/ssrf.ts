import dns from "dns/promises";
import net from "node:net";

export interface SsrfResult {
  safe: boolean;
  error?: string;
  /**
   * The first public address the host resolved to. Callers should connect to
   * this address and pass the original hostname as `tls.servername` so a
   * second DNS lookup cannot rebind the connection to a private target.
   */
  address?: string;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }

  const [b0, b1, b2] = parts;

  if (b0 === 0) return true; // "this" network
  if (b0 === 10) return true; // private
  if (b0 === 127) return true; // loopback
  if (b0 === 169 && b1 === 254) return true; // link-local
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true; // private
  if (b0 === 192 && b1 === 168) return true; // private
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true; // CGNAT
  if (b0 === 192 && b1 === 0 && b2 === 0) return true; // IETF protocol assignments
  if (b0 === 192 && b1 === 0 && b2 === 2) return true; // TEST-NET-1
  if (b0 === 192 && b1 === 88 && b2 === 99) return true; // deprecated 6to4 relay
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true; // benchmarking
  if (b0 === 198 && b1 === 51 && b2 === 100) return true; // TEST-NET-2
  if (b0 === 203 && b1 === 0 && b2 === 113) return true; // TEST-NET-3
  if (b0 >= 224) return true; // multicast, reserved and broadcast

  return false;
}

/**
 * Expand any valid IPv6 spelling (including `::` compression and a trailing
 * embedded IPv4 dotted quad) into eight 16-bit groups.
 *
 * String-prefix checks are unsafe here: `dns.lookup` echoes an IP literal back
 * byte-for-byte, so `0:0:0:0:0:0:0:1` and `0000::0001` are the same loopback
 * address but match none of the canonical prefixes.
 */
function parseIpv6(rawIp: string): number[] | null {
  let ip = rawIp.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const zoneIndex = ip.indexOf("%");
  if (zoneIndex !== -1) ip = ip.slice(0, zoneIndex);
  if (!ip.includes(":")) return null;

  // Split off and remove a trailing dotted-quad IPv4 part.
  let ipv4Tail: number[] | null = null;
  const lastColon = ip.lastIndexOf(":");
  const tail = ip.slice(lastColon + 1);
  if (tail.includes(".")) {
    const parts = tail.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
      return null;
    }
    ipv4Tail = parts;
    // Replace the dotted tail with two placeholder hextets.
    ip = `${ip.slice(0, lastColon + 1)}0:0`;
  }

  const [head, rest] = ip.includes("::") ? ip.split("::") : [ip, undefined];
  const headGroups = head ? head.split(":").filter((g) => g.length > 0) : [];
  const restGroups = rest ? rest.split(":").filter((g) => g.length > 0) : [];

  const missing = 8 - headGroups.length - restGroups.length;
  let groups: string[];
  if (rest === undefined) {
    groups = headGroups;
  } else {
    if (missing < 0) return null;
    groups = [...headGroups, ...Array.from({ length: missing }, () => "0"), ...restGroups];
  }

  if (groups.length !== 8) return null;

  const parsed: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    parsed.push(parseInt(group, 16));
  }

  if (ipv4Tail) {
    parsed[6] = (ipv4Tail[0] << 8) | ipv4Tail[1];
    parsed[7] = (ipv4Tail[2] << 8) | ipv4Tail[3];
  }

  return parsed;
}

function ipv4FromGroups(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

function isPrivateIpv6(rawIp: string): boolean {
  const groups = parseIpv6(rawIp);
  if (!groups) {
    // Unparseable: fail closed rather than pinning something we do not grok.
    return true;
  }

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;

  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 0) {
    return true; // unspecified ::
  }
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 1) {
    return true; // loopback ::1
  }

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) addresses.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && (g5 === 0 || g5 === 0xffff)) {
    return isPrivateIpv4(ipv4FromGroups(g6, g7));
  }

  // Everything else inside 0000::/8 is reserved (this also catches spellings
  // such as `0:0:0:0:1::` that match none of the specific prefixes below).
  if (g0 === 0) return true;

  // NAT64 well-known prefix 64:ff9b::/96 (and 64:ff9b:1::/48).
  if (g0 === 0x0064 && g1 === 0xff9b) return true;
  if (g0 === 0x2002) return true; // 6to4
  if (g0 === 0x2001 && g1 === 0x0000) return true; // Teredo
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return true; // 100::/64 discard
  if ((g0 & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((g0 & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((g0 & 0xffc0) === 0xfec0) return true; // deprecated site-local fec0::/10
  if ((g0 & 0xff00) === 0xff00) return true; // multicast ff00::/8

  return false;
}

const INTERNAL_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".home",
  ".home.arpa",
  ".lan",
  ".corp",
  ".localdomain",
];

export async function validateHostForSsrf(host: string): Promise<SsrfResult> {
  const cleanHost = host.trim().toLowerCase().replace(/^\[|\]$/g, "");

  if (!cleanHost) {
    return { safe: false, error: "A target host is required." };
  }

  if (cleanHost === "localhost" || INTERNAL_SUFFIXES.some((suffix) => cleanHost.endsWith(suffix))) {
    return { safe: false, error: "Private or internal hostnames are not permitted." };
  }

  const literalFamily = net.isIP(cleanHost);

  // Reject an IP literal before touching DNS so octal/hex aliases cannot slip past.
  if (literalFamily === 4 && isPrivateIpv4(cleanHost)) {
    return { safe: false, error: "Private or reserved IP addresses are not permitted." };
  }
  if (literalFamily === 6 && isPrivateIpv6(cleanHost)) {
    return { safe: false, error: "Private or reserved IP addresses are not permitted." };
  }
  // A bare decimal/octal IPv4 literal is an address, never a hostname.
  if (!literalFamily && /^\d+$/.test(cleanHost)) {
    return { safe: false, error: "IP literals are not permitted as SMTP hosts." };
  }

  try {
    const addresses = await dns.lookup(cleanHost, { all: true });
    if (!addresses || addresses.length === 0) {
      return { safe: false, error: "Unable to resolve target host." };
    }

    for (const record of addresses) {
      if (record.family === 4) {
        if (isPrivateIpv4(record.address)) {
          return { safe: false, error: `Host resolves to private IP address (${record.address}).` };
        }
      } else if (record.family === 6) {
        if (isPrivateIpv6(record.address)) {
          return { safe: false, error: `Host resolves to private IPv6 address (${record.address}).` };
        }
      }
    }

    // Prefer IPv4 for maximum SMTP interoperability, then pin that address.
    const pinned = addresses.find((record) => record.family === 4) ?? addresses[0];

    return { safe: true, address: pinned.address };
  } catch {
    return { safe: false, error: "DNS lookup failed for target host." };
  }
}
