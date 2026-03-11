import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DeleteUserRequest {
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("=== Delete User Function Started ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get authorization header
    const authHeader = req.headers.get("authorization");
    const apiKey = req.headers.get("apikey");
    
    if (!authHeader && !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify requesting user
    let requestingUser = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError) {
        console.error("Auth error:", authError.message);
        // Try to proceed if we have apikey (for service role calls)
        if (!apiKey) {
          return new Response(
            JSON.stringify({ success: false, error: "Session expired. Please refresh the page and try again." }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      } else {
        requestingUser = data.user;
      }
    }
    
    if (!requestingUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not verify user. Please log out and log back in." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Only admins can delete users" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse request body
    const { user_id }: DeleteUserRequest = await req.json();
    console.log("Deleting user:", user_id);

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "User ID is required" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if trying to delete own account
    if (user_id === requestingUser.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot delete your own account" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if trying to delete default admin
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_default_admin, full_name")
      .eq("id", user_id)
      .single();

    if (targetProfile?.is_default_admin) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot delete the default admin account" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Delete related records first (due to foreign key constraints)
    // Order matters - delete child records before parent
    
    // Delete from user_departments
    await supabaseAdmin.from("user_departments").delete().eq("user_id", user_id);
    console.log("Deleted user_departments");

    // Delete from user_roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    console.log("Deleted user_roles");

    // Delete from login_logs
    await supabaseAdmin.from("login_logs").delete().eq("user_id", user_id);
    console.log("Deleted login_logs");

    // Delete from notifications
    await supabaseAdmin.from("notifications").delete().eq("user_id", user_id);
    console.log("Deleted notifications");

    // Delete from audit_logs (user_id references profiles)
    await supabaseAdmin.from("audit_logs").delete().eq("user_id", user_id);
    console.log("Deleted audit_logs");

    // Delete from activity_logs if exists
    try {
      await supabaseAdmin.from("activity_logs").delete().eq("user_id", user_id);
      console.log("Deleted activity_logs");
    } catch (e) {
      console.log("activity_logs table may not exist, skipping");
    }

    // Delete from borrow_requests if user is the requester
    try {
      await supabaseAdmin.from("borrow_requests").delete().eq("user_id", user_id);
      console.log("Deleted borrow_requests");
    } catch (e) {
      console.log("borrow_requests cleanup skipped");
    }

    // Delete from otp_verifications (by email)
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", user_id)
      .single();
    
    if (profileData?.email) {
      await supabaseAdmin.from("otp_verifications").delete().eq("email", profileData.email);
      console.log("Deleted otp_verifications");
    }

    // Delete profile
    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", user_id);

    if (profileDeleteError) {
      console.error("Profile delete error:", profileDeleteError.message);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to delete profile: " + profileDeleteError.message }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    console.log("Deleted profile");

    // Finally, delete auth user
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (authDeleteError) {
      console.error("Auth delete error:", authDeleteError.message);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to delete auth user: " + authDeleteError.message }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    console.log("Deleted auth user");

    console.log("=== User deleted successfully ===");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `User ${targetProfile?.full_name || user_id} has been permanently deleted`
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
