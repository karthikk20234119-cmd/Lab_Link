import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  address?: string;
  role: "admin" | "staff" | "technician" | "student";
  department_id?: string;
  staff_id?: string;
  college_name?: string;
  additional_info?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("=== Create User Function Started ===");

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

    // Verify admin authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
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
        JSON.stringify({ success: false, error: "Only admins can create users" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse request body
    const userData: CreateUserRequest = await req.json();
    console.log("Creating user:", userData.email, "Role:", userData.role);

    if (!userData.email || !userData.password || !userData.full_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Email, password, and full name are required" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create user - NO confirmation email (email_confirm: true means auto-confirmed)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        full_name: userData.full_name,
        phone: userData.phone || null,
        staff_id: userData.staff_id || null,
      }
    });

    if (createError) {
      console.error("Create user error:", createError.message);
      return new Response(
        JSON.stringify({ success: false, error: createError.message }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ success: false, error: "User creation failed" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = newUser.user.id;
    console.log("User created:", userId);

    // Wait for trigger
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update profile
    await supabaseAdmin
      .from("profiles")
      .update({ 
        staff_id: userData.staff_id || null,
        phone: userData.phone || null,
        is_active: true,
        is_verified: true,
      })
      .eq("id", userId);

    // Update role
    if (userData.role && userData.role !== "student") {
      await supabaseAdmin
        .from("user_roles")
        .update({ role: userData.role })
        .eq("user_id", userId);
    }

    // Link department
    if (userData.department_id) {
      await supabaseAdmin
        .from("user_departments")
        .insert({ user_id: userId, department_id: userData.department_id });
    }

    // Send welcome email for Staff/Technician (NOT confirmation - just credentials)
    if (userData.role === "staff" || userData.role === "technician" || userData.role === "admin") {
      try {
        console.log("Sending welcome email to:", userData.email);
        
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            type: "welcome_staff",
            to: userData.email,
            name: userData.full_name,
            email: userData.email,
            password: userData.password,
            role: userData.role.charAt(0).toUpperCase() + userData.role.slice(1),
          }),
        });

        const emailResult = await emailResponse.json();
        console.log("Email result:", emailResult);
      } catch (emailError: any) {
        console.error("Failed to send welcome email:", emailError.message);
        // Don't fail the user creation if email fails
      }
    }

    console.log("=== User creation complete ===");

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: userId, email: newUser.user.email },
        message: "User created successfully. Welcome email sent."
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
