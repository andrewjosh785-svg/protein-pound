// Minimal hand-rolled Stripe REST client. The "stripe" npm package fails to boot in
// Supabase's edge runtime — confirmed via Stripe's own API request log showing zero
// requests ever reaching Stripe, even after trying both npm: and esm.sh Deno-targeted
// imports — so these functions talk to Stripe's plain REST API directly instead.
// Stripe's API is form-encoded with bracket notation for nested/array params.

export async function stripeRequest(
  secretKey: string,
  method: "GET" | "POST",
  path: string,
  params?: Record<string, unknown>
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  const body = params ? flattenParams(params) : undefined;
  const url = method === "GET" && body ? `https://api.stripe.com/v1/${path}?${body}` : `https://api.stripe.com/v1/${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: "Bearer " + secretKey,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body : undefined,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Stripe API error (" + response.status + ")");
  }
  return data;
}

// Turns a nested params object into Stripe's bracketed form-encoding, e.g.
// { line_items: [{ price: "x", quantity: 1 }] } -> "line_items[0][price]=x&line_items[0][quantity]=1"
function flattenParams(obj: Record<string, unknown>, prefix = ""): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const fullKey = prefix ? prefix + "[" + key + "]" : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        const arrKey = fullKey + "[" + i + "]";
        if (typeof item === "object" && item !== null) {
          pairs.push(flattenParams(item as Record<string, unknown>, arrKey));
        } else {
          pairs.push(encodeURIComponent(arrKey) + "=" + encodeURIComponent(String(item)));
        }
      });
    } else if (typeof value === "object") {
      pairs.push(flattenParams(value as Record<string, unknown>, fullKey));
    } else {
      pairs.push(encodeURIComponent(fullKey) + "=" + encodeURIComponent(String(value)));
    }
  }
  return pairs.filter(Boolean).join("&");
}

// Verifies a Stripe webhook signature using Deno's built-in WebCrypto (HMAC-SHA256) — no
// SDK needed. Throws if the signature is invalid or the timestamp is stale (replay
// protection, 5 minute tolerance, matching Stripe's own SDK default).
export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
  toleranceSeconds = 300
): Promise<void> {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [k, v] = part.split("=");
      return [k, v];
    })
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) throw new Error("Malformed Stripe-Signature header");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > toleranceSeconds) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + "." + rawBody));
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected !== signature) throw new Error("Signature verification failed");
}
