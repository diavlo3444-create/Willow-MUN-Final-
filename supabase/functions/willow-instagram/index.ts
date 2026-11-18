import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const OFFICIAL_ACCOUNT = {
  username: "willow.mun",
  handle: "@willow.mun",
  profileUrl: "https://www.instagram.com/willow.mun/",
};

function jsonResponse(body: unknown, status = 200, cacheSeconds = 300) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`,
    },
  });
}

function isSafeHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, 0);
  }

  let limit = 6;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const requested = Number(body?.limit);
      if (Number.isFinite(requested) && requested >= 1 && requested <= 12) {
        limit = Math.floor(requested);
      }
    } catch {
      // Ignore empty body on POST
    }
  } else {
    const url = new URL(req.url);
    const requested = Number(url.searchParams.get("limit"));
    if (Number.isFinite(requested) && requested >= 1 && requested <= 12) {
      limit = Math.floor(requested);
    }
  }

  const accessToken = (Deno.env.get("INSTAGRAM_ACCESS_TOKEN") || "").trim();
  if (!accessToken) {
    return jsonResponse(
      {
        configured: false,
        account: OFFICIAL_ACCOUNT,
        posts: [],
      },
      200,
      120,
    );
  }

  const userId = (Deno.env.get("INSTAGRAM_USER_ID") || "me").trim();
  const graphHost = (Deno.env.get("INSTAGRAM_GRAPH_HOST") || "graph.instagram.com").trim();
  const graphVersion = (Deno.env.get("INSTAGRAM_GRAPH_VERSION") || "v21.0").trim();
  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  const endpoint = `https://${graphHost}/${graphVersion}/${encodeURIComponent(userId)}/media?fields=${encodeURIComponent(fields)}&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    const upstream = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      return jsonResponse(
        {
          configured: false,
          account: OFFICIAL_ACCOUNT,
          posts: [],
          reason: "upstream_unavailable",
        },
        200,
        60,
      );
    }

    const payload = (await upstream.json()) as { data?: unknown[] };
    const rawList = Array.isArray(payload?.data) ? payload.data : [];

    const posts = rawList
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => {
        const mediaType = String(item.media_type || "IMAGE").toUpperCase();
        const imageUrl =
          mediaType === "VIDEO"
            ? item.thumbnail_url
            : (item.media_url ?? item.thumbnail_url);

        if (
          typeof item.id !== "string" ||
          !isSafeHttpsUrl(imageUrl) ||
          !isSafeHttpsUrl(item.permalink)
        ) {
          return null;
        }

        return {
          id: item.id,
          caption: typeof item.caption === "string" ? item.caption : "",
          media_type: mediaType,
          media_url: item.media_url,
          thumbnail_url: item.thumbnail_url,
          imageUrl,
          permalink: item.permalink,
          timestamp: typeof item.timestamp === "string" ? item.timestamp : "",
        };
      })
      .filter(Boolean)
      .slice(0, limit);

    return jsonResponse(
      {
        configured: posts.length > 0,
        account: OFFICIAL_ACCOUNT,
        posts,
      },
      200,
      300,
    );
  } catch {
    return jsonResponse(
      {
        configured: false,
        account: OFFICIAL_ACCOUNT,
        posts: [],
        reason: "fetch_failed",
      },
      200,
      60,
    );
  }
});
