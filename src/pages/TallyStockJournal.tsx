import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  FlaskConical,
  Package,
  ArrowRight,
  Send,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import {
  createStockJournal,
  getTallyConfig,
  type TallyConfig,
} from "@/services/tallyService";

interface ConsumptionEntry {
  id?: string;
  type: "chemical" | "item";
  entity_id: string;
  entity_name: string;
  quantity: number;
  unit: string;
  purpose: string;
  notes: string;
  location: string;
}

export default function TallyStockJournal() {
  const { user } = useAuth();
  const [config, setConfig] = useState<TallyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [chemicals, setChemicals] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [posting, setPosting] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [entry, setEntry] = useState<ConsumptionEntry>({
    type: "chemical",
    entity_id: "",
    entity_name: "",
    quantity: 0,
    unit: "",
    purpose: "",
    notes: "",
    location: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [configRes, chemRes, itemRes, txnRes] = await Promise.all([
      getTallyConfig(),
      supabase
        .from("chemicals")
        .select("id, name, unit, current_quantity, storage_location")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("items")
        .select("id, name, unit, current_quantity, storage_location")
        .order("name"),
      supabase
        .from("tally_sync_logs" as any)
        .select("*")
        .eq("operation", "create_stock_journal")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setConfig(configRes);
    if (chemRes.data) setChemicals(chemRes.data);
    if (itemRes.data) setItems(itemRes.data);
    if (txnRes.data) setRecentTransactions(txnRes.data as any[]);
    setLoading(false);
  };

  const handleEntityChange = (entityId: string) => {
    const allEntities = entry.type === "chemical" ? chemicals : items;
    const selected = allEntities.find((e) => e.id === entityId);
    if (selected) {
      setEntry({
        ...entry,
        entity_id: entityId,
        entity_name: selected.name,
        unit: selected.unit || "Nos",
        location: selected.storage_location || "",
      });
    }
  };

  const handleRecordAndPost = async () => {
    if (!entry.entity_id || entry.quantity <= 0) {
      toast.error("Please select an item and enter quantity");
      return;
    }

    setSaving(true);
    try {
      // Step 1: Record the transaction in the appropriate table
      let transactionId: string;

      if (entry.type === "chemical") {
        const { data: chem } = await supabase
          .from("chemicals")
          .select("current_quantity")
          .eq("id", entry.entity_id)
          .single();

        const currentQty = chem?.current_quantity || 0;

        const { data: txn, error: txnError } = await supabase
          .from("chemical_transactions")
          .insert({
            chemical_id: entry.entity_id,
            transaction_type: "usage",
            quantity: -entry.quantity,
            unit: entry.unit,
            purpose: entry.purpose,
            notes: entry.notes,
            performed_by: user?.id,
            quantity_before: currentQty,
            quantity_after: currentQty - entry.quantity,
            from_location: entry.location,
          })
          .select("id")
          .single();

        if (txnError) throw txnError;
        transactionId = txn.id;

        // Update chemical quantity
        await supabase
          .from("chemicals")
          .update({
            current_quantity: currentQty - entry.quantity,
          })
          .eq("id", entry.entity_id);
      } else {
        const { data: item } = await supabase
          .from("items")
          .select("current_quantity")
          .eq("id", entry.entity_id)
          .single();

        const currentQty = item?.current_quantity || 0;

        const { data: txn, error: txnError } = await supabase
          .from("item_transactions")
          .insert({
            item_id: entry.entity_id,
            transaction_type: "usage",
            quantity: -entry.quantity,
            performed_by: user?.id,
            notes: `${entry.purpose} - ${entry.notes}`.trim(),
            quantity_before: currentQty,
            quantity_after: currentQty - entry.quantity,
            from_location: entry.location,
          })
          .select("id")
          .single();

        if (txnError) throw txnError;
        transactionId = txn.id;

        // Update item quantity
        await supabase
          .from("items")
          .update({
            current_quantity: currentQty - entry.quantity,
          })
          .eq("id", entry.entity_id);
      }

      toast.success(
        `Consumption recorded: ${entry.quantity} ${entry.unit} of ${entry.entity_name}`,
      );

      // Step 2: Post to Tally (if enabled)
      if (config && config.is_enabled) {
        const result = await createStockJournal(
          transactionId,
          entry.type,
          config,
        );
        if (result.success) {
          toast.success("📊 Stock journal posted to TallyPrime");
        } else {
          toast.warning(`Tally post failed: ${result.message}`);
        }
      }

      // Reset form and reload
      setEntry({
        type: "chemical",
        entity_id: "",
        entity_name: "",
        quantity: 0,
        unit: "",
        purpose: "",
        notes: "",
        location: "",
      });
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to record consumption");
    } finally {
      setSaving(false);
    }
  };

  const handleRetryPost = async (logEntry: any) => {
    if (!config || !config.is_enabled) {
      toast.error("Tally is not enabled");
      return;
    }
    if (!logEntry.entity_id) {
      toast.error("Missing entity ID for retry");
      return;
    }

    setPosting(logEntry.id);
    try {
      const entityType =
        logEntry.entity_type === "chemical" ? "chemical" : "item";
      const result = await createStockJournal(
        logEntry.entity_id,
        entityType as "chemical" | "item",
        config,
      );
      if (result.success) {
        toast.success("Stock journal posted successfully on retry");
      } else {
        toast.error(result.message);
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPosting(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Stock Journal" subtitle="Loading...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Stock Journal"
      subtitle="Record consumption and auto-post to TallyPrime"
    >
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <FlaskConical className="h-6 w-6 mx-auto mb-1 text-purple-500" />
              <p className="text-2xl font-bold">{chemicals.length}</p>
              <p className="text-xs text-muted-foreground">Chemicals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Package className="h-6 w-6 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold">{items.length}</p>
              <p className="text-xs text-muted-foreground">Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-6 w-6 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold">
                {
                  recentTransactions.filter((t) => t.status === "success")
                    .length
                }
              </p>
              <p className="text-xs text-muted-foreground">Posted to Tally</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <XCircle className="h-6 w-6 mx-auto mb-1 text-red-500" />
              <p className="text-2xl font-bold">
                {recentTransactions.filter((t) => t.status === "failed").length}
              </p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search journal entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Record Consumption
          </Button>
        </div>

        {/* Recent Journal Entries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Recent Stock Journal Entries
            </CardTitle>
            <CardDescription>
              Consumption transactions posted (or attempted) to TallyPrime
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-12 text-muted-foreground"
                      >
                        <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        No stock journal entries yet. Record a consumption to
                        start.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentTransactions
                      .filter(
                        (t) =>
                          !search ||
                          t.entity_name
                            ?.toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((txn: any) => (
                        <TableRow key={txn.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {txn.created_at
                              ? format(new Date(txn.created_at), "dd MMM HH:mm")
                              : "—"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {txn.entity_name || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {txn.entity_type || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {txn.status === "success" ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Posted
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                                <XCircle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-red-500 max-w-[200px] truncate">
                            {txn.error_message || "—"}
                          </TableCell>
                          <TableCell>
                            {txn.status === "failed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetryPost(txn)}
                                disabled={posting === txn.id}
                              >
                                {posting === txn.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Send className="h-3 w-3 mr-1" />
                                )}
                                Retry
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Record Consumption Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-orange-500" />
                Record Consumption
              </DialogTitle>
              <DialogDescription>
                Record a usage event. If TallyPrime is enabled, a Stock Journal
                will be auto-posted.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Type Toggle */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={entry.type === "chemical" ? "default" : "outline"}
                  onClick={() =>
                    setEntry({
                      ...entry,
                      type: "chemical",
                      entity_id: "",
                      entity_name: "",
                      unit: "",
                    })
                  }
                >
                  <FlaskConical className="h-4 w-4 mr-1" />
                  Chemical
                </Button>
                <Button
                  size="sm"
                  variant={entry.type === "item" ? "default" : "outline"}
                  onClick={() =>
                    setEntry({
                      ...entry,
                      type: "item",
                      entity_id: "",
                      entity_name: "",
                      unit: "",
                    })
                  }
                >
                  <Package className="h-4 w-4 mr-1" />
                  Equipment / Item
                </Button>
              </div>

              {/* Select Entity */}
              <div className="space-y-2">
                <Label>
                  {entry.type === "chemical" ? "Chemical" : "Item"} *
                </Label>
                <Select
                  value={entry.entity_id}
                  onValueChange={handleEntityChange}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={`Select ${entry.type === "chemical" ? "chemical" : "item"}...`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(entry.type === "chemical" ? chemicals : items).map(
                      (e: any) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}{" "}
                          <span className="text-muted-foreground">
                            ({e.current_quantity} {e.unit || "Nos"} available)
                          </span>
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity + Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    value={entry.quantity || ""}
                    onChange={(e) =>
                      setEntry({
                        ...entry,
                        quantity: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="e.g. 50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input
                    value={entry.unit}
                    onChange={(e) =>
                      setEntry({ ...entry, unit: e.target.value })
                    }
                    placeholder="ml, g, Nos"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Input
                  value={entry.purpose}
                  onChange={(e) =>
                    setEntry({ ...entry, purpose: e.target.value })
                  }
                  placeholder="e.g. Experiment #123, Lab Session"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={entry.notes}
                  onChange={(e) =>
                    setEntry({ ...entry, notes: e.target.value })
                  }
                  placeholder="Additional details..."
                  rows={2}
                />
              </div>

              {/* Tally Status Indicator */}
              {config && config.is_enabled ? (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950 p-3 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  TallyPrime is connected — journal will be auto-posted
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                  <XCircle className="h-4 w-4" />
                  TallyPrime is not enabled — consumption will only be recorded
                  locally
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRecordAndPost}
                disabled={saving}
                className="bg-gradient-to-r from-orange-600 to-red-600"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Record & Post
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
