import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type AppRole = "admin" | "staff" | "student" | "technician";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        setRoleLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching user role:", error);
          setUserRole("student"); // Default to student
        } else {
          setUserRole((data?.role as AppRole) || "student");
        }
      } catch (err) {
        console.error("Error:", err);
        setUserRole("student");
      } finally {
        setRoleLoading(false);
      }
    }

    if (user) {
      fetchUserRole();
    } else {
      setRoleLoading(false);
    }
  }, [user]);

  // Show loading state
  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on role
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function useUserRole() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Use get_user_role RPC (SECURITY DEFINER) — bypasses RLS
        const { data, error } = await supabase.rpc("get_user_role", {
          _user_id: user.id,
        });

        if (!error && data) {
          setUserRole(data as AppRole);
        } else {
          // Fallback: try direct table query
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

          setUserRole((roleData?.role as AppRole) || "student");
        }
      } catch {
        setUserRole("student");
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [user]);

  return { userRole, loading };
}
