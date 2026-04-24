import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
  website: z.string().optional(), // honeypot
  user_agent: z.string().max(500).optional(),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      console.log("[submit-contact-message] validation failed", parsed.error.flatten());
      return jsonResponse({ error: "validation" }, 400);
    }

    const { name, email, subject, message, website, user_agent } = parsed.data;

    // Honeypot: se preenchido, finge sucesso e descarta
    if (website && website.trim().length > 0) {
      console.log("[submit-contact-message] honeypot triggered");
      return jsonResponse({ success: true });
    }

    // Captura IP real
    const xff = req.headers.get("x-forwarded-for") ?? "";
    const ip_address = xff.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase.from("contact_messages").insert({
      name,
      email,
      subject,
      message,
      ip_address,
      user_agent: user_agent ?? req.headers.get("user-agent")?.slice(0, 500) ?? null,
    });

    if (error) {
      console.log("[submit-contact-message] db error", error.message);
      const msg = error.message || "";
      if (msg.includes("ratelimit:")) return jsonResponse({ error: "rate_limit" }, 429);
      if (msg.includes("duplicate:")) return jsonResponse({ error: "duplicate" }, 409);
      if (msg.includes("validation:")) return jsonResponse({ error: "validation" }, 400);
      return jsonResponse({ error: "generic" }, 500);
    }

    console.log("[submit-contact-message] success", { email, ip_address });
    return jsonResponse({ success: true });
  } catch (err) {
    console.log("[submit-contact-message] exception", (err as Error).message);
    return jsonResponse({ error: "generic" }, 500);
  }
});
