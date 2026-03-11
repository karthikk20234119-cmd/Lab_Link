import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Package,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Eye,
  Edit,
  Trash2,
  QrCode,
  MoreHorizontal,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Loader2,
  Upload,
  CheckSquare,
  X,
} from "lucide-react";
import {
  generateItemDetailsPDF,
  generateItemDetailsExcel,
  ItemReportRow,
} from "@/lib/reportExports";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AnimatedCounter } from "@/components/dashboard/AnimatedCounter";
import { BulkImportWizard } from "@/components/bulk/BulkImportWizard";

interface Item {
  id: string;
  name: string;
  description: string;
  item_code: string;
  serial_number: string;
  status: string;
  current_quantity: number;
  reorder_threshold: number;
  condition: string;
  item_type: string;
  image_url: string;
  purchase_price: number;
  lab_location: string;
  category: { name: string; color_hex: string } | null;
  department: { name: string } | null;
}

interface Category {
  id: string;
  name: string;
  color_hex: string;
}

interface Department {
  id: string;
  name: string;
}

export default function ItemsPage() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchItems();
    fetchCategories();
    fetchDepartments();
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("items")
      .select(
        `
        *,
        category:categories(name, color_hex),
        department:departments(name)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      setItems(data || []);
    }
    setIsLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("id, name, color_hex");
    if (data) setCategories(data);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true);
    if (data) setDepartments(data);
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || item.category?.name === categoryFilter;
    const matchesDepartment =
      departmentFilter === "all" || item.department?.name === departmentFilter;
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    return (
      matchesSearch && matchesCategory && matchesDepartment && matchesStatus
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Stats
  const totalItems = items.length;
  const availableItems = items.filter((i) => i.status === "available").length;
  const borrowedItems = items.filter((i) => i.status === "borrowed").length;
  const lowStockItems = items.filter(
    (i) => i.current_quantity <= i.reorder_threshold,
  ).length;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      available: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      borrowed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      under_maintenance:
        "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      damaged: "bg-red-500/20 text-red-400 border-red-500/30",
      archived: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    };
    return (
      <Badge variant="outline" className={styles[status] || ""}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getConditionBadge = (condition: string) => {
    const styles: Record<string, string> = {
      new: "bg-emerald-500/20 text-emerald-400",
      excellent: "bg-green-500/20 text-green-400",
      good: "bg-blue-500/20 text-blue-400",
      fair: "bg-yellow-500/20 text-yellow-400",
      poor: "bg-orange-500/20 text-orange-400",
      damaged: "bg-red-500/20 text-red-400",
    };
    return (
      <Badge className={styles[condition] || "bg-gray-500/20"}>
        {condition}
      </Badge>
    );
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    const { error } = await supabase.from("items").delete().eq("id", itemId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({ title: "Item Deleted", description: "Item has been removed." });
      fetchItems();
    }
  };

  const handleExport = async (exportType: "pdf" | "excel") => {
    if (filteredItems.length === 0) {
      toast({
        variant: "destructive",
        title: "No data to export",
        description: "No items match your filters.",
      });
      return;
    }

    setIsExporting(true);
    try {
      const exportData: ItemReportRow[] = filteredItems.map((item) => ({
        itemCode: item.item_code || "",
        name: item.name,
        description: item.description || "",
        category: item.category?.name || "",
        department: item.department?.name || "",
        status: item.status,
        quantity: item.current_quantity,
        purchasePrice: item.purchase_price || 0,
        purchaseDate: "",
        location: item.lab_location || "",
        brand: "",
        model: "",
        serialNumber: item.serial_number || "",
        warrantyUntil: "",
        safetyLevel: "",
        addedBy: "",
        addedDate: "",
      }));

      const filters = {
        categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
        departmentId: departmentFilter !== "all" ? departmentFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      };

      if (exportType === "pdf") {
        generateItemDetailsPDF(exportData, filters);
      } else {
        generateItemDetailsExcel(exportData, filters);
      }

      toast({
        title: "Success",
        description: `Items exported as ${exportType.toUpperCase()} successfully.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Failed to export items. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout
      title="Inventory Items"
      subtitle="Manage all lab equipment and consumables"
      userRole={
        (userRole as "admin" | "staff" | "student" | "technician") || "admin"
      }
    >
      <div className="space-y-6">
        {/* Header with Add Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">All Items</h2>
              <p className="text-muted-foreground text-sm">
                {filteredItems.length} items found
              </p>
            </div>
          </div>

          {(userRole === "admin" || userRole === "staff") && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkImport(true)}
                className="gap-1 h-9 sm:h-10"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Bulk Import</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isExporting || filteredItems.length === 0}
                    className="h-9 sm:h-10"
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline ml-2">Export</span>
                    <ChevronDown className="h-4 w-4 ml-1 sm:ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("pdf")}>
                    <FileText className="h-4 w-4 mr-2" /> Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("excel")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Export as Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={() => navigate("/items/new")}
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/25 rounded-xl h-9 sm:h-10"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Add Item</span>
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 shadow-lg shadow-blue-500/20">
            <CardContent className="p-5">
              <div className="text-3xl font-bold text-white">
                <AnimatedCounter value={totalItems} />
              </div>
              <div className="text-blue-100 text-sm mt-1">Total Items</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 border-0 shadow-lg shadow-emerald-500/20">
            <CardContent className="p-5">
              <div className="text-3xl font-bold text-white">
                <AnimatedCounter value={availableItems} />
              </div>
              <div className="text-emerald-100 text-sm mt-1">Available</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-sky-600 to-sky-700 border-0 shadow-lg shadow-sky-500/20">
            <CardContent className="p-5">
              <div className="text-3xl font-bold text-white">
                <AnimatedCounter value={borrowedItems} />
              </div>
              <div className="text-sky-100 text-sm mt-1">Borrowed</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-600 to-amber-700 border-0 shadow-lg shadow-amber-500/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-200" />
                <div className="text-3xl font-bold text-white">
                  <AnimatedCounter value={lowStockItems} />
                </div>
              </div>
              <div className="text-amber-100 text-sm mt-1">Low Stock</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="floating-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, code, or serial..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-xl border-border/50 bg-muted/50 focus:bg-background h-11"
                  />
                </div>
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px] rounded-xl border-border/50 bg-muted/50 h-11">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
              >
                <SelectTrigger className="w-[160px] rounded-xl border-border/50 bg-muted/50 h-11">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] rounded-xl border-border/50 bg-muted/50 h-11">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="borrowed">Borrowed</SelectItem>
                  <SelectItem value="under_maintenance">Maintenance</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-1 border border-border/50 rounded-xl p-1 bg-muted/30">
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="rounded-lg"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="rounded-lg"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Action Toolbar */}
        {selectedIds.size > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {selectedIds.size} item{selectedIds.size > 1 ? "s" : ""}{" "}
                  selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="h-7 px-2"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBulkUpdating}
                      className="gap-1"
                    >
                      <Edit className="h-3.5 w-3.5" /> Set Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {[
                      "available",
                      "borrowed",
                      "under_maintenance",
                      "damaged",
                      "archived",
                    ].map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={async () => {
                          setIsBulkUpdating(true);
                          const ids = Array.from(selectedIds);
                          const { error } = await supabase
                            .from("items")
                            .update({ status: s as any })
                            .in("id", ids);
                          if (error) {
                            toast({
                              variant: "destructive",
                              title: "Error",
                              description: error.message,
                            });
                          } else {
                            toast({
                              title: "Updated",
                              description: `${ids.length} items set to ${s.replace("_", " ")}.`,
                            });
                            setSelectedIds(new Set());
                            fetchItems();
                          }
                          setIsBulkUpdating(false);
                        }}
                      >
                        {s.replace("_", " ")}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1"
                  disabled={isBulkUpdating}
                  onClick={async () => {
                    if (
                      !confirm(`Delete ${selectedIds.size} items permanently?`)
                    )
                      return;
                    setIsBulkUpdating(true);
                    const ids = Array.from(selectedIds);
                    const { error } = await supabase
                      .from("items")
                      .delete()
                      .in("id", ids);
                    if (error) {
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: error.message,
                      });
                    } else {
                      toast({
                        title: "Deleted",
                        description: `${ids.length} items removed.`,
                      });
                      setSelectedIds(new Set());
                      fetchItems();
                    }
                    setIsBulkUpdating(false);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table View */}
        {viewMode === "table" && (
          <Card className="floating-card overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-muted/50">
                    {(userRole === "admin" || userRole === "staff") && (
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={
                            paginatedItems.length > 0 &&
                            paginatedItems.every((i) => selectedIds.has(i.id))
                          }
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedIds);
                            paginatedItems.forEach((i) =>
                              checked ? newSet.add(i.id) : newSet.delete(i.id),
                            );
                            setSelectedIds(newSet);
                          }}
                        />
                      </TableHead>
                    )}
                    <TableHead className="font-semibold">Item</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">
                      Category
                    </TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold hidden sm:table-cell">
                      Qty
                    </TableHead>
                    <TableHead className="font-semibold hidden lg:table-cell">
                      Condition
                    </TableHead>
                    <TableHead className="font-semibold hidden lg:table-cell">
                      Location
                    </TableHead>
                    <TableHead className="font-semibold text-right w-[60px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground py-16"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <span>Loading items...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-16"
                      >
                        <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                        <p>No items found. Add your first item!</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((item) => (
                      <TableRow
                        key={item.id}
                        className={`border-border/30 hover:bg-muted/30 cursor-pointer ${selectedIds.has(item.id) ? "bg-primary/5" : ""}`}
                        onClick={() => navigate(`/items/${item.id}`)}
                      >
                        {(userRole === "admin" || userRole === "staff") && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={(checked) => {
                                const newSet = new Set(selectedIds);
                                checked
                                  ? newSet.add(item.id)
                                  : newSet.delete(item.id);
                                setSelectedIds(newSet);
                              }}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate max-w-[150px] sm:max-w-[200px]">
                                {item.name}
                              </div>
                              <div className="text-muted-foreground text-xs truncate">
                                {item.item_code || "No code"}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {item.category && (
                            <Badge
                              variant="outline"
                              style={{
                                backgroundColor: item.category.color_hex + "15",
                                color: item.category.color_hex,
                                borderColor: item.category.color_hex + "40",
                              }}
                              className="text-xs"
                            >
                              {item.category.name}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell
                          className={`hidden sm:table-cell ${item.current_quantity <= item.reorder_threshold ? "text-amber-500 font-semibold" : ""}`}
                        >
                          {item.current_quantity}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {getConditionBadge(item.condition || "good")}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                          {item.lab_location || "-"}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-lg h-8 w-8 sm:h-9 sm:w-9"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => navigate(`/items/${item.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  navigate(`/items/${item.id}/edit`)
                                }
                              >
                                <Edit className="h-4 w-4 mr-2" /> Edit Item
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <QrCode className="h-4 w-4 mr-2" /> Print QR
                                Code
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-500 focus:text-red-500"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete Item
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Grid View */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedItems.map((item) => (
              <Card
                key={item.id}
                className="floating-card overflow-hidden cursor-pointer group"
                onClick={() => navigate(`/items/${item.id}`)}
              >
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    {getStatusBadge(item.status)}
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground font-mono mb-1">
                    {item.item_code}
                  </div>
                  <div className="font-semibold mb-2 truncate group-hover:text-blue-600 transition-colors">
                    {item.name}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Qty: {item.current_quantity}
                    </span>
                    {item.category && (
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: item.category.color_hex + "15",
                          color: item.category.color_hex,
                        }}
                        className="text-xs"
                      >
                        {item.category.name}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredItems.length)} of{" "}
              {filteredItems.length} items
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 font-medium">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Import Wizard */}
      <BulkImportWizard
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        departmentId={
          departmentFilter !== "all"
            ? departments.find((d) => d.name === departmentFilter)?.id ||
              departments[0]?.id ||
              ""
            : departments[0]?.id || ""
        }
        onImportComplete={fetchItems}
      />
    </DashboardLayout>
  );
}
