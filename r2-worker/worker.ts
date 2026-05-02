interface Env {
  BUCKET: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/") {
      return new Response(JSON.stringify({ status: "ok", service: "taika-r2-upload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List files: GET /list
    if (request.method === "GET" && url.pathname === "/list") {
      const listed = await env.BUCKET.list({ prefix: "avatars/" });
      const files = listed.objects.map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded }));
      return new Response(JSON.stringify(files, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload: POST /upload
    if (request.method === "POST" && url.pathname === "/upload") {
      try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        let folder = formData.get("folder") as string | null;
        
        if (!folder) {
          folder = "avatars"; // Default for backward compatibility
        } else {
          folder = folder.replace(/\/+$/, ""); // Clean trailing slashes
        }

        if (!file) {
          return new Response(JSON.stringify({ error: "No file provided" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Generate unique key
        const ext = file.name.split(".").pop() || "jpg";
        const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        // Upload to R2
        await env.BUCKET.put(key, file.stream(), {
          httpMetadata: { contentType: file.type },
        });

        // Return the key (frontend will construct full URL)
        return new Response(JSON.stringify({ key, filename: file.name, size: file.size }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get file: GET or HEAD /file/:key
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/file/")) {
      const key = decodeURIComponent(url.pathname.slice(6)); // Remove "/file/"
      const object = await env.BUCKET.get(key);

      if (!object) {
        return new Response("Not Found: " + key, { status: 404, headers: corsHeaders });
      }

      const headers = {
        ...corsHeaders,
        "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000",
      };

      if (request.method === "HEAD") {
        return new Response(null, { headers });
      }

      return new Response(object.body, { headers });
    }

    // Delete file: DELETE /file/:key
    if (request.method === "DELETE" && url.pathname.startsWith("/file/")) {
      const key = decodeURIComponent(url.pathname.slice(6)); // Remove "/file/"
      await env.BUCKET.delete(key);
      return new Response(JSON.stringify({ success: true, deleted: key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
