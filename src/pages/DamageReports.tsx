import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { generateDamageMaintenancePDF, generateDamageMaintenanceExcel, DamageReportRow } from "@/lib/reportExports";
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
  AlertTriangle, 
  Search, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Wrench,
  Eye,
  User,
  Package,
  Calendar,
  Loader2,
  FileWarning,
  ArrowRight,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface DamageReport {
  id: string;
  item_id: string;
  reported_by: string;
  damage_type: string | null;
  severity: string;
  description: string;
  status: string;
  resolved_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  item?: { name: string; item_code: string };
  reporter?: { full_name: string; email: string };
  reviewer?: { full_name: string };
}

const severityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  minor: {
    label: "Minor",
    color: "text-yellow-600",
    bgColor: "bg-yellow-500/10 border-yellow-500/30",
  },
  moderate: {
    label: "Moderate",
    color: "text-orange-600",
    bgColor: "bg-orange-500/10 border-orange-500/30",
  },
  severe: {
    label: "Severe",
    color: "text-red-600",
    bgColor: "bg-red-500/10 border-red-500/30",
  },
};

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-warning text-warning-foreground" },
  reviewing: { label: "Reviewing", icon: Eye, color: "bg-info text-info-foreground" },
  resolved: { label: "Resolved", icon: CheckCircle, color: "bg-success text-success-foreground" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-destructive text-destructive-foreground" },
  maintenance_scheduled: { label: "Maintenance", icon: Wrench, color: "bg-purple-500 text-white" },
};

export default function DamageReports() {
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"resolve" | "reject" | "maintenance">("resolve");
  const [actionNotes, setActionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("damage_reports")
        .select(`
          *,
          item:items(name, item_code),
          reporter:profiles!damage_reports_reported_by_fkey(full_name, email),
          reviewer:profiles!damage_reports_reviewed_by_fkey(full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports((data as DamageReport[]) || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch damage reports",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedReport || !user) return;

    setIsSubmitting(true);
    try {
      let newStatus = "";
      switch (actionType) {
        case "resolve":
          newStatus = "resolved";
          break;
        case "reject":
          newStatus = "rejected";
          break;
        case "maintenance":
          newStatus = "maintenance_scheduled";
          break;
      }

      // Update damage report status
      const { error: updateError } = await supabase
        .from("damage_reports")
        .update({
          status: newStatus as any,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          resolved_notes: actionNotes.trim() || null,
        } as any)
        .eq("id", selectedReport.id);

      if (updateError) throw updateError;

      // If maintenance is scheduled, create a maintenance record
      if (actionType === "maintenance") {
        const { error: maintenanceError } = await supabase
          .from("maintenance_records")
          .insert({
            item_id: selectedReport.item_id,
            reason: `Damage Report: ${selectedReport.damage_type || "Unknown"} - ${selectedReport.description}`,
            status: "pending",
            damage_report_id: selectedReport.id,
          });

        if (maintenanceError) {
          console.error("Failed to create maintenance record:", maintenanceError);
        }
      }

      toast({
        title: "Success",
        description: `Report ${newStatus.replace("_", " ")} successfully`,
      });

      setActionDialogOpen(false);
      setActionNotes("");
      setSelectedReport(null);
      fetchReports();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update report",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openActionDialog = (report: DamageReport, type: "resolve" | "reject" | "maintenance") => {
    setSelectedReport(report);
    setActionType(type);
    setActionNotes("");
    setActionDialogOpen(true);
  };

  const openDetailDialog = (report: DamageReport) => {
    setSelectedReport(report);
    setDetailDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, icon: Clock, color: "bg-muted" };
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const config = severityConfig[severity] || { label: severity, color: "text-muted-foreground", bgColor: "bg-muted" };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${config.bgColor} ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.item?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.reporter?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = activeTab === "all" || report.status === activeTab;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = reports.filter((r) => r.status === "pending").length;
  const reviewingCount = reports.filter((r) => r.status === "reviewing").length;
  const resolvedCount = reports.filter((r) => r.status === "resolved").length;
  const maintenanceCount = reports.filter((r) => r.status === "maintenance_scheduled").length;

  const handleExport = async (exportType: 'pdf' | 'excel') => {
    if (filteredReports.length === 0) {
      toast({
        variant: "destructive",
        title: "No data to export",
        description: "There are no damage reports matching your filters to export.",
      });
      return;
    }

    setIsExporting(true);
    try {
      const exportData: DamageReportRow[] = filteredReports.map(report => ({
        id: report.id,
        itemName: report.item?.name || 'Unknown',
        itemCode: report.item?.item_code || '',
        damageType: report.damage_type || '',
        severity: report.severity,
        description: report.description,
        status: report.status,
        reportedBy: report.reporter?.full_name || '',
        reportedDate: report.created_at,
        reviewedBy: report.reviewer?.full_name || '',
        reviewedDate: report.reviewed_at || '',
        resolutionNotes: report.resolved_notes || '',
        maintenanceStatus: report.status === 'maintenance_scheduled' ? 'Scheduled' : '',
        maintenanceCost: 0,
      }));

      const filters = {
        status: activeTab !== 'all' ? activeTab : undefined,
      };

      if (exportType === 'pdf') {
        generateDamageMaintenancePDF(exportData, [], filters, 'Damage Reports');
      } else {
        generateDamageMaintenanceExcel(exportData, [], filters);
      }

      toast({
        title: "Success",
        description: `Damage reports exported as ${exportType.toUpperCase()} successfully.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Failed to export damage reports. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout title="Damage Reports" subtitle="Review and manage reported issues">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Reports</CardDescription>
              <CardTitle className="text-2xl">{reports.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl text-warning">{pendingCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Reviewing</CardDescription>
              <CardTitle className="text-2xl text-info">{reviewingCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-2xl text-success">{resolvedCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Maintenance</CardDescription>
              <CardTitle className="text-2xl text-purple-500">{maintenanceCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by item, description, or reporter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Export Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting || filteredReports.length === 0}>
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="h-4 w-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
            <TabsTrigger value="reviewing">Reviewing ({reviewingCount})</TabsTrigger>
            <TabsTrigger value="maintenance_scheduled">Maintenance</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-primary" />
                  Damage Reports
                </CardTitle>
                <CardDescription>
                  {filteredReports.length} report{filteredReports.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="text-center py-12">
                    <FileWarning className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">No damage reports found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Issue Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Reported By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">{report.item?.name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {report.item?.item_code}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="max-w-[150px] truncate">
                              {report.damage_type || "Not specified"}
                            </p>
                          </TableCell>
                          <TableCell>{getSeverityBadge(report.severity)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{report.reporter?.full_name || "Unknown"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(report.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDetailDialog(report)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {(report.status === "pending" || report.status === "reviewing") && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-success border-success hover:bg-success/10"
                                    onClick={() => openActionDialog(report, "resolve")}
                                  >
                                    Resolve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-purple-600 border-purple-600 hover:bg-purple-600/10"
                                    onClick={() => openActionDialog(report, "maintenance")}
                                  >
                                    <Wrench className="h-4 w-4 mr-1" />
                                    Maint.
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Damage Report Details
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.item?.name} - {selectedReport?.item?.item_code}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                {getStatusBadge(selectedReport.status)}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Severity:</span>
                {getSeverityBadge(selectedReport.severity)}
              </div>

              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Issue Type:</span>
                <p className="font-medium">{selectedReport.damage_type || "Not specified"}</p>
              </div>

              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Description:</span>
                <p className="text-sm bg-muted p-3 rounded-lg">{selectedReport.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Reported By:</span>
                  <p className="font-medium text-sm">{selectedReport.reporter?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedReport.reporter?.email}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Reported On:</span>
                  <p className="font-medium text-sm">
                    {format(new Date(selectedReport.created_at), "PPP")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(selectedReport.created_at), "p")}
                  </p>
                </div>
              </div>

              {selectedReport.resolved_notes && (
                <div className="space-y-1 p-3 bg-success/10 border border-success/30 rounded-lg">
                  <span className="text-sm font-medium text-success">Resolution Notes:</span>
                  <p className="text-sm">{selectedReport.resolved_notes}</p>
                  {selectedReport.reviewer && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Reviewed by {selectedReport.reviewer.full_name} on{" "}
                      {selectedReport.reviewed_at &&
                        format(new Date(selectedReport.reviewed_at), "PPP")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
            {selectedReport &&
              (selectedReport.status === "pending" || selectedReport.status === "reviewing") && (
                <>
                  <Button
                    variant="outline"
                    className="text-purple-600 border-purple-600 hover:bg-purple-600/10"
                    onClick={() => {
                      setDetailDialogOpen(false);
                      openActionDialog(selectedReport, "maintenance");
                    }}
                  >
                    <Wrench className="h-4 w-4 mr-2" />
                    Schedule Maintenance
                  </Button>
                  <Button
                    className="bg-success hover:bg-success/90"
                    onClick={() => {
                      setDetailDialogOpen(false);
                      openActionDialog(selectedReport, "resolve");
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Resolve
                  </Button>
                </>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === "resolve" && <CheckCircle className="h-5 w-5 text-success" />}
              {actionType === "reject" && <XCircle className="h-5 w-5 text-destructive" />}
              {actionType === "maintenance" && <Wrench className="h-5 w-5 text-purple-600" />}
              {actionType === "resolve" && "Resolve Report"}
              {actionType === "reject" && "Reject Report"}
              {actionType === "maintenance" && "Schedule Maintenance"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "maintenance"
                ? "This will create a maintenance record for the item."
                : `Provide notes for ${actionType === "resolve" ? "resolving" : "rejecting"} this report.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{selectedReport?.item?.name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedReport?.damage_type} - {selectedReport?.severity} severity
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">
                {actionType === "maintenance" ? "Maintenance Notes" : "Resolution Notes"}
              </Label>
              <Textarea
                id="notes"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  actionType === "maintenance"
                    ? "Add any notes about the required maintenance..."
                    : "Describe how the issue was resolved or why it was rejected..."
                }
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={isSubmitting}
              className={
                actionType === "resolve"
                  ? "bg-success hover:bg-success/90"
                  : actionType === "maintenance"
                  ? "bg-purple-600 hover:bg-purple-600/90"
                  : ""
              }
              variant={actionType === "reject" ? "destructive" : "default"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {actionType === "resolve" && "Resolve"}
                  {actionType === "reject" && "Reject"}
                  {actionType === "maintenance" && (
                    <>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Create Maintenance
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
