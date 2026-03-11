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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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
  FlaskConical,
  Search,
  AlertTriangle,
  Package,
  Thermometer,
  Droplets,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Shield,
} from "lucide-react";
import { SDSViewer } from "@/components/chemicals/SDSViewer";
import { InlineHazardInfo } from "@/components/chemicals/InlineHazardInfo";

interface Chemical {
  id: string;
  name: string;
  cas_number: string | null;
  formula: string | null;
  description: string | null;
  storage_location: string | null;
  storage_conditions: string | null;
  current_quantity: number;
  unit: string | null;
  minimum_quantity: number | null;
  expiry_date: string | null;
  is_active: boolean;
  is_expired: boolean;
  hazard_type_id: string | null;
  supplier_name: string | null;
  supplier_contact: string | null;
  batch_number: string | null;
  created_at: string;
}

interface HazardType {
  id: string;
  name: string;
  code: string;
  color_hex: string;
}

const defaultFormData = {
  name: "",
  cas_number: "",
  formula: "",
  description: "",
  current_quantity: 0,
  unit: "ml",
  minimum_quantity: 0,
  storage_location: "",
  storage_conditions: "",
  hazard_type_id: "",
  expiry_date: "",
  supplier_name: "",
  supplier_contact: "",
  batch_number: "",
};

export default function Chemicals() {
  const { toast } = useToast();
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [hazardTypes, setHazardTypes] = useState<HazardType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChemical, setEditingChemical] = useState<Chemical | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [sdsChemical, setSdsChemical] = useState<{
    name: string;
    cas: string | null;
  } | null>(null);

  useEffect(() => {
    fetchChemicals();
    fetchHazardTypes();
  }, []);

  const fetchChemicals = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("chemicals")
        .select("*")
        .order("name");

      if (error) throw error;
      setChemicals((data as Chemical[]) || []);
    } catch (error: any) {
      console.error("Failed to fetch chemicals:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch chemicals",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHazardTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("chemical_hazard_types")
        .select("id, name, code, color_hex")
        .order("name");

      if (error) throw error;
      setHazardTypes((data as HazardType[]) || []);
    } catch (error: any) {
      console.error("Failed to fetch hazard types:", error);
    }
  };

  const resetForm = () => {
    setEditingChemical(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Chemical name is required",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const chemicalData: any = {
        name: formData.name,
        cas_number: formData.cas_number || null,
        formula: formData.formula || null,
        description: formData.description || null,
        current_quantity: formData.current_quantity || 0,
        unit: formData.unit || "ml",
        minimum_quantity: formData.minimum_quantity || null,
        storage_location: formData.storage_location || null,
        storage_conditions: formData.storage_conditions || null,
        hazard_type_id: formData.hazard_type_id || null,
        expiry_date: formData.expiry_date || null,
        supplier_name: formData.supplier_name || null,
        supplier_contact: formData.supplier_contact || null,
        batch_number: formData.batch_number || null,
      };

      if (editingChemical) {
        const { error } = await supabase
          .from("chemicals")
          .update(chemicalData)
          .eq("id", editingChemical.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Chemical updated successfully",
        });
      } else {
        const { error } = await supabase.from("chemicals").insert(chemicalData);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Chemical created successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchChemicals();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Operation failed",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (chem: Chemical) => {
    setEditingChemical(chem);
    setFormData({
      name: chem.name,
      cas_number: chem.cas_number || "",
      formula: chem.formula || "",
      description: chem.description || "",
      current_quantity: chem.current_quantity || 0,
      unit: chem.unit || "ml",
      minimum_quantity: chem.minimum_quantity || 0,
      storage_location: chem.storage_location || "",
      storage_conditions: chem.storage_conditions || "",
      hazard_type_id: chem.hazard_type_id || "",
      expiry_date: chem.expiry_date || "",
      supplier_name: chem.supplier_name || "",
      supplier_contact: chem.supplier_contact || "",
      batch_number: chem.batch_number || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this chemical?")) return;

    try {
      const { error } = await supabase.from("chemicals").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Chemical deleted successfully" });
      fetchChemicals();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete chemical",
      });
    }
  };

  const getHazardTypeName = (hazardTypeId: string | null) => {
    if (!hazardTypeId) return null;
    const hazard = hazardTypes.find((h) => h.id === hazardTypeId);
    return hazard ? hazard.name : null;
  };

  const filteredChemicals = chemicals.filter((chem) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      chem.name?.toLowerCase().includes(query) ||
      (chem.cas_number && chem.cas_number.toLowerCase().includes(query)) ||
      (chem.formula && chem.formula.toLowerCase().includes(query)) ||
      (chem.storage_location &&
        chem.storage_location.toLowerCase().includes(query)) ||
      (chem.supplier_name && chem.supplier_name.toLowerCase().includes(query))
    );
  });

  const lowStockCount = chemicals.filter(
    (c) => c.minimum_quantity && c.current_quantity <= c.minimum_quantity,
  ).length;

  const hazardousCount = chemicals.filter((c) => c.hazard_type_id).length;

  return (
    <DashboardLayout
      title="Chemicals"
      subtitle="Manage laboratory chemicals inventory"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Total Chemicals
              </CardDescription>
              <CardTitle className="text-2xl">{chemicals.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Low Stock
              </CardDescription>
              <CardTitle className="text-2xl text-warning">
                {lowStockCount}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Hazardous
              </CardDescription>
              <CardTitle className="text-2xl text-destructive">
                {hazardousCount}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Requires Special Storage
              </CardDescription>
              <CardTitle className="text-2xl">
                {chemicals.filter((c) => c.storage_conditions).length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Search and Add Button */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, CAS number, or formula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Chemical
          </Button>
        </div>

        {/* Chemicals Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Chemicals Inventory
            </CardTitle>
            <CardDescription>
              {filteredChemicals.length} chemical
              {filteredChemicals.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredChemicals.length === 0 ? (
              <div className="text-center py-12">
                <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No chemicals found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add chemicals to start tracking your lab inventory
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Formula / CAS</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Hazard</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>SDS</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChemicals.map((chem) => (
                    <TableRow key={chem.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{chem.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {chem.formula && (
                            <p className="font-mono text-sm">{chem.formula}</p>
                          )}
                          {chem.cas_number && (
                            <p className="text-xs text-muted-foreground">
                              CAS: {chem.cas_number}
                            </p>
                          )}
                          {!chem.formula && !chem.cas_number && "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{chem.current_quantity}</span>
                          <span className="text-muted-foreground">
                            {chem.unit || "units"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          {chem.hazard_type_id ? (
                            <Badge className="bg-warning/10 text-warning border-warning/20">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {getHazardTypeName(chem.hazard_type_id) ||
                                "Hazardous"}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {(chem.cas_number || chem.name) && (
                            <InlineHazardInfo
                              chemicalName={chem.name}
                              casNumber={chem.cas_number}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {chem.storage_conditions ? (
                          <span className="text-xs max-w-[150px] truncate block">
                            {chem.storage_conditions}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Standard
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {chem.is_expired ? (
                          <Badge className="bg-destructive/10 text-destructive">
                            Expired
                          </Badge>
                        ) : chem.is_active ? (
                          <Badge className="bg-success/10 text-success">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() =>
                            setSdsChemical({
                              name: chem.name,
                              cas: chem.cas_number,
                            })
                          }
                        >
                          <Shield className="h-3 w-3" />
                          View SDS
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(chem)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(chem.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              {editingChemical ? "Edit Chemical" : "Add Chemical"}
            </DialogTitle>
            <DialogDescription>
              {editingChemical
                ? "Update chemical details"
                : "Add a new chemical to the inventory"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Chemical Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Sodium Chloride"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="formula">Formula</Label>
                <Input
                  id="formula"
                  value={formData.formula}
                  onChange={(e) =>
                    setFormData({ ...formData, formula: e.target.value })
                  }
                  placeholder="e.g., NaCl"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cas_number">CAS Number</Label>
                <Input
                  id="cas_number"
                  value={formData.cas_number}
                  onChange={(e) =>
                    setFormData({ ...formData, cas_number: e.target.value })
                  }
                  placeholder="e.g., 7647-14-5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hazard_type">Hazard Type</Label>
                <Select
                  value={formData.hazard_type_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, hazard_type_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select hazard type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {hazardTypes.map((ht) => (
                      <SelectItem key={ht.id} value={ht.id}>
                        <span className="flex items-center gap-2">
                          <AlertTriangle
                            className="h-3 w-3"
                            style={{ color: ht.color_hex }}
                          />
                          {ht.name} ({ht.code})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter chemical description..."
                className="min-h-[80px]"
              />
            </div>

            {/* Quantity Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="current_quantity">Current Quantity</Label>
                <Input
                  id="current_quantity"
                  type="number"
                  min={0}
                  step="0.001"
                  value={formData.current_quantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      current_quantity: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) =>
                    setFormData({ ...formData, unit: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ml">ml (milliliters)</SelectItem>
                    <SelectItem value="L">L (liters)</SelectItem>
                    <SelectItem value="g">g (grams)</SelectItem>
                    <SelectItem value="kg">kg (kilograms)</SelectItem>
                    <SelectItem value="mg">mg (milligrams)</SelectItem>
                    <SelectItem value="units">units</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimum_quantity">Minimum Quantity</Label>
                <Input
                  id="minimum_quantity"
                  type="number"
                  min={0}
                  step="0.001"
                  value={formData.minimum_quantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minimum_quantity: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            {/* Storage Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="storage_location">Storage Location</Label>
                <Input
                  id="storage_location"
                  value={formData.storage_location}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      storage_location: e.target.value,
                    })
                  }
                  placeholder="e.g., Cabinet A, Shelf 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry_date">Expiry Date</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) =>
                    setFormData({ ...formData, expiry_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storage_conditions">Storage Conditions</Label>
              <Textarea
                id="storage_conditions"
                value={formData.storage_conditions}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    storage_conditions: e.target.value,
                  })
                }
                placeholder="e.g., Store in cool, dry place away from direct sunlight"
                className="min-h-[60px]"
              />
            </div>

            {/* Supplier Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_name">Supplier Name</Label>
                <Input
                  id="supplier_name"
                  value={formData.supplier_name}
                  onChange={(e) =>
                    setFormData({ ...formData, supplier_name: e.target.value })
                  }
                  placeholder="e.g., Fisher Scientific"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier_contact">Supplier Contact</Label>
                <Input
                  id="supplier_contact"
                  value={formData.supplier_contact}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      supplier_contact: e.target.value,
                    })
                  }
                  placeholder="e.g., contact@supplier.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch_number">Batch Number</Label>
                <Input
                  id="batch_number"
                  value={formData.batch_number}
                  onChange={(e) =>
                    setFormData({ ...formData, batch_number: e.target.value })
                  }
                  placeholder="e.g., LOT-2024-001"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingChemical ? "Updating..." : "Creating..."}
                </>
              ) : editingChemical ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SDS Viewer Dialog */}
      {sdsChemical && (
        <SDSViewer
          chemicalName={sdsChemical.name}
          casNumber={sdsChemical.cas}
          open={!!sdsChemical}
          onOpenChange={(open) => {
            if (!open) setSdsChemical(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
