import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the calling user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Request from user:', user.id);

    // Check if the calling user is an admin
    const { data: adminCheck, error: adminCheckError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (adminCheckError) {
      console.error('Error checking admin status:', adminCheckError);
      throw new Error('Error verifying admin status');
    }

    if (!adminCheck) {
      console.log('User is not an admin:', user.id);
      throw new Error('Only admins can grant admin roles');
    }

    console.log('User is admin, proceeding with role grant');

    // Rate limiting: Check recent admin grants (max 5 per hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: recentGrants } = await supabase
      .from('admin_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('performed_by', user.id)
      .gte('created_at', oneHourAgo);

    if (recentGrants && recentGrants >= 5) {
      console.log('Rate limit exceeded for user:', user.id);
      throw new Error('Rate limit exceeded. Maximum 5 admin role grants per hour.');
    }

    // Get the target user email from request body
    const { targetUserEmail, role = 'admin' } = await req.json();

    if (!targetUserEmail) {
      throw new Error('Target user email is required');
    }

    // Find the target user by email
    const { data: targetUsers, error: findError } = await supabase.auth.admin.listUsers();

    if (findError) {
      console.error('Error finding users:', findError);
      throw new Error('Error finding target user');
    }

    const targetUser = targetUsers.users.find(u => u.email === targetUserEmail);

    if (!targetUser) {
      throw new Error(`User with email ${targetUserEmail} not found`);
    }

    console.log('Found target user:', targetUser.id);

    // Check if user already has the role
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', targetUser.id)
      .eq('role', role)
      .maybeSingle();

    if (existingRole) {
      return new Response(
        JSON.stringify({ 
          message: `User ${targetUserEmail} already has ${role} role`,
          userId: targetUser.id,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Grant the role using service role key (bypasses RLS)
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: targetUser.id,
        role: role,
      });

    if (insertError) {
      console.error('Error inserting role:', insertError);
      throw new Error(`Failed to grant ${role} role: ${insertError.message}`);
    }

    console.log(`Successfully granted ${role} role to user:`, targetUser.id);

    // Log admin role grant to audit trail
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const { error: auditError } = await supabase
      .from('admin_audit_log')
      .insert({
        action: 'grant_admin_role',
        performed_by: user.id,
        target_user_id: targetUser.id,
        role_granted: role,
        ip_address: ipAddress,
      });

    if (auditError) {
      console.error('Failed to log audit trail:', auditError);
      // Continue anyway - audit failure shouldn't block the operation
    }

    return new Response(
      JSON.stringify({ 
        message: `Successfully granted ${role} role to ${targetUserEmail}`,
        userId: targetUser.id,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in grant-admin-role function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: error.message.includes('Unauthorized') || error.message.includes('Only admins') ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
