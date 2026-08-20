const UPSTREAM_HOST = "free.finepulfe.xyz";

const corsHeaders = (request, env) => {
  const origin = request.headers.get("Origin") || "",
    allowed = String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers":
      "Accept-Ranges, Content-Length, Content-Range, Content-Type",
    Vary: "Origin",
  };
};

const relayUrl = (requestUrl, targetUrl) => {
  const relay = new URL(requestUrl);
  relay.search = "";
  relay.searchParams.set("url", targetUrl);
  return relay.href;
};

const rewriteManifest = (body, targetUrl, requestUrl) =>
  body
    .split(/\r?\n/)
    .map((line) => {
      if (!line) return line;
      if (!line.startsWith("#"))
        return relayUrl(requestUrl, new URL(line, targetUrl).href);
      return line.replace(/URI="([^"]+)"/g, (_, uri) => {
        const absolute = new URL(uri, targetUrl).href;
        return `URI="${relayUrl(requestUrl, absolute)}"`;
      });
    })
    .join("\n");

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response("Method not allowed", { status: 405, headers: cors });

    const requestedUrl = new URL(request.url),
      rawTarget = requestedUrl.searchParams.get("url");
    if (!rawTarget)
      return new Response("Missing url", { status: 400, headers: cors });

    let target;
    try {
      target = new URL(rawTarget);
    } catch {
      return new Response("Invalid url", { status: 400, headers: cors });
    }
    if (target.protocol !== "https:" || target.hostname !== UPSTREAM_HOST)
      return new Response("Forbidden upstream", { status: 403, headers: cors });

    const upstreamHeaders = new Headers({
      Accept: request.headers.get("Accept") || "*/*",
    });
    const range = request.headers.get("Range");
    if (range) upstreamHeaders.set("Range", range);

    const upstream = await fetch(target.href, {
      method: request.method,
      headers: upstreamHeaders,
      redirect: "follow",
    });
    const headers = new Headers(upstream.headers);
    Object.entries(cors).forEach(([key, value]) => headers.set(key, value));

    const isManifest = /\.m3u8(?:$|\?)/i.test(target.href);
    if (isManifest && upstream.ok && request.method !== "HEAD") {
      const rewritten = rewriteManifest(
        await upstream.text(),
        target.href,
        request.url,
      );
      headers.set("Content-Type", "application/vnd.apple.mpegurl");
      headers.delete("Content-Length");
      headers.set("Cache-Control", "public, max-age=2");
      return new Response(rewritten, { status: upstream.status, headers });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};
