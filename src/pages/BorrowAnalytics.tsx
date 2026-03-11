import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BorrowStatusBadge } from "@/components/borrow/BorrowStatusBadge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  BarChart3,
  PieChartIcon,
  TrendingUp,
  Package,
  RotateCcw,
  AlertTriangle,
  Calendar,
  Filter,
  Search,
  Download,
  User,
  Building2,
  Eye,
  Image as ImageIcon,
} from "lucide-react";
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
} from "date-fns";

interface BorrowRequest {
  id: string;
  item_id: string;
  student_id: string;
  requested_start_date: string;
  requested_end_date: string;
  purpose: string | null;
  status: string;
  quantity: number;
  approved_by: string | null;
  approved_date: string | null;
  rejection_reason: string | null;
  pickup_location: string | null;
  collection_datetime: string | null;
  conditions: string | null;
  staff_message: string | null;
  item_department_id: string | null;
  created_at: string;
  item?: { name: string; department_id: string };
  student?: { full_name: string };
  approver?: { full_name: string };
}

interface ReturnRequest {
  id: string;
  borrow_request_id: string;
  student_id: string;
  item_id: string;
  quantity: number;
  return_datetime: string;
  item_condition: string;
  condition_notes: string | null;
  return_image_url: string;
  status: string;
  item?: { name: string };
  student?: { full_name: string };
}

interface Department {
  id: string;
  name: string;
}

const CHART_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

export default function BorrowAnalytics() {
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeBorrowCount, setActiveBorrowCount] = useState(0); // Source of truth: issued_items
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(
    format(subMonths(new Date(), 6), "yyyy-MM-dd"),
  );
  const [dateTo, setDateTo] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [borrowRes, returnRes, deptRes, activeBorrowsRes] =
        await Promise.all([
          supabase
            .from("borrow_requests")
            .select(
              `
            *,
            item:items(name, department_id),
            student:profiles!borrow_requests_student_id_fkey(full_name),
            approver:profiles!borrow_requests_approved_by_fkey(full_name)
          `,
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("return_requests")
            .select(
              `
            *,
            item:items(name),
            student:profiles!return_requests_student_id_fkey(full_name)
          `,
            )
            .order("return_datetime", { ascending: false }),
          supabase
            .from("departments")
            .select("id, name")
            .eq("is_active", true)
            .order("name"),
          // Source of truth for active borrows — matches Dashboard's query exactly
          supabase
            .from("issued_items")
            .select("id", { count: "exact", head: true })
            .eq("status", "active")
            .is("returned_date", null),
        ]);

      if (borrowRes.error) throw borrowRes.error;
      if (returnRes.error) throw returnRes.error;
      if (deptRes.error) throw deptRes.error;

      setBorrowRequests((borrowRes.data || []) as unknown as BorrowRequest[]);
      setReturnRequests((returnRes.data || []) as unknown as ReturnRequest[]);
      setDepartments(deptRes.data || []);
      setActiveBorrowCount(activeBorrowsRes.count || 0);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered data
  const filteredBorrows = useMemo(() => {
    return borrowRequests.filter((req) => {
      const matchesDepartment =
        departmentFilter === "all" ||
        req.item_department_id === departmentFilter;
      const matchesStatus =
        statusFilter === "all" || req.status === statusFilter;
      const matchesSearch =
        req.item?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.student?.full_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

      const reqDate = parseISO(req.created_at);
      const matchesDate = isWithinInterval(reqDate, {
        start: parseISO(dateFrom),
        end: parseISO(dateTo),
      });

      return matchesDepartment && matchesStatus && matchesSearch && matchesDate;
    });
  }, [
    borrowRequests,
    departmentFilter,
    statusFilter,
    searchQuery,
    dateFrom,
    dateTo,
  ]);

  // Stats — activeBorrows uses issued_items (single source of truth, matches Dashboard)
  const stats = useMemo(
    () => ({
      totalBorrows: filteredBorrows.length,
      activeBorrows: activeBorrowCount,
      returned: filteredBorrows.filter((r) => r.status === "returned").length,
      damaged: returnRequests.filter((r) =>
        ["damaged", "missing_parts", "lost"].includes(r.item_condition),
      ).length,
    }),
    [filteredBorrows, returnRequests, activeBorrowCount],
  );

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    const months: Record<
      string,
      { month: string; borrows: number; returns: number }
    > = {};

    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const key = format(date, "MMM yyyy");
      months[key] = { month: format(date, "MMM"), borrows: 0, returns: 0 };
    }

    borrowRequests.forEach((req) => {
      const key = format(parseISO(req.created_at), "MMM yyyy");
      if (months[key]) months[key].borrows++;
    });

    returnRequests.forEach((req) => {
      const key = format(parseISO(req.return_datetime), "MMM yyyy");
      if (months[key]) months[key].returns++;
    });

    return Object.values(months);
  }, [borrowRequests, returnRequests]);

  // Department usage
  const departmentUsage = useMemo(() => {
    const usage: Record<string, number> = {};

    filteredBorrows.forEach((req) => {
      const deptId = req.item_department_id || "unknown";
      usage[deptId] = (usage[deptId] || 0) + 1;
    });

    return Object.entries(usage)
      .map(([id, count]) => ({
        name: departments.find((d) => d.id === id)?.name || "Unknown",
        value: count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredBorrows, departments]);

  // Top borrowed items
  const topItems = useMemo(() => {
    const itemCounts: Record<string, { name: string; count: number }> = {};

    filteredBorrows.forEach((req) => {
      const name = req.item?.name || "Unknown";
      if (!itemCounts[name]) {
        itemCounts[name] = { name, count: 0 };
      }
      itemCounts[name].count += req.quantity || 1;
    });

    return Object.values(itemCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredBorrows]);

  // Condition breakdown
  const conditionBreakdown = useMemo(() => {
    const conditions: Record<string, number> = {
      good: 0,
      minor_wear: 0,
      damaged: 0,
      missing_parts: 0,
      lost: 0,
    };

    returnRequests.forEach((ret) => {
      if (conditions[ret.item_condition] !== undefined) {
        conditions[ret.item_condition]++;
      }
    });

    return Object.entries(conditions)
      .map(([condition, count]) => ({
        name: condition
          .replace("_", " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        value: count,
      }))
      .filter((c) => c.value > 0);
  }, [returnRequests]);

  const getDepartmentName = (id: string | null) => {
    if (!id) return "—";
    return departments.find((d) => d.id === id)?.name || "—";
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Borrow Analytics" subtitle="Loading...">
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Borrow Analytics"
      subtitle="Comprehensive borrow & return analysis"
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Total Borrows
              </CardDescription>
              <CardTitle className="text-3xl">{stats.totalBorrows}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-info/30">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Active Borrows
              </CardDescription>
              <CardTitle className="text-3xl text-info">
                {stats.activeBorrows}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-success/30">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Returned
              </CardDescription>
              <CardTitle className="text-3xl text-success">
                {stats.returned}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-warning/30">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Damaged/Lost
              </CardDescription>
              <CardTitle className="text-3xl text-warning">
                {stats.damaged}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Item or student..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Department</Label>
                <Select
                  value={departmentFilter}
                  onValueChange={setDepartmentFilter}
                >
                  <SelectTrigger>
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">From Date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">To Date</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Borrow vs Return Trend
              </CardTitle>
              <CardDescription>Last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="borrows"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Borrows"
                    />
                    <Line
                      type="monotone"
                      dataKey="returns"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Returns"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Department Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-primary" />
                Department-wise Usage
              </CardTitle>
              <CardDescription>
                Borrow distribution by department
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {departmentUsage.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={departmentUsage}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {departmentUsage.map((_, index) => (
                          <Cell
                            key={index}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Borrowed Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Frequently Borrowed Items
              </CardTitle>
              <CardDescription>Top 10 most borrowed items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {topItems.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topItems} layout="vertical">
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />
                      <XAxis type="number" className="text-xs" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        className="text-xs"
                        tickFormatter={(value) =>
                          value.length > 12 ? value.slice(0, 12) + "..." : value
                        }
                      />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        fill="#3b82f6"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Condition Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Return Condition Report
              </CardTitle>
              <CardDescription>Condition of returned items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {conditionBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={conditionBreakdown}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {conditionBreakdown.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={
                              entry.name === "Good"
                                ? "#10b981"
                                : entry.name === "Minor Wear"
                                  ? "#f59e0b"
                                  : "#ef4444"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No return data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Complete History Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Complete Borrow History</CardTitle>
                <CardDescription>
                  {filteredBorrows.length} records found
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Borrow Date</TableHead>
                    <TableHead>Return Date</TableHead>
                    <TableHead>Approved By</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBorrows.slice(0, 50).map((req) => {
                    const returnReq = returnRequests.find(
                      (r) => r.borrow_request_id === req.id,
                    );
                    return (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{req.student?.full_name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {getDepartmentName(req.item_department_id)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {req.item?.name || "—"}
                          </span>
                        </TableCell>
                        <TableCell>{req.quantity || 1}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {format(
                              parseISO(req.requested_start_date),
                              "MMM d, yyyy",
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          {returnReq ? (
                            <span className="text-sm">
                              {format(
                                parseISO(returnReq.return_datetime),
                                "MMM d, yyyy",
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {req.approver?.full_name || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <BorrowStatusBadge status={req.status} size="sm" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredBorrows.length > 50 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Showing 50 of {filteredBorrows.length} records
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
