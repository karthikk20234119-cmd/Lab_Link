import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { subMonths, format } from "date-fns";

export interface StudentDashboardStats {
  // Profile
  fullName: string;
  email: string;
  departmentName: string;
  collegeName: string;

  // Borrow Stats
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  activeBorrows: number;
  returnedItems: number;
  pendingReturns: number;

  // Lists
  recentRequests: Array<{
    id: string;
    itemName: string;
    status: string;
    requestedStartDate: string;
    requestedEndDate: string;
    createdAt: string;
    quantity: number;
  }>;
  activeBorrowsList: Array<{
    id: string;
    itemName: string;
    issuedDate: string;
    dueDate: string;
    quantityIssued: number;
    conditionAtIssue: string;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    type: string;
  }>;

  // Chart Data
  borrowStatusDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  monthlyBorrowTrends: Array<{
    name: string;
    requests: number;
    approved: number;
  }>;

  isLoading: boolean;
  lastUpdated: Date | null;
  refetch: () => void;
}

export const useStudentDashboardStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<StudentDashboardStats>({
    fullName: "",
    email: "",
    departmentName: "",
    collegeName: "",
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    activeBorrows: 0,
    returnedItems: 0,
    pendingReturns: 0,
    recentRequests: [],
    activeBorrowsList: [],
    notifications: [],
    borrowStatusDistribution: [],
    monthlyBorrowTrends: [],
    isLoading: true,
    lastUpdated: null,
    refetch: () => {},
  });

  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      setStats((prev) => ({ ...prev, isLoading: true }));

      const userId = user.id;
      const sixMonthsAgo = subMonths(new Date(), 6).toISOString();

      // Execute all queries in parallel
      const [
        profileResult,
        borrowRequestsResult,
        activeBorrowsResult,
        issuedItemsResult,
        returnRequestsResult,
        notificationsResult,
        monthlyRequestsResult,
        departmentResult,
      ] = await Promise.all([
        // 1. Profile info
        supabase
          .from("profiles")
          .select("full_name, email, college_name")
          .eq("id", userId)
          .single(),

        // 2. All borrow requests by this student
        supabase
          .from("borrow_requests")
          .select(
            "id, item_id, status, requested_start_date, requested_end_date, created_at, quantity, items(name)",
          )
          .eq("student_id", userId)
          .order("created_at", { ascending: false }),

        // 3. Active borrows count
        supabase
          .from("issued_items")
          .select("id", { count: "exact", head: true })
          .eq("issued_to", userId)
          .eq("status", "active")
          .is("returned_date", null),

        // 4. Issued items list (active ones for display)
        supabase
          .from("issued_items")
          .select(
            "id, item_id, issued_date, due_date, quantity_issued, condition_at_issue, status, returned_date, items(name)",
          )
          .eq("issued_to", userId)
          .eq("status", "active")
          .is("returned_date", null)
          .order("issued_date", { ascending: false }),

        // 5. Return requests by this student
        supabase
          .from("return_requests")
          .select("id, status, created_at")
          .eq("student_id", userId),

        // 6. Notifications
        supabase
          .from("notifications")
          .select("id, title, message, is_read, created_at, notification_type")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),

        // 7. Monthly borrow trends (last 6 months)
        supabase
          .from("borrow_requests")
          .select("created_at, status")
          .eq("student_id", userId)
          .gte("created_at", sixMonthsAgo),

        // 8. User department
        supabase
          .from("user_departments")
          .select("departments(name)")
          .eq("user_id", userId)
          .limit(1),
      ]);

      // Process profile
      const profile = profileResult.data;
      const fullName =
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Student";
      const email = profile?.email || user.email || "";
      const collegeName = profile?.college_name || "";

      // Process department
      const deptData = departmentResult.data;
      const departmentName =
        (deptData &&
          deptData.length > 0 &&
          (deptData[0] as any)?.departments?.name) ||
        "Not assigned";

      // Process borrow requests
      const allRequests = borrowRequestsResult.data || [];
      const totalRequests = allRequests.length;
      const pendingRequests = allRequests.filter(
        (r) => r.status === "pending",
      ).length;
      const approvedRequests = allRequests.filter(
        (r) => r.status === "approved",
      ).length;
      const rejectedRequests = allRequests.filter(
        (r) => r.status === "rejected",
      ).length;

      // Active borrows
      const activeBorrows = activeBorrowsResult.count || 0;

      // Return requests
      const returnReqs = returnRequestsResult.data || [];
      const returnedItems = returnReqs.filter(
        (r) =>
          r.status === "accepted" ||
          r.status === "verified" ||
          r.status === "returned" ||
          r.status === "completed",
      ).length;
      const pendingReturns = returnReqs.filter(
        (r) => r.status === "pending" || r.status === "return_pending",
      ).length;

      // Recent requests for list
      const recentRequests = allRequests.slice(0, 8).map((r) => ({
        id: r.id,
        itemName: (r as any).items?.name || "Unknown Item",
        status: r.status || "unknown",
        requestedStartDate: r.requested_start_date || "",
        requestedEndDate: r.requested_end_date || "",
        createdAt: r.created_at || "",
        quantity: r.quantity || 1,
      }));

      // Active borrows list
      const issuedItems = issuedItemsResult.data || [];
      const activeBorrowsList = issuedItems.map((item) => ({
        id: item.id,
        itemName: (item as any).items?.name || "Unknown Item",
        issuedDate: item.issued_date || "",
        dueDate: item.due_date || "",
        quantityIssued: item.quantity_issued || 1,
        conditionAtIssue: item.condition_at_issue || "Good",
      }));

      // Notifications
      const notifs = notificationsResult.data || [];
      const notifications = notifs.map((n) => ({
        id: n.id,
        title: n.title || "",
        message: n.message || "",
        isRead: n.is_read || false,
        createdAt: n.created_at || "",
        type: n.notification_type || "info",
      }));

      // Borrow status distribution for pie chart
      const borrowStatusDistribution = [
        { name: "Pending", value: pendingRequests, color: "#f59e0b" },
        { name: "Approved", value: approvedRequests, color: "#22c55e" },
        { name: "Rejected", value: rejectedRequests, color: "#ef4444" },
      ].filter((item) => item.value > 0);

      // Monthly borrow trends
      const monthlyReqs = monthlyRequestsResult.data || [];
      const monthlyBorrowTrends = new Array(6).fill(0).map((_, i) => {
        const date = subMonths(new Date(), 5 - i);
        const monthKey = format(date, "MMM");
        const monthRequests = monthlyReqs.filter(
          (r) =>
            format(new Date(r.created_at), "MMM yyyy") ===
            format(date, "MMM yyyy"),
        );
        return {
          name: monthKey,
          requests: monthRequests.length,
          approved: monthRequests.filter((r) => r.status === "approved").length,
        };
      });

      setStats({
        fullName,
        email,
        departmentName,
        collegeName,
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        activeBorrows,
        returnedItems,
        pendingReturns,
        recentRequests,
        activeBorrowsList,
        notifications,
        borrowStatusDistribution,
        monthlyBorrowTrends,
        isLoading: false,
        lastUpdated: new Date(),
        refetch: fetchStats,
      });
    } catch (error) {
      console.error("Error fetching student dashboard stats:", error);
      setStats((prev) => ({
        ...prev,
        isLoading: false,
        lastUpdated: new Date(),
      }));
    }
  }, [user]);

  useEffect(() => {
    fetchStats();

    // Real-time subscriptions for student-relevant tables
    const channel = supabase
      .channel("student-dashboard-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "borrow_requests" },
        () => fetchStats(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "issued_items" },
        () => fetchStats(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "return_requests" },
        () => fetchStats(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => fetchStats(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  return { ...stats, refetch: fetchStats };
};

export default useStudentDashboardStats;
