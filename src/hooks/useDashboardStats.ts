import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  subMonths,
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  subDays,
} from "date-fns";

export interface DashboardStats {
  totalItems: number;
  availableItems: number;
  borrowedItems: number;
  maintenanceItems: number;
  damagedItems: number;
  totalUsers: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  totalChemicals: number;
  expiringChemicals: number;
  lowStockItems: number;
  recentActivity: any[];
  topBorrowed: any[];
  categoryDistribution: any[];
  monthlyTrends: any[];
  weeklyUsage: any[];
  itemStatusDistribution: any[];
  maintenanceTrends: any[];
  dailyUsageReports: any[];
  studentActivity: any[];
  isLoading: boolean;
  lastUpdated: Date | null;
  refetch: () => void;
}

// Professional chart colors
const CHART_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
];

export const useDashboardStats = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    availableItems: 0,
    borrowedItems: 0,
    maintenanceItems: 0,
    damagedItems: 0,
    totalUsers: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    totalChemicals: 0,
    expiringChemicals: 0,
    lowStockItems: 0,
    recentActivity: [],
    topBorrowed: [],
    categoryDistribution: [],
    monthlyTrends: [],
    weeklyUsage: [],
    itemStatusDistribution: [],
    maintenanceTrends: [],
    dailyUsageReports: [],
    studentActivity: [],
    isLoading: true,
    lastUpdated: null,
    refetch: () => {},
  });

  const fetchStats = useCallback(async () => {
    try {
      setStats((prev) => ({ ...prev, isLoading: true }));

      // Calculate date ranges for queries
      const sixMonthsAgo = subMonths(new Date(), 6).toISOString();
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();

      // Execute ALL queries in parallel for maximum performance
      const [
        itemsResult,
        usersResult,
        requestsResult,
        chemicalsResult,
        activityResult,
        allRequestsResult,
        weeklyRequestsResult,
        categoriesResult,
        maintenanceResult,
        topItemsResult,
        dailyActivityResult,
        departmentsResult,
        issuedItemsResult,
        returnRequestsResult,
        // 15. All active borrows — single source of truth for "borrowed" count
        activeBorrowsResult,
      ] = await Promise.all([
        // 1. Items Stats
        supabase.from("items").select("status, category_id, name"),
        // 2. Users Count
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        // 3. Requests Stats
        supabase.from("borrow_requests").select("status, created_at"),
        // 4. Chemicals Stats
        supabase
          .from("chemicals")
          .select("expiry_date, current_quantity, minimum_quantity"),
        // 5. Recent Activity
        supabase
          .from("audit_logs")
          .select("action, entity_type, entity_id, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(5),
        // 6. Monthly Trends (Last 6 months)
        supabase
          .from("borrow_requests")
          .select("created_at, status")
          .gte("created_at", sixMonthsAgo),
        // 7. Weekly Usage
        supabase
          .from("borrow_requests")
          .select("created_at, status")
          .gte("created_at", weekStart.toISOString())
          .lte("created_at", weekEnd.toISOString()),
        // 8. Category Distribution
        supabase.from("categories").select("name, items(count)"),
        // 9. Maintenance Trends
        supabase
          .from("maintenance_records")
          .select("status, created_at")
          .gte("created_at", sixMonthsAgo),
        // 10. Top Borrowed Items
        supabase
          .from("items")
          .select("name, category:categories(name), issued_items(count)"),
        // 11. Daily Activity - borrow requests for the last 7 days
        supabase
          .from("borrow_requests")
          .select("created_at, status")
          .gte("created_at", sevenDaysAgo),
        // 12. Departments with user counts for student activity
        supabase.from("departments").select("id, name"),
        // 13. Issued items - get all recent issued items for accurate checkout tracking
        supabase
          .from("issued_items")
          .select("returned_date, created_at, status")
          .or(
            `created_at.gte.${sevenDaysAgo},returned_date.gte.${sevenDaysAgo}`,
          ),
        // 14. Return requests - track verified returns from students
        supabase
          .from("return_requests")
          .select("created_at, status, return_datetime")
          .gte("created_at", sevenDaysAgo),
        // 15. CANONICAL SOURCE OF TRUTH for "borrowed" count across the entire app.
        // BorrowAnalytics.tsx, Dashboard, and any new feature MUST use this same query
        // to count active borrows: issued_items WHERE status='active' AND returned_date IS NULL.
        // Do NOT count from borrow_requests status — that can go out of sync.
        supabase
          .from("issued_items")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .is("returned_date", null),
      ]);

      // Process Items Stats
      const items = itemsResult.data || [];
      const totalItems = items.length;
      const availableItems = items.filter(
        (i) => i.status === "available",
      ).length;
      const borrowedItems = activeBorrowsResult.count || 0; // Source of truth: active issued_items
      const maintenanceItems = items.filter(
        (i) => i.status === "under_maintenance",
      ).length;
      const damagedItems = items.filter((i) => i.status === "damaged").length;

      // Process Users Count
      const totalUsers = usersResult.count || 0;

      // Process Requests Stats
      const requests = requestsResult.data || [];
      const pendingRequests = requests.filter(
        (r) => r.status === "pending",
      ).length;
      const approvedRequests = requests.filter(
        (r) => r.status === "approved",
      ).length;
      const rejectedRequests = requests.filter(
        (r) => r.status === "rejected",
      ).length;

      // Process Chemicals Stats
      const chemicals = chemicalsResult.data || [];
      const totalChemicals = chemicals.length;
      const today = new Date();
      const expiringChemicals = chemicals.filter((c) => {
        if (!c.expiry_date) return false;
        const expiry = new Date(c.expiry_date);
        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30 && diffDays >= 0;
      }).length;
      const lowStockItems = chemicals.filter(
        (c) => c.current_quantity <= (c.minimum_quantity || 0),
      ).length;

      // Process Recent Activity - REAL DATA ONLY
      const recentActivity = activityResult.data || [];

      // Process Monthly Trends - ALWAYS REAL DATA (shows zeros if empty)
      const allRequests = allRequestsResult.data || [];
      const monthlyTrends = new Array(6).fill(0).map((_, i) => {
        const date = subMonths(new Date(), 5 - i);
        const monthKey = format(date, "MMM");
        const monthRequests = allRequests.filter(
          (r) =>
            format(new Date(r.created_at), "MMM yyyy") ===
            format(date, "MMM yyyy"),
        );
        return {
          name: monthKey,
          requests: monthRequests.length,
          approved: monthRequests.filter((r) => r.status === "approved").length,
          rejected: monthRequests.filter((r) => r.status === "rejected").length,
        };
      });

      // Process Weekly Usage - ALWAYS REAL DATA
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const weeklyRequests = weeklyRequestsResult.data || [];
      const weeklyUsage = weekDays.map((day) => {
        const dayKey = format(day, "EEE");
        const dayRequests = weeklyRequests.filter(
          (r) =>
            format(new Date(r.created_at), "yyyy-MM-dd") ===
            format(day, "yyyy-MM-dd"),
        );
        return {
          name: dayKey,
          value: dayRequests.length,
          borrowed: dayRequests.filter((r) => r.status === "approved").length,
          returned: 0, // Will be calculated from issued_items
        };
      });

      // Process Daily Usage Reports - COMBINE issued_items AND return_requests for accuracy
      const dailyActivity = dailyActivityResult.data || [];
      const issuedItems = issuedItemsResult.data || [];
      const returnRequests = returnRequestsResult.data || [];

      const dailyUsageReports = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        const dateStr = format(date, "yyyy-MM-dd");

        // Count checkouts from issued_items (items physically issued on this day)
        const dayIssuedCheckouts = issuedItems.filter(
          (item) => format(new Date(item.created_at), "yyyy-MM-dd") === dateStr,
        ).length;

        // Count returns from issued_items where returned_date matches
        const dayIssuedReturns = issuedItems.filter(
          (item) =>
            item.returned_date &&
            format(new Date(item.returned_date), "yyyy-MM-dd") === dateStr,
        ).length;

        // Count verified returns from return_requests table (status = 'verified' or 'approved')
        const dayReturnRequests = returnRequests.filter((r) => {
          const returnDate = r.return_datetime
            ? format(new Date(r.return_datetime), "yyyy-MM-dd")
            : format(new Date(r.created_at), "yyyy-MM-dd");
          return (
            returnDate === dateStr &&
            (r.status === "verified" ||
              r.status === "approved" ||
              r.status === "completed")
          );
        }).length;

        // Count borrow requests (approved = checkouts)
        const dayApprovedRequests = dailyActivity.filter(
          (r) =>
            format(new Date(r.created_at), "yyyy-MM-dd") === dateStr &&
            r.status === "approved",
        ).length;

        // Total checkouts: issued items OR approved borrow requests (use max to avoid duplication)
        const totalCheckouts = Math.max(
          dayIssuedCheckouts,
          dayApprovedRequests,
        );

        // Total returns: combine issued_items returns + verified return_requests (unique count)
        const totalReturns = dayIssuedReturns + dayReturnRequests;

        return {
          name: format(date, "dd MMM"),
          shortName: format(date, "EEE"),
          checkouts: totalCheckouts,
          returns: totalReturns,
          requests: dailyActivity.filter(
            (r) => format(new Date(r.created_at), "yyyy-MM-dd") === dateStr,
          ).length,
        };
      });

      // Process Category Distribution - ALWAYS REAL DATA
      const categories = categoriesResult.data || [];
      const categoryDistribution = categories
        .map((c, i) => ({
          name: c.name.length > 12 ? c.name.substring(0, 12) + "..." : c.name,
          fullName: c.name,
          value: c.items?.[0]?.count || 0,
          color: CHART_COLORS[i % CHART_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      // Process Item Status Distribution - ALWAYS REAL DATA
      const itemStatusDistribution = [
        { name: "Available", value: availableItems, color: "#22c55e" },
        { name: "Borrowed", value: borrowedItems, color: "#3b82f6" },
        { name: "Maintenance", value: maintenanceItems, color: "#f59e0b" },
        { name: "Damaged", value: damagedItems, color: "#ef4444" },
      ].filter((item) => item.value > 0);

      // Process Maintenance Trends - ALWAYS REAL DATA with improved aggregation
      // Note: maintenance_status enum is: pending, in_progress, on_hold, completed, scrapped
      const maintenanceRecords = maintenanceResult.data || [];
      const hasAnyMaintenance = maintenanceRecords.length > 0;

      const maintenanceTrends = new Array(6).fill(0).map((_, i) => {
        const date = subMonths(new Date(), 5 - i);
        const monthKey = format(date, "MMM");
        const monthRecords = maintenanceRecords.filter(
          (r) =>
            format(new Date(r.created_at), "MMM yyyy") ===
            format(date, "MMM yyyy"),
        );
        const completed = monthRecords.filter(
          (r) => r.status === "completed",
        ).length;
        const pending = monthRecords.filter(
          (r) => r.status === "pending" || r.status === "on_hold",
        ).length;
        const inProgress = monthRecords.filter(
          (r) => r.status === "in_progress",
        ).length;
        const scrapped = monthRecords.filter(
          (r) => r.status === "scrapped",
        ).length;
        return {
          name: monthKey,
          total: monthRecords.length,
          completed,
          pending,
          inProgress,
          scrapped,
          // Flag to indicate if there's ANY maintenance data in the system
          hasData: hasAnyMaintenance,
        };
      });

      // Process Student Activity by Department - REAL DATA
      const departments = departmentsResult.data || [];

      // Get user department assignments
      const { data: userDepartments } = await supabase
        .from("user_departments")
        .select("user_id, department_id");

      // Get borrow requests
      const { data: allBorrowRequests } = await supabase
        .from("borrow_requests")
        .select("student_id, status")
        .gte("created_at", sixMonthsAgo);

      const studentActivity = departments
        .map((dept) => {
          // Find users in this department
          const deptUserIds = (userDepartments || [])
            .filter((ud) => ud.department_id === dept.id)
            .map((ud) => ud.user_id);

          // Count requests from users in this department
          const deptRequests = (allBorrowRequests || []).filter((r) =>
            deptUserIds.includes(r.student_id),
          );

          const uniqueStudents = new Set(deptRequests.map((r) => r.student_id))
            .size;
          const borrowedCount = deptRequests.filter(
            (r) => r.status === "approved",
          ).length;

          return {
            name:
              dept.name.length > 10
                ? dept.name.substring(0, 10) + "..."
                : dept.name,
            fullName: dept.name,
            active: uniqueStudents,
            borrowed: borrowedCount,
            requests: deptRequests.length,
          };
        })
        .slice(0, 5);

      // Process Top Borrowed Items - REAL DATA ONLY
      const topItemsData = topItemsResult.data || [];
      const topBorrowed = topItemsData
        .map((item) => ({
          name: item.name,
          category: item.category?.name || "Uncategorized",
          count: item.issued_items?.[0]?.count || 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setStats({
        totalItems,
        availableItems,
        borrowedItems,
        maintenanceItems,
        damagedItems,
        totalUsers,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        totalChemicals,
        expiringChemicals,
        lowStockItems,
        recentActivity,
        topBorrowed,
        categoryDistribution,
        monthlyTrends,
        weeklyUsage,
        itemStatusDistribution,
        maintenanceTrends,
        dailyUsageReports,
        studentActivity,
        isLoading: false,
        lastUpdated: new Date(),
        refetch: fetchStats,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      // On error, just set loading to false - don't add fake data
      setStats((prev) => ({
        ...prev,
        isLoading: false,
        lastUpdated: new Date(),
      }));
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Set up real-time subscription for live updates
    const channel = supabase
      .channel("dashboard-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        () => {
          fetchStats();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "borrow_requests" },
        () => {
          fetchStats();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "maintenance_records" },
        () => {
          fetchStats();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "issued_items" },
        () => {
          fetchStats();
        },
      )
      .subscribe();

    // Refresh stats every 5 minutes
    const intervalId = setInterval(fetchStats, 5 * 60 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, [fetchStats]);

  return { ...stats, refetch: fetchStats };
};

export default useDashboardStats;
