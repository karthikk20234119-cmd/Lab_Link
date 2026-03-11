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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tags, Plus, Edit, Trash2, Search, Palette } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string | null;
  color_hex: string;
  icon_name: string | null;
  low_stock_threshold: number;
  created_at: string;
}

export default function Categories() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color_hex: "#0891B2",
    low_stock_threshold: 5,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch categories",
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
        description: "Category name is required",
      });
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update({
            name: formData.name,
            description: formData.description || null,
            color_hex: formData.color_hex,
            low_stock_threshold: formData.low_stock_threshold,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;
        toast({ title: "Success", description: "Category updated successfully" });
      } else {
        const { error } = await supabase.from("categories").insert({
          name: formData.name,
          description: formData.description || null,
          color_hex: formData.color_hex,
          low_stock_threshold: formData.low_stock_threshold,
        });

        if (error) throw error;
        toast({ title: "Success", description: "Category created successfully" });
      }

      setDialogOpen(false);
      resetForm();
      fetchCategories();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Operation failed",
      });
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({ name: "", description: "", color_hex: "#0891B2", low_stock_threshold: 5 });
  };

  const handleEdit = (cat: Category) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      description: cat.description || "",
      color_hex: cat.color_hex || "#0891B2",
      low_stock_threshold: cat.low_stock_threshold || 5,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Category deleted successfully" });
      fetchCategories();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete category",
      });
    }
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout title="Categories" subtitle="Manage inventory categories">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            [1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))
          ) : filteredCategories.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Tags className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No categories found</p>
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <Card key={cat.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: cat.color_hex + "20" }}
                      >
                        <Tags className="h-5 w-5" style={{ color: cat.color_hex }} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{cat.name}</CardTitle>
                        {cat.description && (
                          <CardDescription className="text-xs line-clamp-1">
                            {cat.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(cat)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(cat.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: cat.color_hex }}
                      />
                      <span className="text-xs text-muted-foreground font-mono">
                        {cat.color_hex}
                      </span>
                    </div>
                    <Badge variant="outline">
                      Low: {cat.low_stock_threshold}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update category details" : "Create a new category"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Electronics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Electronic components and devices"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color_hex}
                    onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={formData.color_hex}
                    onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
                    placeholder="#0891B2"
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold">Low Stock Threshold</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={0}
                  value={formData.low_stock_threshold}
                  onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editingCategory ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
