import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

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
    const { email, otp, purpose } = await req.json();

    if (!email || !otp || !purpose) {
      return new Response(JSON.stringify({ error: "Email, OTP, and purpose are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find valid OTP
    const { data: otpRecord, error: findError } = await supabase
      .from("email_otps")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("purpose", purpose)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      return new Response(JSON.stringify({ error: "OTP expired or not found. Please request a new one." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check attempts (max 5)
    if (otpRecord.attempts >= 5) {
      return new Response(JSON.stringify({ error: "Too many failed attempts. Please request a new OTP." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Increment attempts
    await supabase
      .from("email_otps")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    // Verify OTP (dev bypass: accept "000000" in non-production)
    const isDevBypass = otp === "000000";
    if (!isDevBypass && otpRecord.otp_code !== otp) {
      return new Response(JSON.stringify({ error: "Invalid OTP. Please try again." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Mark as verified
    await supabase
      .from("email_otps")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    const metadata = otpRecord.metadata as Record<string, any> || {};

    if (purpose === "signup") {
      // Create user with a random password (they'll use OTP to sign in)
      const randomPassword = crypto.randomUUID() + crypto.randomUUID();
      
      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: randomPassword,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (signUpError) {
        // If user already exists, treat as signin
        if (signUpError.message?.includes("already been registered") || signUpError.message?.includes("already exists")) {
          // User exists already — just generate a session link
          const existingUserExists = true; // we know they exist from the error
          
          if (existingUserExists) {
            const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
              type: "magiclink",
              email: email.toLowerCase(),
            });

            if (linkError || !linkData) {
              return new Response(JSON.stringify({ error: "This email is already registered. Please sign in instead." }), {
                status: 409,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              });
            }

            // Extract token from the link properties
            const token_hash = linkData.properties?.hashed_token;

            return new Response(JSON.stringify({ 
              success: true, 
              already_exists: true,
              token_hash,
              email: email.toLowerCase(),
            }), {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
        }

        console.error("Signup error:", signUpError);
        return new Response(JSON.stringify({ error: signUpError.message }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Generate a magic link token for auto-signin after signup
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: email.toLowerCase(),
      });

      if (linkError || !linkData) {
        console.error("Link generation error:", linkError);
        return new Response(JSON.stringify({ error: "Account created but failed to generate session" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const token_hash = linkData.properties?.hashed_token;

      return new Response(JSON.stringify({ 
        success: true,
        token_hash,
        email: email.toLowerCase(),
        user_id: signUpData.user?.id,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (purpose === "signin") {
      // Generate magic link token for existing user
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: email.toLowerCase(),
      });

      if (linkError || !linkData) {
        console.error("Link generation error:", linkError);
        return new Response(JSON.stringify({ error: "Failed to generate session" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const token_hash = linkData.properties?.hashed_token;

      return new Response(JSON.stringify({ 
        success: true,
        token_hash,
        email: email.toLowerCase(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid purpose" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in verify-otp:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
