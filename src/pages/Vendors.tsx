import { useState, useEffect } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Search,
  Loader2,
  Store,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

interface Vendor {
  id: string;
  name: string;
  tally_ledger_name: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  payment_terms: string | null;
  credit_limit: number | null;
  is_active: boolean;
  created_at: string;
}

const emptyVendor: Partial<Vendor> = {
  name: "",
  tally_ledger_name: "",
  gstin: "",
  pan: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  contact_person: "",
  phone: "",
  email: "",
  payment_terms: "",
  credit_limit: 0,
  is_active: true,
};

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] =
    useState<Partial<Vendor>>(emptyVendor);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendors" as any)
      .select("*")
      .order("name");

    if (!error && data) {
      setVendors(data as any as Vendor[]);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!editingVendor.name?.trim()) {
      toast.error("Vendor name is required");
      return;
    }

    setSaving(true);
    try {
      if (editingVendor.id) {
        // Update
        const { error } = await supabase
          .from("vendors" as any)
          .update({
            name: editingVendor.name,
            tally_ledger_name:
              editingVendor.tally_ledger_name || editingVendor.name,
            gstin: editingVendor.gstin,
            pan: editingVendor.pan,
            address: editingVendor.address,
            city: editingVendor.city,
            state: editingVendor.state,
            pincode: editingVendor.pincode,
            contact_person: editingVendor.contact_person,
            phone: editingVendor.phone,
            email: editingVendor.email,
            payment_terms: editingVendor.payment_terms,
            credit_limit: editingVendor.credit_limit,
            is_active: editingVendor.is_active,
          })
          .eq("id", editingVendor.id);

        if (error) throw error;
        toast.success("Vendor updated successfully");
      } else {
        // Create
        const { error } = await supabase.from("vendors" as any).insert({
          name: editingVendor.name,
          tally_ledger_name:
            editingVendor.tally_ledger_name || editingVendor.name,
          gstin: editingVendor.gstin,
          pan: editingVendor.pan,
          address: editingVendor.address,
          city: editingVendor.city,
          state: editingVendor.state,
          pincode: editingVendor.pincode,
          contact_person: editingVendor.contact_person,
          phone: editingVendor.phone,
          email: editingVendor.email,
          payment_terms: editingVendor.payment_terms,
          credit_limit: editingVendor.credit_limit,
          is_active: editingVendor.is_active ?? true,
        });

        if (error) throw error;
        toast.success("Vendor created successfully");
      }

      setDialogOpen(false);
      setEditingVendor(emptyVendor);
      fetchVendors();
    } catch (err: any) {
      toast.error(err.message || "Failed to save vendor");
    } finally {
      setSaving(false);
    }
  };

  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.gstin?.toLowerCase().includes(search.toLowerCase()) ||
      v.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
      v.city?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DashboardLayout
      title="Vendors"
      subtitle="Manage suppliers and Tally ledger mappings"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setEditingVendor(emptyVendor)}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingVendor.id ? "Edit Vendor" : "Add New Vendor"}
                </DialogTitle>
                <DialogDescription>
                  Vendor details will be synced to TallyPrime as a Sundry
                  Creditor ledger.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label>Vendor Name *</Label>
                  <Input
                    value={editingVendor.name || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        name: e.target.value,
                      })
                    }
                    placeholder="e.g. Sigma-Aldrich"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tally Ledger Name</Label>
                  <Input
                    value={editingVendor.tally_ledger_name || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        tally_ledger_name: e.target.value,
                      })
                    }
                    placeholder="Name in Tally (defaults to vendor name)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input
                    value={editingVendor.gstin || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        gstin: e.target.value,
                      })
                    }
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PAN</Label>
                  <Input
                    value={editingVendor.pan || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        pan: e.target.value,
                      })
                    }
                    placeholder="AAAAA0000A"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={editingVendor.address || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        address: e.target.value,
                      })
                    }
                    placeholder="Street address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={editingVendor.city || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        city: e.target.value,
                      })
                    }
                    placeholder="Mumbai"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={editingVendor.state || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        state: e.target.value,
                      })
                    }
                    placeholder="Maharashtra"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input
                    value={editingVendor.pincode || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        pincode: e.target.value,
                      })
                    }
                    placeholder="400001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Person</Label>
                  <Input
                    value={editingVendor.contact_person || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        contact_person: e.target.value,
                      })
                    }
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editingVendor.phone || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        phone: e.target.value,
                      })
                    }
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={editingVendor.email || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        email: e.target.value,
                      })
                    }
                    placeholder="vendor@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Input
                    value={editingVendor.payment_terms || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        payment_terms: e.target.value,
                      })
                    }
                    placeholder="Net 30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Credit Limit (₹)</Label>
                  <Input
                    type="number"
                    value={editingVendor.credit_limit || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        credit_limit: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="100000"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingVendor.id ? "Update" : "Create"} Vendor
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Vendors Table */}
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
                      <TableHead>Vendor</TableHead>
                      <TableHead>Tally Ledger</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Store className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-muted-foreground">
                            {search
                              ? "No vendors match your search"
                              : "No vendors added yet"}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredVendors.map((vendor) => (
                        <TableRow key={vendor.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{vendor.name}</p>
                              {vendor.contact_person && (
                                <p className="text-xs text-muted-foreground">
                                  {vendor.contact_person}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {vendor.tally_ledger_name || (
                              <span className="text-muted-foreground italic">
                                Same as name
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {vendor.gstin || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              {vendor.phone && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {vendor.phone}
                                </div>
                              )}
                              {vendor.email && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  {vendor.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {vendor.city && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {vendor.city}
                                {vendor.state && `, ${vendor.state}`}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                vendor.is_active ? "default" : "secondary"
                              }
                              className={
                                vendor.is_active
                                  ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                                  : ""
                              }
                            >
                              {vendor.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingVendor(vendor);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
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
      </div>
    </DashboardLayout>
  );
}
