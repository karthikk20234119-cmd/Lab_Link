import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Loader2,
  FileText,
  CheckCircle,
  XCircle,
  Send,
  Trash2,
  ShoppingCart,
  IndianRupee,
  ArrowRight,
  Clock,
  Wallet,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import {
  createPurchaseVoucher,
  getTallyConfig,
  checkBudgetBalance,
  type TallyConfig,
  type BudgetCheckResult,
} from "@/services/tallyService";
import {
  buildEInvoiceJson,
  type EInvoiceData,
  type EInvoiceItem,
} from "@/services/tallyXmlBuilder";

interface POItem {
  id?: string;
  item_name: string;
  item_id?: string;
  chemical_id?: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  gst_rate: number;
  hsn_code: string;
  batch_number: string;
  expiry_date: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  department_id: string | null;
  status: string;
  order_date: string;
  expected_delivery_date: string | null;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_gst: number;
  grand_total: number;
  notes: string | null;
  tally_sync_status: string;
  tally_voucher_number: string | null;
  created_at: string;
  vendor?: any;
  department?: any;
}

export default function PurchaseOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tallyConfig, setTallyConfig] = useState<TallyConfig | null>(null);
  const [pushingToTally, setPushingToTally] = useState<string | null>(null);

  // Budget check state
  const [budgetLedger, setBudgetLedger] = useState("");
  const [budgetResult, setBudgetResult] = useState<BudgetCheckResult | null>(
    null,
  );
  const [checkingBudget, setCheckingBudget] = useState(false);

  // New PO form state
  const [poForm, setPoForm] = useState({
    vendor_id: "",
    department_id: "",
    order_date: new Date().toISOString().split("T")[0],
    expected_delivery_date: "",
    notes: "",
    use_igst: false,
  });
  const [poItems, setPoItems] = useState<POItem[]>([
    {
      item_name: "",
      description: "",
      quantity: 1,
      unit: "Nos",
      rate: 0,
      gst_rate: 18,
      hsn_code: "",
      batch_number: "",
      expiry_date: "",
    },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [ordersRes, vendorsRes, deptsRes, configRes] = await Promise.all([
      supabase
        .from("purchase_orders" as any)
        .select("*, vendor:vendors(name), department:departments(name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("vendors" as any)
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
      getTallyConfig(),
    ]);

    if (ordersRes.data) setOrders(ordersRes.data as any);
    if (vendorsRes.data) setVendors(vendorsRes.data as any);
    if (deptsRes.data) setDepartments(deptsRes.data);
    setTallyConfig(configRes);
    setLoading(false);
  };

  // Calculate totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    poItems.forEach((item) => {
      const lineTotal = item.quantity * item.rate;
      subtotal += lineTotal;
      const gstAmt = (lineTotal * item.gst_rate) / 100;

      if (poForm.use_igst) {
        totalIgst += gstAmt;
      } else {
        totalCgst += gstAmt / 2;
        totalSgst += gstAmt / 2;
      }
    });

    const totalGst = totalCgst + totalSgst + totalIgst;
    return {
      subtotal: +subtotal.toFixed(2),
      cgst: +totalCgst.toFixed(2),
      sgst: +totalSgst.toFixed(2),
      igst: +totalIgst.toFixed(2),
      totalGst: +totalGst.toFixed(2),
      grandTotal: +(subtotal + totalGst).toFixed(2),
    };
  }, [poItems, poForm.use_igst]);

  const addItem = () => {
    setPoItems([
      ...poItems,
      {
        item_name: "",
        description: "",
        quantity: 1,
        unit: "Nos",
        rate: 0,
        gst_rate: 18,
        hsn_code: "",
        batch_number: "",
        expiry_date: "",
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (poItems.length === 1) return;
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    const updated = [...poItems];
    (updated[index] as any)[field] = value;
    setPoItems(updated);
  };

  const handleCreatePO = async () => {
    if (!poForm.vendor_id) {
      toast.error("Please select a vendor");
      return;
    }
    if (poItems.some((i) => !i.item_name.trim())) {
      toast.error("All items must have a name");
      return;
    }

    setSaving(true);
    try {
      // Create PO header
      const { data: po, error: poError } = await supabase
        .from("purchase_orders" as any)
        .insert({
          po_number: "", // Auto-generated by trigger
          vendor_id: poForm.vendor_id,
          department_id: poForm.department_id || null,
          status: "pending_approval",
          order_date: poForm.order_date,
          expected_delivery_date: poForm.expected_delivery_date || null,
          subtotal: totals.subtotal,
          cgst_amount: totals.cgst,
          sgst_amount: totals.sgst,
          igst_amount: totals.igst,
          total_gst: totals.totalGst,
          grand_total: totals.grandTotal,
          notes: poForm.notes,
          created_by: user?.id,
        })
        .select("id")
        .single();

      if (poError) throw poError;

      // Create PO items
      const items = poItems.map((item) => {
        const lineTotal = item.quantity * item.rate;
        const gstAmt = (lineTotal * item.gst_rate) / 100;
        return {
          purchase_order_id: (po as any).id,
          item_name: item.item_name,
          item_id: item.item_id || null,
          chemical_id: item.chemical_id || null,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          gst_rate: item.gst_rate,
          cgst_amount: poForm.use_igst ? 0 : +(gstAmt / 2).toFixed(2),
          sgst_amount: poForm.use_igst ? 0 : +(gstAmt / 2).toFixed(2),
          igst_amount: poForm.use_igst ? +gstAmt.toFixed(2) : 0,
          total: +(lineTotal + gstAmt).toFixed(2),
          hsn_code: item.hsn_code,
          batch_number: item.batch_number,
          expiry_date: item.expiry_date || null,
          tally_stock_item_name: item.item_name,
        };
      });

      const { error: itemsError } = await supabase
        .from("purchase_order_items" as any)
        .insert(items);

      if (itemsError) throw itemsError;

      toast.success("Purchase Order created! Pending approval.");
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create PO");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (poId: string) => {
    const { error } = await supabase
      .from("purchase_orders" as any)
      .update({
        status: "approved",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", poId);

    if (error) {
      toast.error("Failed to approve PO");
    } else {
      toast.success("Purchase Order approved!");
      loadData();
    }
  };

  const handleReject = async (poId: string) => {
    const { error } = await supabase
      .from("purchase_orders" as any)
      .update({
        status: "rejected",
        rejected_by: user?.id,
        rejected_at: new Date().toISOString(),
      })
      .eq("id", poId);

    if (error) {
      toast.error("Failed to reject PO");
    } else {
      toast.success("Purchase Order rejected");
      loadData();
    }
  };

  const handlePushToTally = async (poId: string) => {
    if (!tallyConfig || !tallyConfig.is_enabled) {
      toast.error("Tally integration is not configured or enabled");
      return;
    }

    setPushingToTally(poId);
    try {
      const result = await createPurchaseVoucher(poId, tallyConfig);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPushingToTally(null);
    }
  };

  const handleDownloadEInvoice = async (po: PurchaseOrder) => {
    try {
      // Fetch PO items
      const { data: poItems } = await supabase
        .from("purchase_order_items" as any)
        .select("*")
        .eq("purchase_order_id", po.id);

      // Fetch vendor
      const { data: vendor } = await supabase
        .from("vendors" as any)
        .select("*")
        .eq("id", po.vendor_id)
        .single();

      const vendorData = vendor as any;

      const items: EInvoiceItem[] = ((poItems as any[]) || []).map(
        (item: any, idx: number) => {
          const lineTotal = parseFloat(item.quantity) * parseFloat(item.rate);
          const gstRate = parseFloat(item.gst_rate) || 18;
          const isIgst = parseFloat(item.igst_amount) > 0;
          const gstAmt = (lineTotal * gstRate) / 100;
          return {
            slNo: idx + 1,
            productDesc: item.item_name,
            hsnCode: item.hsn_code || "",
            quantity: parseFloat(item.quantity),
            unit: item.unit || "NOS",
            unitPrice: parseFloat(item.rate),
            totalAmount: lineTotal,
            taxableValue: lineTotal,
            cgstRate: isIgst ? 0 : gstRate / 2,
            cgstAmount: isIgst ? 0 : +(gstAmt / 2).toFixed(2),
            sgstRate: isIgst ? 0 : gstRate / 2,
            sgstAmount: isIgst ? 0 : +(gstAmt / 2).toFixed(2),
            igstRate: isIgst ? gstRate : 0,
            igstAmount: isIgst ? +gstAmt.toFixed(2) : 0,
          };
        },
      );

      const eInvoiceData: EInvoiceData = {
        sellerGstin: vendorData?.gstin || "",
        sellerName: vendorData?.name || "Vendor",
        sellerAddress: vendorData?.address || "",
        sellerState: vendorData?.state || "",
        sellerStateCode: vendorData?.state_code || "",
        buyerGstin: "", // Your org GSTIN — to be configured
        buyerName: tallyConfig?.company_name || "Lab",
        buyerAddress: "",
        buyerState: "",
        buyerStateCode: "",
        invoiceNumber: po.po_number,
        invoiceDate: po.order_date
          ? format(new Date(po.order_date), "dd/MM/yyyy")
          : format(new Date(), "dd/MM/yyyy"),
        invoiceType: "INV",
        items,
        totalTaxableValue: parseFloat(String(po.subtotal)) || 0,
        cgstTotal: parseFloat(String(po.cgst_amount)) || 0,
        sgstTotal: parseFloat(String(po.sgst_amount)) || 0,
        igstTotal: parseFloat(String(po.igst_amount)) || 0,
        grandTotal: parseFloat(String(po.grand_total)) || 0,
      };

      const json = buildEInvoiceJson(eInvoiceData);

      // Trigger download
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `e-invoice_${po.po_number}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`E-Invoice JSON downloaded for ${po.po_number}`);
    } catch (err: any) {
      toast.error(`Failed to generate E-Invoice: ${err.message}`);
    }
  };

  const resetForm = () => {
    setPoForm({
      vendor_id: "",
      department_id: "",
      order_date: new Date().toISOString().split("T")[0],
      expected_delivery_date: "",
      notes: "",
      use_igst: false,
    });
    setPoItems([
      {
        item_name: "",
        description: "",
        quantity: 1,
        unit: "Nos",
        rate: 0,
        gst_rate: 18,
        hsn_code: "",
        batch_number: "",
        expiry_date: "",
      },
    ]);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      pending_approval:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
      approved: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
      sent_to_tally:
        "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
      rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
      cancelled:
        "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
    };
    return (
      <Badge className={styles[status] || "bg-gray-100 text-gray-700"}>
        {status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.po_number.toLowerCase().includes(search.toLowerCase()) ||
      (o.vendor as any)?.name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DashboardLayout
      title="Purchase Orders"
      subtitle="Create and manage purchase orders with TallyPrime sync"
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {orders.filter((o) => o.status === "pending_approval").length}
              </p>
              <p className="text-xs text-muted-foreground">Pending Approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {orders.filter((o) => o.status === "approved").length}
              </p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {orders.filter((o) => o.status === "sent_to_tally").length}
              </p>
              <p className="text-xs text-muted-foreground">Sent to Tally</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">
                ₹
                {orders
                  .reduce(
                    (sum, o) => sum + (parseFloat(String(o.grand_total)) || 0),
                    0,
                  )
                  .toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-muted-foreground">Total Value</p>
            </CardContent>
          </Card>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by PO number or vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Purchase Order
          </Button>
        </div>

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tally</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-muted-foreground">
                            No purchase orders yet
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono font-medium">
                            {po.po_number}
                          </TableCell>
                          <TableCell>
                            {(po.vendor as any)?.name || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {po.order_date
                              ? format(new Date(po.order_date), "dd MMM yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <div className="flex items-center justify-end gap-0.5">
                              <IndianRupee className="h-3 w-3" />
                              {parseFloat(
                                String(po.grand_total),
                              ).toLocaleString("en-IN")}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(po.status)}</TableCell>
                          <TableCell>
                            {po.tally_sync_status === "synced" ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Synced
                              </Badge>
                            ) : po.tally_sync_status === "failed" ? (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                                <XCircle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {po.status === "pending_approval" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleApprove(po.id)}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleReject(po.id)}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {po.status === "approved" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePushToTally(po.id)}
                                  disabled={pushingToTally === po.id}
                                  className="text-blue-600"
                                >
                                  {pushingToTally === po.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Send className="h-3 w-3 mr-1" />
                                  )}
                                  Push to Tally
                                </Button>
                              )}
                              {po.tally_sync_status === "synced" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-purple-600"
                                  onClick={() => handleDownloadEInvoice(po)}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  E-Invoice
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create PO Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Create Purchase Order
              </DialogTitle>
              <DialogDescription>
                Create a new purchase order. On approval, it can be pushed to
                TallyPrime as a Purchase Voucher.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* PO Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor *</Label>
                  <Select
                    value={poForm.vendor_id}
                    onValueChange={(v) =>
                      setPoForm({ ...poForm, vendor_id: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={poForm.department_id}
                    onValueChange={(v) =>
                      setPoForm({ ...poForm, department_id: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Order Date</Label>
                  <Input
                    type="date"
                    value={poForm.order_date}
                    onChange={(e) =>
                      setPoForm({ ...poForm, order_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected Delivery</Label>
                  <Input
                    type="date"
                    value={poForm.expected_delivery_date}
                    onChange={(e) =>
                      setPoForm({
                        ...poForm,
                        expected_delivery_date: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* GST Type Toggle */}
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <Label>GST Type:</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={!poForm.use_igst ? "default" : "outline"}
                    onClick={() => setPoForm({ ...poForm, use_igst: false })}
                  >
                    CGST + SGST (Intra-state)
                  </Button>
                  <Button
                    size="sm"
                    variant={poForm.use_igst ? "default" : "outline"}
                    onClick={() => setPoForm({ ...poForm, use_igst: true })}
                  >
                    IGST (Inter-state)
                  </Button>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-medium">Line Items</Label>
                  <Button size="sm" variant="outline" onClick={addItem}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {poItems.map((item, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Item Name *</Label>
                          <Input
                            value={item.item_name}
                            onChange={(e) =>
                              updateItem(idx, "item_name", e.target.value)
                            }
                            placeholder="e.g. Sodium Chloride"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(
                                idx,
                                "quantity",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit</Label>
                          <Input
                            value={item.unit}
                            onChange={(e) =>
                              updateItem(idx, "unit", e.target.value)
                            }
                            placeholder="Nos"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Rate (₹)</Label>
                          <Input
                            type="number"
                            value={item.rate}
                            onChange={(e) =>
                              updateItem(
                                idx,
                                "rate",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">GST %</Label>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={item.gst_rate}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  "gst_rate",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="h-8 text-sm"
                            />
                            {poItems.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-500"
                                onClick={() => removeItem(idx)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="space-y-1">
                          <Label className="text-xs">HSN Code</Label>
                          <Input
                            value={item.hsn_code}
                            onChange={(e) =>
                              updateItem(idx, "hsn_code", e.target.value)
                            }
                            className="h-8 text-sm"
                            placeholder="e.g. 28289090"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Batch No.</Label>
                          <Input
                            value={item.batch_number}
                            onChange={(e) =>
                              updateItem(idx, "batch_number", e.target.value)
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Expiry Date</Label>
                          <Input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) =>
                              updateItem(idx, "expiry_date", e.target.value)
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="text-right mt-2">
                        <span className="text-sm font-medium">
                          Line Total: ₹
                          {(
                            item.quantity * item.rate +
                            (item.quantity * item.rate * item.gst_rate) / 100
                          ).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <Card className="bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-slate-900 dark:to-blue-950/50">
                <CardContent className="p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>
                        ₹
                        {totals.subtotal.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    {!poForm.use_igst ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CGST</span>
                          <span>
                            ₹
                            {totals.cgst.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SGST</span>
                          <span>
                            ₹
                            {totals.sgst.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IGST</span>
                        <span>
                          ₹
                          {totals.igst.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between text-base font-bold">
                      <span>Grand Total</span>
                      <span className="text-emerald-600">
                        ₹
                        {totals.grandTotal.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Budget Check */}
              {tallyConfig && tallyConfig.is_enabled && (
                <Card className="border-dashed border-2 border-amber-300 dark:border-amber-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Wallet className="h-4 w-4 text-amber-600" />
                      <Label className="text-sm font-medium">
                        Budget Check (from Tally)
                      </Label>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter budget ledger name, e.g. Lab Supplies Budget"
                        value={budgetLedger}
                        onChange={(e) => {
                          setBudgetLedger(e.target.value);
                          setBudgetResult(null);
                        }}
                        className="flex-1 h-9 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          !budgetLedger.trim() ||
                          checkingBudget ||
                          totals.grandTotal <= 0
                        }
                        onClick={async () => {
                          if (!tallyConfig || !budgetLedger.trim()) return;
                          setCheckingBudget(true);
                          try {
                            const result = await checkBudgetBalance(
                              budgetLedger.trim(),
                              totals.grandTotal,
                              tallyConfig,
                            );
                            setBudgetResult(result);
                          } catch (err: any) {
                            toast.error(err.message);
                          } finally {
                            setCheckingBudget(false);
                          }
                        }}
                      >
                        {checkingBudget ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Wallet className="h-3 w-3 mr-1" />
                        )}
                        Check
                      </Button>
                    </div>
                    {budgetResult && (
                      <div
                        className={`mt-3 p-3 rounded-lg text-sm ${
                          budgetResult.sufficient
                            ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {budgetResult.sufficient ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          <span className="font-medium">
                            {budgetResult.message}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={poForm.notes}
                  onChange={(e) =>
                    setPoForm({ ...poForm, notes: e.target.value })
                  }
                  placeholder="Additional notes or instructions..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePO} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Create Purchase Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
