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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  TrendingDown,
  IndianRupee,
  Search,
  Send,
  Calculator,
  CheckCircle,
  XCircle,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInMonths } from "date-fns";
import {
  getTallyConfig,
  calculateDepreciation,
  postDepreciation,
  type TallyConfig,
  type DepreciationParams,
} from "@/services/tallyService";

interface AssetItem {
  id: string;
  name: string;
  purchase_price: number | null;
  purchase_date: string | null;
  item_type: string | null;
  department_id: string | null;
  brand: string | null;
  model_number: string | null;
  serial_number: string | null;
  status: string | null;
  department?: { name: string } | null;
}

export default function EquipmentDepreciation() {
  const [config, setConfig] = useState<TallyConfig | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [posting, setPosting] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);

  const [depForm, setDepForm] = useState({
    method: "SLM" as "SLM" | "WDV",
    rate: 15,
    periodMonths: 12,
    assetLedger: "Lab Equipment",
    depreciationLedger: "Depreciation on Lab Equipment",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [configRes, assetsRes] = await Promise.all([
      getTallyConfig(),
      supabase
        .from("items")
        .select(
          "id, name, purchase_price, purchase_date, item_type, department_id, brand, model_number, serial_number, status, department:departments(name)",
        )
        .not("purchase_price", "is", null)
        .gt("purchase_price", 0)
        .order("name"),
    ]);

    setConfig(configRes);
    if (assetsRes.data) setAssets(assetsRes.data as any);
    setLoading(false);
  };

  const getAge = (purchaseDate: string | null) => {
    if (!purchaseDate) return "—";
    const months = differenceInMonths(new Date(), new Date(purchaseDate));
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years === 0) return `${rem} mo`;
    return `${years}y ${rem}m`;
  };

  const previewDepreciation = useMemo(() => {
    if (!selectedAsset || !selectedAsset.purchase_price) return 0;
    return +calculateDepreciation({
      itemId: selectedAsset.id,
      itemName: selectedAsset.name,
      purchasePrice: selectedAsset.purchase_price,
      purchaseDate: selectedAsset.purchase_date || new Date().toISOString(),
      depreciationRate: depForm.rate,
      method: depForm.method,
      assetLedger: depForm.assetLedger,
      depreciationLedger: depForm.depreciationLedger,
      periodMonths: depForm.periodMonths,
    }).toFixed(2);
  }, [selectedAsset, depForm]);

  const handleOpenDialog = (asset: AssetItem) => {
    setSelectedAsset(asset);
    setDialogOpen(true);
  };

  const handlePost = async () => {
    if (!selectedAsset || !config || !config.is_enabled) {
      toast.error("Tally not configured or asset invalid");
      return;
    }

    setPosting(selectedAsset.id);
    try {
      const params: DepreciationParams = {
        itemId: selectedAsset.id,
        itemName: selectedAsset.name,
        purchasePrice: selectedAsset.purchase_price || 0,
        purchaseDate: selectedAsset.purchase_date || new Date().toISOString(),
        depreciationRate: depForm.rate,
        method: depForm.method,
        assetLedger: depForm.assetLedger,
        depreciationLedger: depForm.depreciationLedger,
        costCenter: (selectedAsset.department as any)?.name,
        periodMonths: depForm.periodMonths,
      };

      const result = await postDepreciation(params, config);

      if (result.success) {
        toast.success(result.message);
        setDialogOpen(false);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPosting(null);
    }
  };

  const filteredAssets = assets.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.brand?.toLowerCase().includes(search.toLowerCase()) ||
      a.serial_number?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalAssetValue = assets.reduce(
    (sum, a) => sum + (a.purchase_price || 0),
    0,
  );

  if (loading) {
    return (
      <DashboardLayout title="Equipment Depreciation" subtitle="Loading...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Equipment Depreciation"
      subtitle="Calculate and post depreciation entries to TallyPrime"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Package className="h-6 w-6 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold">{assets.length}</p>
              <p className="text-xs text-muted-foreground">Fixed Assets</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <IndianRupee className="h-6 w-6 mx-auto mb-1 text-emerald-500" />
              <p className="text-2xl font-bold">
                ₹{totalAssetValue.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-muted-foreground">Total Asset Value</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingDown className="h-6 w-6 mx-auto mb-1 text-orange-500" />
              <p className="text-2xl font-bold">{depForm.rate}%</p>
              <p className="text-xs text-muted-foreground">Default Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              {config?.is_enabled ? (
                <CheckCircle className="h-6 w-6 mx-auto mb-1 text-green-500" />
              ) : (
                <XCircle className="h-6 w-6 mx-auto mb-1 text-red-500" />
              )}
              <p className="text-2xl font-bold">
                {config?.is_enabled ? "On" : "Off"}
              </p>
              <p className="text-xs text-muted-foreground">Tally Status</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Assets Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingDown className="h-5 w-5" />
              Fixed Assets Register
            </CardTitle>
            <CardDescription>
              Equipment with purchase price — click "Depreciate" to calculate
              and post to Tally
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Brand / Model</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Purchase Price</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-12 text-muted-foreground"
                      >
                        <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        No fixed assets with purchase price found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{asset.name}</p>
                            {asset.serial_number && (
                              <p className="text-xs text-muted-foreground">
                                S/N: {asset.serial_number}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {[asset.brand, asset.model_number]
                            .filter(Boolean)
                            .join(" / ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(asset.department as any)?.name || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <div className="flex items-center justify-end gap-0.5">
                            <IndianRupee className="h-3 w-3" />
                            {(asset.purchase_price || 0).toLocaleString(
                              "en-IN",
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {asset.purchase_date
                            ? format(
                                new Date(asset.purchase_date),
                                "dd MMM yyyy",
                              )
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getAge(asset.purchase_date)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDialog(asset)}
                            disabled={!config?.is_enabled}
                          >
                            <Calculator className="h-3 w-3 mr-1" />
                            Depreciate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Depreciation Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-orange-500" />
                Post Depreciation
              </DialogTitle>
              <DialogDescription>
                {selectedAsset?.name} — ₹
                {(selectedAsset?.purchase_price || 0).toLocaleString("en-IN")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Method */}
              <div className="space-y-2">
                <Label>Method</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={depForm.method === "SLM" ? "default" : "outline"}
                    onClick={() => setDepForm({ ...depForm, method: "SLM" })}
                  >
                    SLM (Straight Line)
                  </Button>
                  <Button
                    size="sm"
                    variant={depForm.method === "WDV" ? "default" : "outline"}
                    onClick={() => setDepForm({ ...depForm, method: "WDV" })}
                  >
                    WDV (Written Down)
                  </Button>
                </div>
              </div>

              {/* Rate & Period */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Annual Rate (%)</Label>
                  <Input
                    type="number"
                    value={depForm.rate}
                    onChange={(e) =>
                      setDepForm({
                        ...depForm,
                        rate: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period (months)</Label>
                  <Input
                    type="number"
                    value={depForm.periodMonths}
                    onChange={(e) =>
                      setDepForm({
                        ...depForm,
                        periodMonths: parseInt(e.target.value) || 12,
                      })
                    }
                  />
                </div>
              </div>

              {/* Tally Ledgers */}
              <div className="space-y-2">
                <Label>Asset Ledger (Tally)</Label>
                <Input
                  value={depForm.assetLedger}
                  onChange={(e) =>
                    setDepForm({ ...depForm, assetLedger: e.target.value })
                  }
                  placeholder="e.g. Lab Equipment"
                />
              </div>
              <div className="space-y-2">
                <Label>Depreciation Ledger (Tally)</Label>
                <Input
                  value={depForm.depreciationLedger}
                  onChange={(e) =>
                    setDepForm({
                      ...depForm,
                      depreciationLedger: e.target.value,
                    })
                  }
                  placeholder="e.g. Depreciation on Lab Equipment"
                />
              </div>

              {/* Preview */}
              <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Depreciation Amount
                      </p>
                      <p className="text-2xl font-bold text-orange-600">
                        ₹{previewDepreciation.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>
                        {depForm.method} @ {depForm.rate}%
                      </p>
                      <p>{depForm.periodMonths} months</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePost}
                disabled={posting !== null || previewDepreciation <= 0}
                className="bg-gradient-to-r from-orange-600 to-red-600"
              >
                {posting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Post to Tally
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
