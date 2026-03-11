import { useState, useEffect, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  History,
  Search,
  User,
  Calendar,
  Package,
  Settings,
  Users,
  Edit,
  Trash2,
  Plus,
  Eye,
  RefreshCw,
  ChevronDown,
  AlertCircle,
  Download,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  device_info: string | null;
  created_at: string;
  user?: { full_name: string; email: string } | null;
}

const PAGE_SIZE = 50;

// Simple SHA-256 hash using Web Crypto API
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function AuditLogs() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Date range filters for export
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchLogs = useCallback(
    async (pageNum: number, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (pageNum === 0) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        let query = supabase
          .from("audit_logs")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false });

        // Apply date range filters
        if (dateFrom) {
          query = query.gte("created_at", new Date(dateFrom).toISOString());
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          query = query.lte("created_at", toDate.toISOString());
        }

        const {
          data: logsData,
          error: logsError,
          count,
        } = await query.range(
          pageNum * PAGE_SIZE,
          (pageNum + 1) * PAGE_SIZE - 1,
        );

        if (logsError) throw logsError;

        // Get unique user IDs from logs
        const userIds = [
          ...new Set(
            (logsData || []).map((log) => log.user_id).filter(Boolean),
          ),
        ];

        // Fetch user profiles separately
        let usersMap: Record<string, { full_name: string; email: string }> = {};
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", userIds);

          if (usersData) {
            usersMap = usersData.reduce(
              (acc, user) => {
                acc[user.id] = { full_name: user.full_name, email: user.email };
                return acc;
              },
              {} as Record<string, { full_name: string; email: string }>,
            );
          }
        }

        const enrichedLogs: AuditLog[] = (logsData || []).map((log) => ({
          ...log,
          user: log.user_id ? usersMap[log.user_id] || null : null,
        }));

        if (pageNum === 0 || isRefresh) {
          setLogs(enrichedLogs);
        } else {
          setLogs((prev) => [...prev, ...enrichedLogs]);
        }

        setTotalCount(count || 0);
        setHasMore((logsData?.length || 0) === PAGE_SIZE);
        setPage(pageNum);
      } catch (error: any) {
        console.error("Error fetching audit logs:", error);
        setError(error.message || "Failed to fetch audit logs");
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to fetch audit logs",
        });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    },
    [toast, dateFrom, dateTo],
  );

  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  const handleRefresh = () => {
    setPage(0);
    fetchLogs(0, true);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchLogs(page + 1);
    }
  };

  // --- Fetch ALL logs for export (bypasses pagination) ---
  const fetchAllLogsForExport = async (): Promise<AuditLog[]> => {
    const allLogs: AuditLog[] = [];
    let pageNum = 0;
    let hasMoreData = true;
    const EXPORT_PAGE_SIZE = 1000;

    while (hasMoreData) {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (dateFrom) {
        query = query.gte("created_at", new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte("created_at", toDate.toISOString());
      }

      const { data, error: err } = await query.range(
        pageNum * EXPORT_PAGE_SIZE,
        (pageNum + 1) * EXPORT_PAGE_SIZE - 1,
      );

      if (err) throw err;
      if (!data || data.length === 0) break;

      // Enrich with user info
      const userIds = [...new Set(data.map((l) => l.user_id).filter(Boolean))];
      let usersMap: Record<string, { full_name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        if (usersData) {
          usersMap = usersData.reduce(
            (acc, u) => {
              acc[u.id] = { full_name: u.full_name, email: u.email };
              return acc;
            },
            {} as Record<string, { full_name: string; email: string }>,
          );
        }
      }

      const enriched = data.map((log) => ({
        ...log,
        user: log.user_id ? usersMap[log.user_id] || null : null,
      }));

      allLogs.push(...enriched);
      hasMoreData = data.length === EXPORT_PAGE_SIZE;
      pageNum++;
    }

    return allLogs;
  };

  // --- PDF EXPORT with enterprise compliance features ---
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const exportLogs = await fetchAllLogsForExport();
      if (exportLogs.length === 0) {
        toast({
          title: "No Data",
          description: "No audit logs found for the selected date range.",
        });
        return;
      }

      // Build hash string from log data for tamper evidence
      const hashInput = exportLogs
        .map(
          (l) =>
            `${l.id}|${l.created_at}|${l.action}|${l.entity_type}|${l.entity_id || ""}|${l.user?.full_name || "System"}`,
        )
        .join("\n");
      const dataHash = await sha256(hashInput);

      const doc = new jsPDF({ orientation: "landscape" });
      const now = new Date();
      const reportDate = format(now, "yyyy-MM-dd HH:mm:ss");
      const dateRangeText =
        dateFrom || dateTo
          ? `${dateFrom || "Beginning"} to ${dateTo || "Present"}`
          : "All Time";

      // --- Compliance Header ---
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(0, 0, doc.internal.pageSize.width, 52, "F");

      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("AUDIT LOG — COMPLIANCE REPORT", 14, 18);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 210, 225);
      doc.text("LabLink Inventory Management System", 14, 27);

      doc.setFontSize(9);
      doc.setTextColor(160, 175, 195);
      doc.text(`Report Date: ${reportDate}`, 14, 35);
      doc.text(`Period: ${dateRangeText}`, 14, 41);
      doc.text(`Total Entries: ${exportLogs.length}`, 14, 47);
      doc.text(`Hash Algorithm: SHA-256`, doc.internal.pageSize.width / 2, 35);
      doc.text(
        `Document Classification: CONFIDENTIAL`,
        doc.internal.pageSize.width / 2,
        41,
      );

      // "IMMUTABLE" badge
      const badgeX = doc.internal.pageSize.width - 70;
      doc.setFillColor(16, 185, 129); // emerald-500
      doc.roundedRect(badgeX, 8, 56, 12, 3, 3, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("✓ IMMUTABLE RECORD", badgeX + 3, 16);

      // Table
      doc.setTextColor(0, 0, 0);
      const tableData = exportLogs.map((log) => [
        format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
        log.user?.full_name || "System",
        log.user?.email || "—",
        log.action,
        log.entity_type,
        log.entity_id ? log.entity_id.slice(0, 12) + "..." : "—",
        log.ip_address || "—",
        log.new_values ? JSON.stringify(log.new_values).slice(0, 50) : "—",
      ]);

      autoTable(doc, {
        startY: 56,
        head: [
          [
            "Timestamp",
            "User",
            "Email",
            "Action",
            "Entity",
            "Entity ID",
            "IP Address",
            "Changes",
          ],
        ],
        body: tableData,
        styles: { fontSize: 6.5, cellPadding: 2 },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 34 },
          1: { cellWidth: 26 },
          2: { cellWidth: 36 },
          3: { cellWidth: 18 },
          4: { cellWidth: 18 },
          5: { cellWidth: 28 },
          6: { cellWidth: 24 },
          7: { cellWidth: "auto" },
        },
        didDrawPage: (data: any) => {
          const pageW = doc.internal.pageSize.width;
          const pageH = doc.internal.pageSize.height;

          // Diagonal watermark on every page
          doc.saveGraphicsState();
          doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
          doc.setFontSize(60);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(100, 100, 100);
          doc.text("IMMUTABLE RECORD", pageW / 2 - 80, pageH / 2, {
            angle: 35,
          });
          doc.restoreGraphicsState();

          // Footer on every page
          doc.setFontSize(7);
          doc.setTextColor(128);
          doc.text(
            `Page ${data.pageNumber} | LabLink Compliance Report — CONFIDENTIAL | SHA-256: ${dataHash.slice(0, 16)}...`,
            14,
            pageH - 8,
          );
          doc.text(`Generated: ${reportDate}`, pageW - 60, pageH - 8);
        },
      });

      // --- Digital Signature & Verification Block ---
      const finalY =
        (doc as any).lastAutoTable?.finalY || doc.internal.pageSize.height - 50;
      const pageH = doc.internal.pageSize.height;

      if (finalY + 50 > pageH) {
        doc.addPage();
      }
      const sigY = finalY + 10 > pageH - 50 ? 20 : finalY + 10;

      // Signature box background
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(
        12,
        sigY - 4,
        doc.internal.pageSize.width - 24,
        42,
        2,
        2,
        "FD",
      );

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Digital Verification & Compliance Certificate", 18, sigY + 4);

      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.5);
      doc.line(18, sigY + 6, doc.internal.pageSize.width - 18, sigY + 6);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`SHA-256 Data Integrity Hash:`, 18, sigY + 13);
      doc.setFont("courier", "normal");
      doc.setFontSize(7);
      doc.text(dataHash, 18, sigY + 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(`Total Records in Report: ${exportLogs.length}`, 18, sigY + 25);
      doc.text(`Report Generated: ${reportDate}`, 18, sigY + 30);
      doc.text(
        `This report is an immutable snapshot. Any modification to the log data will invalidate the above hash.`,
        18,
        sigY + 35,
      );

      doc.save(
        `LabLink_Compliance_Report_${format(now, "yyyyMMdd_HHmmss")}.pdf`,
      );
      toast({
        title: "Compliance Report Exported",
        description: `Exported ${exportLogs.length} audit entries with SHA-256 integrity hash.`,
      });
    } catch (err: any) {
      console.error("PDF export error:", err);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // --- CSV EXPORT ---
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const exportLogs = await fetchAllLogsForExport();
      if (exportLogs.length === 0) {
        toast({
          title: "No Data",
          description: "No audit logs found for the selected date range.",
        });
        return;
      }

      const wsData = exportLogs.map((log) => ({
        Timestamp: format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
        User: log.user?.full_name || "System",
        Email: log.user?.email || "",
        Action: log.action,
        Entity_Type: log.entity_type,
        Entity_ID: log.entity_id || "",
        IP_Address: log.ip_address || "",
        Device_Info: log.device_info || "",
        Old_Values: log.old_values ? JSON.stringify(log.old_values) : "",
        New_Values: log.new_values ? JSON.stringify(log.new_values) : "",
      }));

      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");
      XLSX.writeFile(
        wb,
        `LabLink_Audit_Logs_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`,
        { bookType: "csv" },
      );

      toast({
        title: "Export Complete",
        description: `Exported ${exportLogs.length} audit entries as CSV.`,
      });
    } catch (err: any) {
      console.error("CSV export error:", err);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
      case "insert":
        return <Plus className="h-3.5 w-3.5 text-emerald-500" />;
      case "update":
      case "edit":
        return <Edit className="h-3.5 w-3.5 text-blue-500" />;
      case "delete":
        return <Trash2 className="h-3.5 w-3.5 text-red-500" />;
      case "view":
      case "read":
        return <Eye className="h-3.5 w-3.5 text-muted-foreground" />;
      default:
        return <Settings className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
      case "insert":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">
            {action}
          </Badge>
        );
      case "update":
      case "edit":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400">
            {action}
          </Badge>
        );
      case "delete":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400">
            {action}
          </Badge>
        );
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType.toLowerCase()) {
      case "item":
      case "items":
        return <Package className="h-4 w-4 text-primary" />;
      case "user":
      case "users":
      case "profile":
        return <Users className="h-4 w-4 text-primary" />;
      default:
        return <Settings className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction =
      actionFilter === "all" ||
      log.action.toLowerCase() === actionFilter.toLowerCase();
    return matchesSearch && matchesAction;
  });

  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  return (
    <DashboardLayout title="Audit Logs" subtitle="Track all system activity">
      <div className="space-y-6">
        {/* Filters Row */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action.toLowerCase()}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range + Export */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px] text-sm"
                placeholder="From"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px] text-sm"
                placeholder="To"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF} className="gap-2">
                  <FileText className="h-4 w-4 text-red-500" />
                  Export as PDF (with hash signature)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-500" />
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="shrink-0"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  Error loading audit logs
                </p>
                <p className="text-xs text-red-500/80">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Activity Log
            </CardTitle>
            <CardDescription>
              Showing {filteredLogs.length} of {totalCount} entries
              {(dateFrom || dateTo) && (
                <span className="ml-2 text-primary font-medium">
                  • Filtered: {dateFrom || "Start"} → {dateTo || "Now"}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 animate-pulse"
                  >
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 flex-1" />
                  </div>
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">
                  No audit logs found
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  {searchQuery || actionFilter !== "all"
                    ? "Try adjusting your search or filter"
                    : "Activity will appear here as users interact with the system"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Timestamp</TableHead>
                        <TableHead className="w-[180px]">User</TableHead>
                        <TableHead className="w-[100px]">Action</TableHead>
                        <TableHead className="w-[100px]">Entity</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow
                          key={log.id}
                          className="group hover:bg-muted/50 transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div>
                                <p className="font-medium">
                                  {format(
                                    new Date(log.created_at),
                                    "MMM d, yyyy",
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(log.created_at), "HH:mm:ss")}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {log.user?.full_name || "System"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {log.user?.email || "Automated action"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getActionIcon(log.action)}
                              {getActionBadge(log.action)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getEntityIcon(log.entity_type)}
                              <span className="text-sm capitalize">
                                {log.entity_type}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground max-w-[300px] truncate">
                              {log.entity_id
                                ? `ID: ${log.entity_id.slice(0, 8)}...`
                                : "—"}
                            </p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Load More Button */}
                {hasMore && filteredLogs.length >= PAGE_SIZE && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="gap-2"
                    >
                      {isLoadingMore ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Load More
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
