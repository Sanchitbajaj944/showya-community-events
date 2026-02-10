import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, purpose, metadata } = await req.json();

    if (!email || !purpose) {
      return new Response(JSON.stringify({ error: "Email and purpose are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!["signin", "signup"].includes(purpose)) {
      return new Response(JSON.stringify({ error: "Invalid purpose" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // For signin, check if user exists using GoTrue Admin REST API
    if (purpose === "signin") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      const res = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(email.toLowerCase())}`,
        {
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
          },
        }
      );
      const data = await res.json();
      const userExists = data?.users?.some((u: any) => u.email === email.toLowerCase());
      
      if (!userExists) {
        return new Response(JSON.stringify({ error: "No account found with this email. Please sign up first." }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Rate limit: max 3 OTPs per email in 10 minutes
    const { count } = await supabase
      .from("email_otps")
      .select("id", { count: "exact", head: true })
      .eq("email", email.toLowerCase())
      .gt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if ((count || 0) >= 3) {
      return new Response(JSON.stringify({ error: "Too many OTP requests. Please wait a few minutes." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Store OTP (expires in 10 minutes)
    const { error: insertError } = await supabase.from("email_otps").insert({
      email: email.toLowerCase(),
      otp_code: otp,
      purpose,
      metadata: metadata || {},
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (insertError) {
      console.error("Failed to store OTP:", insertError);
      return new Response(JSON.stringify({ error: "Failed to generate OTP" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Send OTP via Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://showya.app";

    const { error: emailError } = await resend.emails.send({
      from: "Showya <noreply@showya.app>",
      to: [email],
      subject: `${otp} is your Showya verification code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a1a; margin-bottom: 8px;">Your verification code</h2>
          <p style="color: #666; margin-bottom: 24px;">Enter this code to ${purpose === "signup" ? "create your account" : "sign in"}:</p>
          <div style="background: #f4f4f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">${otp}</span>
          </div>
          <p style="color: #999; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (emailError) {
      console.error("Failed to send OTP email:", emailError);
      return new Response(JSON.stringify({ error: "Failed to send OTP email" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`OTP sent to ${email} for ${purpose}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-otp:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
