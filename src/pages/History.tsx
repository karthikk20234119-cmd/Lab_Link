import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateStudentHistoryPDF, generateStudentHistoryExcel, BorrowReportRow } from "@/lib/reportExports";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History as HistoryIcon, Clock, Check, X, RotateCcw, Package, Calendar, ArrowRight, Download, FileText, FileSpreadsheet, ChevronDown, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BorrowHistory {
  id: string;
  item_id: string;
  student_id: string;
  requested_start_date: string;
  requested_end_date: string;
  purpose: string | null;
  status: string;
  approved_date: string | null;
  created_at: string;
  item?: { name: string; item_code: string; image_url: string | null };
}

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [history, setHistory] = useState<BorrowHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("borrow_requests")
        .select(`
          *,
          item:items(name, item_code, image_url)
        `)
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHistory((data || []) as unknown as BorrowHistory[]);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case "approved":
        return <Badge className="bg-success/80 text-success-foreground"><Check className="h-3 w-3 mr-1" /> Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" /> Rejected</Badge>;
      case "returned":
        return <Badge variant="outline" className="border-success text-success"><RotateCcw className="h-3 w-3 mr-1" /> Returned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5 text-warning" />;
      case "approved":
        return <Check className="h-5 w-5 text-success" />;
      case "rejected":
        return <X className="h-5 w-5 text-destructive" />;
      case "returned":
        return <RotateCcw className="h-5 w-5 text-info" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const filteredHistory = history.filter((item) => {
    if (activeTab === "all") return true;
    return item.status === activeTab;
  });

  const stats = {
    total: history.length,
    pending: history.filter((h) => h.status === "pending").length,
    approved: history.filter((h) => h.status === "approved").length,
    returned: history.filter((h) => h.status === "returned").length,
  };

  const handleExport = async (exportType: 'pdf' | 'excel') => {
    if (filteredHistory.length === 0) {
      toast({
        variant: "destructive",
        title: "No data to export",
        description: "There are no records matching your filters to export.",
      });
      return;
    }

    setIsExporting(true);
    try {
      const exportData: BorrowReportRow[] = filteredHistory.map(record => ({
        id: record.id,
        itemName: record.item?.name || 'Unknown',
        itemCode: record.item?.item_code || '',
        category: '',
        department: '',
        borrowerName: '',
        borrowerEmail: '',
        quantity: 1,
        purpose: record.purpose || '',
        requestDate: record.created_at,
        startDate: record.requested_start_date,
        endDate: record.requested_end_date,
        status: record.status,
        approvedBy: '',
        approvalDate: record.approved_date || '',
        pickupLocation: '',
        returnDate: '',
        receivedBy: '',
        itemCondition: '',
        conditionNotes: '',
      }));

      if (exportType === 'pdf') {
        generateStudentHistoryPDF(exportData, 'My History');
      } else {
        generateStudentHistoryExcel(exportData, 'My History');
      }

      toast({
        title: "Success",
        description: `History exported as ${exportType.toUpperCase()} successfully.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Failed to export history. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout title="History" subtitle="View your borrowing history">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Requests</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl text-warning">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-2xl text-success">{stats.approved}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-2xl text-info">{stats.returned}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Export Button */}
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting || filteredHistory.length === 0}>
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export History
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Active</TabsTrigger>
            <TabsTrigger value="returned">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HistoryIcon className="h-5 w-5 text-primary" />
                  Borrowing History
                </CardTitle>
                <CardDescription>
                  {filteredHistory.length} records
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <HistoryIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">No borrowing history yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your borrowing requests will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredHistory.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/items/${record.item_id}`)}
                      >
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {record.item?.image_url ? (
                            <img
                              src={record.item.image_url}
                              alt={record.item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-6 w-6 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{record.item?.name || "Unknown Item"}</h3>
                            {getStatusBadge(record.status)}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{record.item?.item_code}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(record.requested_start_date), "MMM d")}
                              <ArrowRight className="h-3 w-3" />
                              {format(new Date(record.requested_end_date), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
