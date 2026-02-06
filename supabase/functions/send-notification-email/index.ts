import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  user_id: string;
  title: string;
  message: string;
  action_url?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { user_id, title, message, action_url }: NotificationEmailRequest = await req.json();

    // Get user's profile to get email
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("name")
      .eq("user_id", user_id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      throw new Error("User profile not found");
    }

    // Get user's email from auth
    const { data: { user }, error: userError } = await supabaseClient.auth.admin.getUserById(user_id);

    if (userError || !user?.email) {
      console.error("Error fetching user:", userError);
      throw new Error("User email not found");
    }

    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: "Showya <notifications@showya.in>",
      to: [user.email],
      subject: title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Showya</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>
            <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">${message}</p>
            
            ${action_url ? `
              <div style="margin: 30px 0; text-align: center;">
                <a href="${action_url}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; padding: 12px 30px; text-decoration: none; 
                          border-radius: 6px; font-weight: 600;">
                  View Details
                </a>
              </div>
            ` : ''}
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 14px; margin: 0;">
                You're receiving this because you're a member of Showya.
              </p>
              <p style="color: #9ca3af; font-size: 14px; margin: 10px 0 0 0;">
                <a href="https://showya.in" style="color: #667eea; text-decoration: none;">Visit Showya</a>
              </p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Update notification to mark email as sent
    await supabaseClient
      .from("notifications")
      .update({ is_email_sent: true })
      .eq("user_id", user_id)
      .eq("title", title)
      .eq("message", message);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-notification-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
