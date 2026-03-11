import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { generateBorrowHistoryPDF, generateBorrowHistoryExcel, BorrowReportRow } from "@/lib/reportExports";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ApprovalMessageDialog } from "@/components/borrow/ApprovalMessageDialog";
import { RejectionDialog } from "@/components/borrow/RejectionDialog";
import { ReturnVerificationDialog } from "@/components/borrow/ReturnVerificationDialog";
import { BorrowStatusBadge } from "@/components/borrow/BorrowStatusBadge";
import { 
  ClipboardList, 
  Search, 
  Check, 
  X, 
  Calendar, 
  User, 
  Package, 
  RotateCcw,
  Filter,
  Eye,
  Building2,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Loader2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

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
  updated_at: string | null;
  item?: { name: string; item_code: string; department_id: string };
  student?: { full_name: string; email: string };
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
  notes: string | null;
  status: string;
  borrow_request?: BorrowRequest;
  item?: { name: string };
  student?: { full_name: string };
}

interface Department {
  id: string;
  name: string;
}

export default function Requests() {
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userDepartments, setUserDepartments] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  
  // Dialog states
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [returnVerificationOpen, setReturnVerificationOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BorrowRequest | null>(null);
  const [selectedReturnRequest, setSelectedReturnRequest] = useState<ReturnRequest | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const isAdmin = userRole === "admin";

  useEffect(() => {
    fetchDepartments();
    fetchUserDepartments();
  }, [user]);

  useEffect(() => {
    fetchRequests();
    fetchReturnRequests();
  }, [userDepartments, isAdmin]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchUserDepartments = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("user_departments")
        .select("department_id")
        .eq("user_id", user.id);

      if (error) throw error;
      setUserDepartments((data || []).map(d => d.department_id));
    } catch (error) {
      console.error("Failed to fetch user departments:", error);
    }
  };

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("borrow_requests")
        .select(`
          *,
          item:items(name, item_code, department_id),
          student:profiles!borrow_requests_student_id_fkey(full_name, email)
        `)
        .order("created_at", { ascending: false });

      // Staff can only see requests from their departments (unless admin)
      if (!isAdmin && userDepartments.length > 0) {
        query = query.in("item_department_id", userDepartments);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRequests((data || []) as unknown as BorrowRequest[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch requests",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReturnRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("return_requests")
        .select(`
          *,
          item:items(name),
          student:profiles!return_requests_student_id_fkey(full_name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReturnRequests((data || []) as unknown as ReturnRequest[]);
    } catch (error) {
      console.error("Failed to fetch return requests:", error);
    }
  };

  const openApprovalDialog = (request: BorrowRequest) => {
    setSelectedRequest(request);
    setApprovalDialogOpen(true);
  };

  const openRejectionDialog = (request: BorrowRequest) => {
    setSelectedRequest(request);
    setRejectionDialogOpen(true);
  };

  const openReturnVerification = (returnReq: ReturnRequest) => {
    setSelectedReturnRequest(returnReq);
    setReturnVerificationOpen(true);
  };

  const handleDialogSuccess = () => {
    fetchRequests();
    fetchReturnRequests();
  };

  const handleExport = async (exportType: 'pdf' | 'excel') => {
    if (filteredRequests.length === 0) {
      toast({
        variant: "destructive",
        title: "No data to export",
        description: "There are no requests matching your filters to export.",
      });
      return;
    }

    setIsExporting(true);
    try {
      const exportData: BorrowReportRow[] = filteredRequests.map(req => ({
        id: req.id,
        itemName: req.item?.name || 'Unknown',
        itemCode: req.item?.item_code || '',
        category: '',
        department: getDepartmentName(req.item_department_id),
        borrowerName: req.student?.full_name || '',
        borrowerEmail: req.student?.email || '',
        quantity: req.quantity || 1,
        purpose: req.purpose || '',
        requestDate: req.created_at,
        startDate: req.requested_start_date,
        endDate: req.requested_end_date,
        status: req.status,
        approvedBy: '',
        approvalDate: req.approved_date || '',
        pickupLocation: req.pickup_location || '',
        returnDate: '',
        receivedBy: '',
        itemCondition: '',
        conditionNotes: '',
      }));

      const filters = {
        departmentId: departmentFilter !== 'all' ? departmentFilter : undefined,
        status: activeTab !== 'all' ? activeTab : undefined,
      };

      if (exportType === 'pdf') {
        generateBorrowHistoryPDF(exportData, filters, 'Borrow Requests Report');
      } else {
        generateBorrowHistoryExcel(exportData, filters);
      }

      toast({
        title: "Success",
        description: `Requests exported as ${exportType.toUpperCase()} successfully.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Failed to export requests. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Filter requests based on search and department
  const filteredRequests = requests.filter((req) => {
    const matchesSearch = 
      req.item?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.student?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = activeTab === "all" || 
      activeTab === "returns" ||
      req.status === activeTab ||
      (activeTab === "active" && ["approved", "return_pending"].includes(req.status));
    
    const matchesDepartment = departmentFilter === "all" || 
      req.item_department_id === departmentFilter;
    
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  // Counts
  const pendingCount = requests.filter(r => r.status === "pending").length;
  const activeCount = requests.filter(r => ["approved", "return_pending"].includes(r.status)).length;
  const returnsPendingCount = returnRequests.length;
  const returnedCount = requests.filter(r => r.status === "returned").length;
  const rejectedCount = requests.filter(r => r.status === "rejected").length;

  const getDepartmentName = (deptId: string | null) => {
    if (!deptId) return "—";
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || "—";
  };

  const renderActionButtons = (req: BorrowRequest) => {
    switch (req.status) {
      case "pending":
        return (
          <div className="flex justify-end gap-1 sm:gap-2">
            <Button 
              size="sm" 
              variant="outline"
              className="text-success border-success hover:bg-success/10 h-8 px-2 sm:px-3"
              onClick={() => openApprovalDialog(req)}
            >
              <Check className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Approve</span>
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="text-destructive border-destructive hover:bg-destructive/10 h-8 px-2 sm:px-3"
              onClick={() => openRejectionDialog(req)}
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Reject</span>
            </Button>
          </div>
        );
      case "approved":
      case "return_pending":
        return (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            {req.pickup_location && (
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                <span className="hidden sm:inline">{req.pickup_location}</span>
              </span>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout title="Borrow Requests" subtitle="Manage item borrowing requests">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-4">
          <Card className="col-span-1">
            <CardHeader className="p-3 sm:pb-2 sm:pt-4">
              <CardDescription className="text-xs sm:text-sm">Total</CardDescription>
              <CardTitle className="text-xl sm:text-2xl">{requests.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-warning/30 col-span-1">
            <CardHeader className="p-3 sm:pb-2 sm:pt-4">
              <CardDescription className="text-xs sm:text-sm">Pending</CardDescription>
              <CardTitle className="text-xl sm:text-2xl text-warning">{pendingCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-success/30 col-span-1">
            <CardHeader className="p-3 sm:pb-2 sm:pt-4">
              <CardDescription className="text-xs sm:text-sm">Active</CardDescription>
              <CardTitle className="text-xl sm:text-2xl text-success">{activeCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-info/30 hidden sm:block">
            <CardHeader className="p-3 sm:pb-2 sm:pt-4">
              <CardDescription className="text-xs sm:text-sm">Returns</CardDescription>
              <CardTitle className="text-xl sm:text-2xl text-info">{returnsPendingCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="hidden md:block">
            <CardHeader className="p-3 sm:pb-2 sm:pt-4">
              <CardDescription className="text-xs sm:text-sm">Returned</CardDescription>
              <CardTitle className="text-xl sm:text-2xl">{returnedCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-destructive/30 hidden md:block">
            <CardHeader className="p-3 sm:pb-2 sm:pt-4">
              <CardDescription className="text-xs sm:text-sm">Rejected</CardDescription>
              <CardTitle className="text-xl sm:text-2xl text-destructive">{rejectedCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              {/* Department Filter */}
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <Building2 className="h-4 w-4 mr-2 hidden sm:block" />
                  <SelectValue placeholder="Dept" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Export Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isExporting || filteredRequests.length === 0} className="h-10">
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline ml-2">Export</span>
                    <ChevronDown className="h-4 w-4 ml-1" />
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
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="pending" className="text-xs sm:text-sm px-2 sm:px-3">
              Pending ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs sm:text-sm px-2 sm:px-3">
              Active ({activeCount})
            </TabsTrigger>
            <TabsTrigger value="returns" className="text-info text-xs sm:text-sm px-2 sm:px-3">
              Returns ({returnsPendingCount})
            </TabsTrigger>
            <TabsTrigger value="returned" className="hidden sm:flex text-xs sm:text-sm px-2 sm:px-3">Returned</TabsTrigger>
            <TabsTrigger value="rejected" className="hidden sm:flex text-xs sm:text-sm px-2 sm:px-3">Rejected</TabsTrigger>
            <TabsTrigger value="all" className="text-xs sm:text-sm px-2 sm:px-3">All</TabsTrigger>
          </TabsList>

          {/* Returns Tab Content */}
          {activeTab === "returns" ? (
            <div className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5 text-info" />
                    Pending Return Verifications
                  </CardTitle>
                  <CardDescription>
                    Review and verify item returns from students
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {returnRequests.length === 0 ? (
                    <div className="text-center py-12">
                      <RotateCcw className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No pending returns</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="hidden sm:table-cell">Student</TableHead>
                          <TableHead className="hidden md:table-cell">Qty</TableHead>
                          <TableHead className="hidden lg:table-cell">Condition</TableHead>
                          <TableHead className="hidden sm:table-cell">Submitted</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnRequests.map((ret) => (
                          <TableRow key={ret.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{ret.item?.name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground sm:hidden">{ret.student?.full_name}</p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{ret.student?.full_name || "Unknown"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{ret.quantity}</TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <BorrowStatusBadge status={ret.item_condition} size="sm" />
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(ret.return_datetime), { addSuffix: true })}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openReturnVerification(ret)}
                                className="h-8"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="hidden sm:inline ml-1">Review</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <TabsContent value={activeTab} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    {activeTab === "all" ? "All Requests" : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Requests`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : filteredRequests.length === 0 ? (
                    <div className="text-center py-12">
                      <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No requests found</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="hidden sm:table-cell">Student</TableHead>
                          <TableHead className="hidden lg:table-cell">Duration</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden md:table-cell">Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRequests.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{req.item?.name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground font-mono">{req.item?.item_code}</p>
                                <p className="text-xs text-muted-foreground sm:hidden">{req.student?.full_name}</p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm">{req.student?.full_name || "Unknown"}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                {format(new Date(req.requested_start_date), "MMM d")} - {format(new Date(req.requested_end_date), "MMM d")}
                              </div>
                            </TableCell>
                            <TableCell>
                              <BorrowStatusBadge status={req.status} />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                              </p>
                            </TableCell>
                            <TableCell className="text-right">
                              {renderActionButtons(req)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Approval Dialog */}
      {selectedRequest && (
        <ApprovalMessageDialog
          isOpen={approvalDialogOpen}
          onClose={() => {
            setApprovalDialogOpen(false);
            setSelectedRequest(null);
          }}
          requestId={selectedRequest.id}
          itemName={selectedRequest.item?.name || "Unknown Item"}
          studentName={selectedRequest.student?.full_name || "Unknown Student"}
          studentId={selectedRequest.student_id}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Rejection Dialog */}
      {selectedRequest && (
        <RejectionDialog
          isOpen={rejectionDialogOpen}
          onClose={() => {
            setRejectionDialogOpen(false);
            setSelectedRequest(null);
          }}
          requestId={selectedRequest.id}
          itemName={selectedRequest.item?.name || "Unknown Item"}
          studentName={selectedRequest.student?.full_name || "Unknown Student"}
          studentId={selectedRequest.student_id}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Return Verification Dialog */}
      {selectedReturnRequest && (
        <ReturnVerificationDialog
          isOpen={returnVerificationOpen}
          onClose={() => {
            setReturnVerificationOpen(false);
            setSelectedReturnRequest(null);
          }}
          returnRequest={selectedReturnRequest}
          itemName={selectedReturnRequest.item?.name || "Unknown Item"}
          studentName={selectedReturnRequest.student?.full_name || "Unknown Student"}
          onSuccess={handleDialogSuccess}
        />
      )}
    </DashboardLayout>
  );
}
