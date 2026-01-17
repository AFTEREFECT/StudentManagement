import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-WAHA-Server, X-WAHA-API-Key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    constahwServerUrl = req.headers.get("X-WAHA-Server");
    constahwApiKey = req.headers.get("X-WAHA-API-Key");

    if (!wahaServerUrl) {
      return new Response(
        JSON.stringify({ error: "X-WAHA-Server header is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(req.url);
    const targetPath = url.searchParams.get("path") || "/api/sessions";

    let normalizedUrl =ahwServerUrl.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = "http://" + normalizedUrl;
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, "");

    const targetUrl = `${normalizedUrl}${targetPath}`;

    console.log(`🔄 Proxying request to: ${targetUrl}`);
    console.log(`📝 Method: ${req.method}`);

    const proxyHeaders: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (wahaApiKey) {
      proxyHeaders["X-Api-Key"] =ahwApiKey;
    }

    let body = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      try {
        body = await req.text();
      } catch (e) {
        console.error("Error reading request body:", e);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(targetUrl, {
        method: req.method,
        headers: proxyHeaders,
        body: body,
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "Request timeout", details: "انتهت مهلة الاتصال بخادمahw" }),
          {
            status: 504,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.error("Fetch error:", fetchError);
      return new Response(
        JSON.stringify({
          error: "Connection failed",
          details: `فشل الاتصال بخادمahw: ${fetchError.message}`,
          serverUrl: normalizedUrl
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    clearTimeout(timeoutId);

    const responseText = await response.text();

    console.log(`✅ Response status: ${response.status}`);

    return new Response(responseText, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("❌ Proxy error:", error);

    return new Response(
      JSON.stringify({
        error: "Proxy error",
        details: error instanceof Error ? error.message : "خطأ غير معروف في الاتصال"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});