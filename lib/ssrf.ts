import dns from "dns/promises";

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
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true; // benchmarking
  if (b0 === 198 && b1 === 51 && b2 === 100) return true; // TEST-NET-2
  if (b0 === 203 && b1 === 0 && b2 === 113) return true; // TEST-NET-3
  if (b0 >= 224) return true; // multicast, reserved and broadcast

  return false;
}

function isPrivateIpv6(rawIp: string): boolean {
  const lower = rawIp.toLowerCase().trim().replace(/^\[|\]$/g, "");

  if (lower === "::1" || lower === "::") return true;

  if (lower.startsWith("::ffff:")) {
    const mappedIpv4 = lower.slice(7);
    return isPrivateIpv4(mappedIpv4);
  }

  // IPv4-compatible (deprecated) form, e.g. ::7f00:1
  if (lower.startsWith("::") && /^::[0-9a-f]{1,4}(:[0-9a-f]{1,4}){1,2}$/.test(lower)) {
    return true;
  }

  if (lower.startsWith("64:ff9b:")) return true; // NAT64 well-known prefix
  if (lower.startsWith("2002:")) return true; // 6to4
  if (lower.startsWith("2001:0:") || lower.startsWith("2001::")) return true; // Teredo
  if (lower.startsWith("2001:db8:")) return true; // documentation
  if (lower.startsWith("100::")) return true; // discard-only
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true; // link-local
  }
  if (lower.startsWith("ff")) return true; // multicast

  return false;
}

export async function validateHostForSsrf(host: string): Promise<SsrfResult> {
  const cleanHost = host.trim().toLowerCase().replace(/^\[|\]$/g, "");

  if (!cleanHost) {
    return { safe: false, error: "A target host is required." };
  }

  if (
    cleanHost === "localhost" ||
    cleanHost === "localhost.localdomain" ||
    cleanHost.endsWith(".localhost") ||
    cleanHost.endsWith(".internal") ||
    cleanHost.endsWith(".local") ||
    cleanHost.endsWith(".home.arpa")
  ) {
    return { safe: false, error: "Private or internal hostnames are not permitted." };
  }

  // Reject an IP literal before touching DNS so octal/hex aliases cannot slip past.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cleanHost) && isPrivateIpv4(cleanHost)) {
    return { safe: false, error: "Private or reserved IP addresses are not permitted." };
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
