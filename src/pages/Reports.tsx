import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, Package, Users, TrendingUp, Calendar, BarChart3, PieChart, 
  Download, FileSpreadsheet, Loader2, DollarSign, AlertTriangle,
  Clock, Building, Activity, Boxes
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart as RechartsPieChart, Pie, Cell, Legend, AreaChart, Area,
  LineChart, Line, ComposedChart
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#6366F1"];
const STATUS_COLORS: Record<string, string> = {
  available: "#10B981",
  borrowed: "#3B82F6",
  under_maintenance: "#F59E0B",
  damaged: "#EF4444",
  archived: "#6B7280",
};

interface ReportStats {
  totalItems: number;
  totalUsers: number;
  totalRequests: number;
  totalMaintenance: number;
  totalValue: number;
  lowStockItems: number;
  overdueItems: number;
  itemsByCategory: { name: string; count: number; value: number }[];
  requestsByStatus: { status: string; count: number }[];
  itemsByStatus: { name: string; value: number; color: string }[];
  topBorrowedItems: { name: string; count: number; code: string }[];
  monthlyTrends: { month: string; requests: number; approved: number; rejected: number }[];
  departmentUsage: { name: string; items: number; requests: number }[];
  recentActivity: { date: string; type: string; description: string }[];
}

interface FilterOption {
  id: string;
  name: string;
}

export default function Reports() {
  const { toast } = useToast();
  const [stats, setStats] = useState<ReportStats>({
    totalItems: 0,
    totalUsers: 0,
    totalRequests: 0,
    totalMaintenance: 0,
    totalValue: 0,
    lowStockItems: 0,
    overdueItems: 0,
    itemsByCategory: [],
    requestsByStatus: [],
    itemsByStatus: [],
    topBorrowedItems: [],
    monthlyTrends: [],
    departmentUsage: [],
    recentActivity: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState({
    from: format(subMonths(new Date(), 3), "yyyy-MM-dd"),
    to: format(new Date(), "yyyy-MM-dd"),
  });
  const [reportType, setReportType] = useState("all");
  const [departments, setDepartments] = useState<FilterOption[]>([]);
  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    fetchStats();
    fetchFilterOptions();
  }, [dateRange, departmentFilter, categoryFilter]);

  const fetchFilterOptions = async () => {
    const [deptResult, catResult] = await Promise.all([
      supabase.from("departments").select("id, name").eq("is_active", true),
      supabase.from("categories").select("id, name"),
    ]);
    if (deptResult.data) setDepartments(deptResult.data);
    if (catResult.data) setCategories(catResult.data);
  };

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      // Execute ALL queries in parallel for maximum performance
      const [
        itemsResult,
        usersResult,
        requestsResult,
        maintenanceResult,
        departmentsResult,
        issuedItemsResult,
      ] = await Promise.all([
        // Fetch items with category details
        supabase.from("items").select("*, category:categories(name)", { count: "exact" }),
        // Fetch users count
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        // Fetch all requests (for better trend analysis)
        supabase.from("borrow_requests").select("*, item:items(name, item_code, department_id)"),
        // Fetch maintenance count
        supabase.from("maintenance_records").select("*", { count: "exact", head: true }),
        // Fetch departments
        supabase.from("departments").select("id, name"),
        // Fetch issued items for accurate borrow counts
        supabase.from("issued_items").select("item_id, item:items(name, item_code)"),
      ]);

      const items = itemsResult.data || [];
      const requests = requestsResult.data || [];
      const deptData = departmentsResult.data || [];
      const issuedItems = issuedItemsResult.data || [];

      // Apply department and category filters to items
      const filteredItems = items.filter(item => {
        const matchesDept = departmentFilter === 'all' || item.department_id === departmentFilter;
        const matchesCat = categoryFilter === 'all' || item.category_id === categoryFilter;
        return matchesDept && matchesCat;
      });

      // Filter requests by date range and department
      const filteredRequests = requests.filter(r => {
        const date = new Date(r.created_at);
        const dateMatch = date >= new Date(dateRange.from) && date <= new Date(dateRange.to + "T23:59:59");
        const deptMatch = departmentFilter === 'all' || r.item?.department_id === departmentFilter;
        return dateMatch && deptMatch;
      });

      // Calculate total value from filtered items
      const totalValue = filteredItems.reduce((sum, item) => sum + (Number(item.purchase_price) || 0), 0);

      // Count low stock items from filtered items
      const lowStockItems = filteredItems.filter(item => 
        item.current_quantity <= (item.reorder_threshold || 5)
      ).length;

      // Items by category with value
      const categoryMap = new Map<string, { count: number; value: number }>();
      filteredItems.forEach(item => {
        const catName = item.category?.name || "Uncategorized";
        const existing = categoryMap.get(catName) || { count: 0, value: 0 };
        categoryMap.set(catName, {
          count: existing.count + 1,
          value: existing.value + (Number(item.purchase_price) || 0),
        });
      });
      const itemsByCategory = Array.from(categoryMap.entries())
        .map(([name, data]) => ({ name, count: data.count, value: data.value }))
        .sort((a, b) => b.count - a.count);

      // Requests by status
      const statusCounts: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
      filteredRequests.forEach(r => {
        const status = r.status || "pending";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      const requestsByStatus = Object.entries(statusCounts)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({
          status: status.charAt(0).toUpperCase() + status.slice(1),
          count,
        }));

      // Items by status
      const itemStatusCounts: Record<string, number> = {};
      filteredItems.forEach(item => {
        const status = item.status || "available";
        itemStatusCounts[status] = (itemStatusCounts[status] || 0) + 1;
      });
      const itemsByStatus = Object.entries(itemStatusCounts)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({
          name: name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          value,
          color: STATUS_COLORS[name] || "#6B7280",
        }));

      // Top borrowed items (from issued_items for accuracy)
      const borrowCounts: Record<string, { count: number; name: string; code: string }> = {};
      issuedItems.forEach(issued => {
        if (issued.item) {
          const key = issued.item.name;
          if (!borrowCounts[key]) {
            borrowCounts[key] = { count: 0, name: issued.item.name, code: issued.item.item_code || "N/A" };
          }
          borrowCounts[key].count++;
        }
      });
      // Also count from borrow requests if no issued items
      if (Object.keys(borrowCounts).length === 0) {
        requests.forEach(r => {
          if (r.item && r.status === "approved") {
            const key = r.item.name;
            if (!borrowCounts[key]) {
              borrowCounts[key] = { count: 0, name: r.item.name, code: r.item.item_code || "N/A" };
            }
            borrowCounts[key].count++;
          }
        });
      }
      const topBorrowedItems = Object.values(borrowCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Monthly trends (last 6 months) - use ALL requests for better trends
      const monthlyTrends: { month: string; requests: number; approved: number; rejected: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(new Date(), i));
        const monthEnd = endOfMonth(subMonths(new Date(), i));
        const monthName = format(monthStart, "MMM");
        
        const monthRequests = requests.filter(r => {
          const date = new Date(r.created_at);
          return date >= monthStart && date <= monthEnd;
        });
        
        monthlyTrends.push({
          month: monthName,
          requests: monthRequests.length,
          approved: monthRequests.filter(r => r.status === "approved").length,
          rejected: monthRequests.filter(r => r.status === "rejected").length,
        });
      }

      // Department usage with request counts
      const deptRequestCounts: Record<string, number> = {};
      requests.forEach(r => {
        if (r.item?.department_id) {
          deptRequestCounts[r.item.department_id] = (deptRequestCounts[r.item.department_id] || 0) + 1;
        }
      });
      
      const departmentUsage = departments.map(dept => {
        const deptItems = items.filter(i => i.department_id === dept.id).length;
        return {
          name: dept.name,
          items: deptItems,
          requests: deptRequestCounts[dept.id] || 0,
        };
      }).sort((a, b) => b.items - a.items);

      setStats({
        totalItems: filteredItems.length,
        totalUsers: usersResult.count || 0,
        totalRequests: filteredRequests.length,
        totalMaintenance: maintenanceResult.count || 0,
        totalValue,
        lowStockItems,
        overdueItems: 0,
        itemsByCategory,
        requestsByStatus,
        itemsByStatus,
        topBorrowedItems,
        monthlyTrends,
        departmentUsage,
        recentActivity: [],
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch report data",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const currentDate = format(new Date(), "MMM dd, yyyy");
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header with gradient effect
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, pageWidth, 35, "F");
      
      // Title
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text("LabLink Inventory Report", 14, 20);
      
      // Subtitle
      doc.setFontSize(10);
      doc.text(`Generated: ${currentDate} | Period: ${dateRange.from} to ${dateRange.to}`, 14, 28);
      
      // Summary Section
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text("Executive Summary", 14, 50);
      
      // Summary cards
      autoTable(doc, {
        startY: 55,
        head: [["Metric", "Value", "Status"]],
        body: [
          ["Total Items", stats.totalItems.toString(), "Active"],
          ["Total Users", stats.totalUsers.toString(), "Registered"],
          ["Borrow Requests", stats.totalRequests.toString(), `Period: ${dateRange.from} to ${dateRange.to}`],
          ["Maintenance Records", stats.totalMaintenance.toString(), "All time"],
          ["Total Asset Value", `Rs. ${stats.totalValue.toLocaleString()}`, "Estimated"],
          ["Low Stock Alerts", stats.lowStockItems.toString(), stats.lowStockItems > 0 ? "[!] Attention Required" : "OK"],
        ],
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 10, cellPadding: 5 },
      });

      // Items by Category
      let yPos = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("Items by Category", 14, yPos);
      
      autoTable(doc, {
        startY: yPos + 5,
        head: [["Category", "Item Count", "Total Value"]],
        body: stats.itemsByCategory.map(cat => [
          cat.name, 
          cat.count.toString(),
          `Rs. ${cat.value.toLocaleString()}`
        ]),
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129] },
      });

      // Requests by Status
      yPos = (doc as any).lastAutoTable.finalY + 15;
      
      // Check if we need a new page
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.text("Request Status Distribution", 14, yPos);
      
      autoTable(doc, {
        startY: yPos + 5,
        head: [["Status", "Count", "Percentage"]],
        body: stats.requestsByStatus.map(req => [
          req.status,
          req.count.toString(),
          `${((req.count / stats.totalRequests) * 100).toFixed(1)}%`
        ]),
        theme: "striped",
        headStyles: { fillColor: [139, 92, 246] },
      });

      // Top Borrowed Items
      if (stats.topBorrowedItems.length > 0) {
        yPos = (doc as any).lastAutoTable.finalY + 15;
        
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text("Top 10 Most Borrowed Items", 14, yPos);
        
        autoTable(doc, {
          startY: yPos + 5,
          head: [["Rank", "Item Name", "Item Code", "Borrow Count"]],
          body: stats.topBorrowedItems.map((item, index) => [
            `#${index + 1}`,
            item.name,
            item.code,
            item.count.toString()
          ]),
          theme: "striped",
          headStyles: { fillColor: [245, 158, 11] },
        });
      }

      // Department Usage
      if (stats.departmentUsage.length > 0) {
        yPos = (doc as any).lastAutoTable.finalY + 15;
        
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text("Items by Department", 14, yPos);
        
        autoTable(doc, {
          startY: yPos + 5,
          head: [["Department", "Item Count"]],
          body: stats.departmentUsage.map(dept => [
            dept.name,
            dept.items.toString()
          ]),
          theme: "striped",
          headStyles: { fillColor: [236, 72, 153] },
        });
      }

      // Footer on all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${i} of ${pageCount} | LabLink Digital Lab Inventory System | Confidential`,
          14,
          doc.internal.pageSize.height - 10
        );
      }

      doc.save(`lablink-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "Success", description: "PDF report downloaded successfully" });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to export PDF" });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const workbook = XLSX.utils.book_new();
      
      // Summary Sheet
      const summaryData = [
        ["LabLink Inventory Report"],
        ["Generated", format(new Date(), "MMM dd, yyyy HH:mm")],
        ["Report Period", `${dateRange.from} to ${dateRange.to}`],
        [],
        ["Metric", "Value"],
        ["Total Items", stats.totalItems],
        ["Total Users", stats.totalUsers],
        ["Borrow Requests", stats.totalRequests],
        ["Maintenance Records", stats.totalMaintenance],
        ["Total Asset Value (Rs.)", stats.totalValue],
        ["Low Stock Alerts", stats.lowStockItems],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!cols"] = [{ wch: 25 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

      // Categories Sheet
      const categoryData = [
        ["Category", "Item Count", "Total Value (Rs.)"],
        ...stats.itemsByCategory.map(cat => [cat.name, cat.count, cat.value]),
      ];
      const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
      categorySheet["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, categorySheet, "By Category");

      // Item Status Sheet
      const statusData = [
        ["Status", "Count"],
        ...stats.itemsByStatus.map(s => [s.name, s.value]),
      ];
      const statusSheet = XLSX.utils.aoa_to_sheet(statusData);
      XLSX.utils.book_append_sheet(workbook, statusSheet, "Item Status");

      // Requests Sheet
      const requestData = [
        ["Status", "Count", "Percentage"],
        ...stats.requestsByStatus.map(req => [
          req.status, 
          req.count,
          `${((req.count / stats.totalRequests) * 100).toFixed(1)}%`
        ]),
      ];
      const requestSheet = XLSX.utils.aoa_to_sheet(requestData);
      XLSX.utils.book_append_sheet(workbook, requestSheet, "Request Status");

      // Top Borrowed Sheet
      if (stats.topBorrowedItems.length > 0) {
        const borrowedData = [
          ["Rank", "Item Name", "Item Code", "Times Borrowed"],
          ...stats.topBorrowedItems.map((item, i) => [i + 1, item.name, item.code, item.count]),
        ];
        const borrowedSheet = XLSX.utils.aoa_to_sheet(borrowedData);
        borrowedSheet["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, borrowedSheet, "Top Borrowed");
      }

      // Monthly Trends Sheet
      const trendsData = [
        ["Month", "Total Requests", "Approved", "Rejected"],
        ...stats.monthlyTrends.map(m => [m.month, m.requests, m.approved, m.rejected]),
      ];
      const trendsSheet = XLSX.utils.aoa_to_sheet(trendsData);
      XLSX.utils.book_append_sheet(workbook, trendsSheet, "Monthly Trends");

      // Department Usage Sheet
      if (stats.departmentUsage.length > 0) {
        const deptData = [
          ["Department", "Item Count"],
          ...stats.departmentUsage.map(d => [d.name, d.items]),
        ];
        const deptSheet = XLSX.utils.aoa_to_sheet(deptData);
        XLSX.utils.book_append_sheet(workbook, deptSheet, "By Department");
      }

      XLSX.writeFile(workbook, `lablink-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast({ title: "Success", description: "Excel report downloaded successfully" });
    } catch (error) {
      console.error("Excel export error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to export Excel" });
    } finally {
      setIsExporting(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color = "blue" }: {
    icon: any;
    title: string;
    value: string | number;
    subtitle?: string;
    color?: string;
  }) => {
    const colorClasses: Record<string, { bg: string; text: string; gradient: string }> = {
      blue: { bg: "bg-blue-500/10", text: "text-blue-500", gradient: "from-blue-500/20 to-blue-500/5" },
      green: { bg: "bg-emerald-500/10", text: "text-emerald-500", gradient: "from-emerald-500/20 to-emerald-500/5" },
      purple: { bg: "bg-purple-500/10", text: "text-purple-500", gradient: "from-purple-500/20 to-purple-500/5" },
      orange: { bg: "bg-orange-500/10", text: "text-orange-500", gradient: "from-orange-500/20 to-orange-500/5" },
      emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500", gradient: "from-emerald-500/20 to-emerald-500/5" },
      red: { bg: "bg-red-500/10", text: "text-red-500", gradient: "from-red-500/20 to-red-500/5" },
    };
    const colors = colorClasses[color] || colorClasses.blue;
    
    return (
      <Card className={`relative overflow-hidden group hover:shadow-lg transition-all duration-300 bg-gradient-to-br ${colors.gradient}`}>
        <div className="absolute top-0 right-0 w-20 h-20 opacity-10">
          <Icon className="w-full h-full" />
        </div>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${colors.bg}`}>
              <Icon className={`h-4 w-4 ${colors.text}`} />
            </div>
            <span className="font-medium">{title}</span>
          </CardDescription>
          <CardTitle className="text-3xl font-bold">
            {isLoading ? <Skeleton className="h-8 w-20" /> : value}
          </CardTitle>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </CardHeader>
      </Card>
    );
  };

  // Empty state component for charts
  const ChartEmptyState = ({ icon: Icon, message }: { icon: any; message: string }) => (
    <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-3">
      <div className="p-4 rounded-full bg-muted/50">
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <p className="text-sm">{message}</p>
      <p className="text-xs text-muted-foreground/70">Data will appear here as activity occurs</p>
    </div>
  );

  return (
    <DashboardLayout title="Reports & Analytics" subtitle="Comprehensive system analytics and exportable reports">
      <div className="space-y-6">
        {/* Controls Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4 items-end justify-between">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="from-date">From Date</Label>
                  <Input
                    id="from-date"
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                    className="w-[160px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to-date">To Date</Label>
                  <Input
                    id="to-date"
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                    className="w-[160px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quick Range</Label>
                  <Select
                    value={reportType}
                    onValueChange={(value) => {
                      setReportType(value);
                      const today = new Date();
                      switch (value) {
                        case "week":
                          setDateRange({
                            from: format(subDays(today, 7), "yyyy-MM-dd"),
                            to: format(today, "yyyy-MM-dd"),
                          });
                          break;
                        case "month":
                          setDateRange({
                            from: format(subMonths(today, 1), "yyyy-MM-dd"),
                            to: format(today, "yyyy-MM-dd"),
                          });
                          break;
                        case "quarter":
                          setDateRange({
                            from: format(subMonths(today, 3), "yyyy-MM-dd"),
                            to: format(today, "yyyy-MM-dd"),
                          });
                          break;
                        case "year":
                          setDateRange({
                            from: format(subMonths(today, 12), "yyyy-MM-dd"),
                            to: format(today, "yyyy-MM-dd"),
                          });
                          break;
                      }
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Last 7 Days</SelectItem>
                      <SelectItem value="month">Last Month</SelectItem>
                      <SelectItem value="quarter">Last Quarter</SelectItem>
                      <SelectItem value="year">Last Year</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportToPDF} disabled={isExporting || isLoading}>
                  {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Export PDF
                </Button>
                <Button variant="outline" onClick={exportToExcel} disabled={isExporting || isLoading}>
                  {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                  Export Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard icon={Package} title="Total Items" value={stats.totalItems} color="blue" />
          <StatCard icon={Users} title="Total Users" value={stats.totalUsers} color="green" />
          <StatCard icon={TrendingUp} title="Requests" value={stats.totalRequests} subtitle="In selected period" color="purple" />
          <StatCard icon={Calendar} title="Maintenance" value={stats.totalMaintenance} color="orange" />
          <StatCard icon={DollarSign} title="Asset Value" value={`₹${stats.totalValue.toLocaleString()}`} color="emerald" />
          <StatCard icon={AlertTriangle} title="Low Stock" value={stats.lowStockItems} subtitle="Need attention" color="red" />
        </div>

        {/* Tabs for different report views */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Trends Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Monthly Request Trends
                  </CardTitle>
                  <CardDescription>Request activity over the last 6 months</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={stats.monthlyTrends}>
                          <defs>
                            <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(255, 255, 255, 0.95)",
                              borderRadius: "12px",
                              border: "1px solid #e5e7eb",
                            }}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="requests"
                            stroke="#3B82F6"
                            fillOpacity={1}
                            fill="url(#colorRequests)"
                            name="Total Requests"
                          />
                          <Line type="monotone" dataKey="approved" stroke="#10B981" strokeWidth={2} name="Approved" />
                          <Line type="monotone" dataKey="rejected" stroke="#EF4444" strokeWidth={2} name="Rejected" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Borrowed Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-orange-500" />
                    Top Borrowed Items
                  </CardTitle>
                  <CardDescription>Most frequently requested items</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : stats.topBorrowedItems.length === 0 ? (
                    <ChartEmptyState icon={Package} message="No borrow data available" />
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.topBorrowedItems} layout="vertical">
                          <defs>
                            <linearGradient id="colorBorrowed" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.8} />
                              <stop offset="100%" stopColor="#F97316" stopOpacity={1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={120} 
                            tick={{ fontSize: 11 }}
                            tickFormatter={(value) => value.length > 15 ? value.slice(0, 15) + "..." : value}
                          />
                          <Tooltip />
                          <Bar dataKey="count" fill="#F59E0B" radius={[0, 4, 4, 0]} name="Times Borrowed" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Items by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Boxes className="h-5 w-5 text-green-500" />
                    Items by Category
                  </CardTitle>
                  <CardDescription>Distribution across categories</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.itemsByCategory}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} name="Item Count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Item Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-purple-500" />
                    Item Status Distribution
                  </CardTitle>
                  <CardDescription>Current status of all items</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={stats.itemsByStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {stats.itemsByStatus.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Category Value Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  Category Asset Values
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Category</th>
                        <th className="text-right py-3 px-4 font-medium">Items</th>
                        <th className="text-right py-3 px-4 font-medium">Total Value</th>
                        <th className="text-right py-3 px-4 font-medium">Avg Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        [1, 2, 3].map((i) => (
                          <tr key={i} className="border-b">
                            <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-4 w-16 ml-auto" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-4 w-24 ml-auto" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                          </tr>
                        ))
                      ) : (
                        stats.itemsByCategory.map((cat, i) => (
                          <tr key={i} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4 font-medium">{cat.name}</td>
                            <td className="text-right py-3 px-4">
                              <Badge variant="secondary">{cat.count}</Badge>
                            </td>
                            <td className="text-right py-3 px-4 font-mono">
                              ₹{cat.value.toLocaleString()}
                            </td>
                            <td className="text-right py-3 px-4 font-mono text-muted-foreground">
                              ₹{cat.count > 0 ? Math.round(cat.value / cat.count).toLocaleString() : 0}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 font-bold">
                        <td className="py-3 px-4">Total</td>
                        <td className="text-right py-3 px-4">{stats.totalItems}</td>
                        <td className="text-right py-3 px-4 font-mono">₹{stats.totalValue.toLocaleString()}</td>
                        <td className="text-right py-3 px-4 font-mono">
                          ₹{stats.totalItems > 0 ? Math.round(stats.totalValue / stats.totalItems).toLocaleString() : 0}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Request Status Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-blue-500" />
                    Request Status Distribution
                  </CardTitle>
                  <CardDescription>Breakdown of request outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : stats.requestsByStatus.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No requests in selected period
                    </div>
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={stats.requestsByStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="count"
                            nameKey="status"
                            label={({ status, count }) => `${status}: ${count}`}
                            labelLine={false}
                          >
                            {stats.requestsByStatus.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Request Summary Cards */}
              <div className="space-y-4">
                {stats.requestsByStatus.map((req, i) => (
                  <Card key={i} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} 
                      />
                      <span className="font-medium">{req.status}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className="text-lg px-3">
                        {req.count}
                      </Badge>
                      <span className="text-muted-foreground text-sm w-16 text-right">
                        {((req.count / stats.totalRequests) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </Card>
                ))}
                {stats.requestsByStatus.length === 0 && !isLoading && (
                  <Card className="p-8 text-center text-muted-foreground">
                    No request data available for the selected period
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Department Items Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-pink-500" />
                    Items by Department
                  </CardTitle>
                  <CardDescription>Inventory distribution across departments</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : stats.departmentUsage.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No department data available
                    </div>
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.departmentUsage} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="items" fill="#EC4899" radius={[0, 4, 4, 0]} name="Items" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Department Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Department Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {isLoading ? (
                      [1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))
                    ) : stats.departmentUsage.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No departments found</p>
                    ) : (
                      stats.departmentUsage.map((dept, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{dept.name}</p>
                            <p className="text-sm text-muted-foreground">{dept.items} items</p>
                          </div>
                          <div className="text-right">
                            <Badge 
                              variant={dept.items > 10 ? "default" : dept.items > 5 ? "secondary" : "outline"}
                            >
                              {dept.items > 10 ? "High" : dept.items > 5 ? "Medium" : "Low"}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
