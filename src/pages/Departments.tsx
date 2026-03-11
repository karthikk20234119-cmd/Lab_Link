import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, Edit, Trash2, Search, MapPin, Mail, Users } from "lucide-react";

interface Department {
  id: string;
  name: string;
  location_building: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
  _count?: { users: number };
}

export default function Departments() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    location_building: "",
    contact_email: "",
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch departments",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Department name is required",
      });
      return;
    }

    try {
      if (editingDepartment) {
        const { error } = await supabase
          .from("departments")
          .update({
            name: formData.name,
            location_building: formData.location_building || null,
            contact_email: formData.contact_email || null,
          })
          .eq("id", editingDepartment.id);

        if (error) throw error;
        toast({ title: "Success", description: "Department updated successfully" });
      } else {
        const { error } = await supabase.from("departments").insert({
          name: formData.name,
          location_building: formData.location_building || null,
          contact_email: formData.contact_email || null,
        });

        if (error) throw error;
        toast({ title: "Success", description: "Department created successfully" });
      }

      setDialogOpen(false);
      setEditingDepartment(null);
      setFormData({ name: "", location_building: "", contact_email: "" });
      fetchDepartments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Operation failed",
      });
    }
  };

  const handleEdit = (dept: Department) => {
    setEditingDepartment(dept);
    setFormData({
      name: dept.name,
      location_building: dept.location_building || "",
      contact_email: dept.contact_email || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this department?")) return;

    try {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Department deleted successfully" });
      fetchDepartments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete department",
      });
    }
  };

  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout title="Departments" subtitle="Manage organization departments">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => { setEditingDepartment(null); setFormData({ name: "", location_building: "", contact_email: "" }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Department
          </Button>
        </div>

        {/* Departments Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              All Departments
            </CardTitle>
            <CardDescription>
              {filteredDepartments.length} department{filteredDepartments.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredDepartments.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No departments found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDepartments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell>
                        {dept.location_building ? (
                          <span className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3.5 w-3.5" />
                            {dept.location_building}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {dept.contact_email ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Mail className="h-3.5 w-3.5" />
                            {dept.contact_email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={dept.is_active ? "default" : "secondary"}>
                          {dept.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(dept)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(dept.id)}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDepartment ? "Edit Department" : "Add Department"}</DialogTitle>
            <DialogDescription>
              {editingDepartment ? "Update department details" : "Create a new department"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Department Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Computer Science"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Building / Location</Label>
              <Input
                id="location"
                value={formData.location_building}
                onChange={(e) => setFormData({ ...formData, location_building: e.target.value })}
                placeholder="e.g., Main Building, Block A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Contact Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="e.g., cs@college.edu"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editingDepartment ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
