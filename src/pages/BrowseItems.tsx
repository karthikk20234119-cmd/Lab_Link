import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Package, FlaskConical, Grid3X3, List, Eye, QrCode } from "lucide-react";

interface Item {
  id: string;
  name: string;
  item_code: string;
  category_id: string | null;
  current_quantity: number;
  status: string;
  condition: string;
  is_borrowable: boolean;
  image_url: string | null;
  category?: { name: string };
  department?: { name: string };
}

interface Category {
  id: string;
  name: string;
}

export default function BrowseItems() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("items")
        .select(`
          *,
          category:categories(name),
          department:departments(name)
        `)
        .order("name");

      if (error) throw error;
      setItems((data || []) as unknown as Item[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch items",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from("categories").select("id, name").order("name");
      setCategories((data || []) as Category[]);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "excellent":
        return "bg-success/10 text-success border-success/20";
      case "good":
        return "bg-info/10 text-info border-info/20";
      case "fair":
        return "bg-warning/10 text-warning border-warning/20";
      case "poor":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <Badge className="bg-success">Available</Badge>;
      case "borrowed":
        return <Badge variant="secondary">Borrowed</Badge>;
      case "under_maintenance":
        return <Badge variant="outline" className="border-warning text-warning">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout title="Browse Items" subtitle="Explore available lab equipment and materials">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="flex-1 sm:w-[160px] sm:flex-none">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          {filteredItems.length} items found
        </div>

        {/* Items Display */}
        {isLoading ? (
          <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-4"}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className={viewMode === "grid" ? "h-64" : "h-24"} />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No items found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your search or filters
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredItems.map((item) => (
              <Card key={item.id} className="hover:shadow-lg transition-all cursor-pointer group" onClick={() => navigate(`/items/${item.id}`)}>
                <div className="aspect-square bg-muted relative overflow-hidden rounded-t-lg">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-10 w-10 sm:h-16 sm:w-16 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(item.status)}
                  </div>
                </div>
                <CardContent className="p-3 sm:p-4">
                  <h3 className="font-semibold truncate text-sm sm:text-base">{item.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono truncate">{item.item_code}</p>
                  <div className="flex items-center justify-between mt-2 sm:mt-3">
                    <Badge variant="outline" className={`${getConditionColor(item.condition)} text-xs`}>
                      {item.condition}
                    </Badge>
                    <span className="text-xs sm:text-sm font-medium">Qty: {item.current_quantity}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 gap-1">
                    {item.category?.name && (
                      <p className="text-xs text-muted-foreground truncate">{item.category.name}</p>
                    )}
                    {item.is_borrowable && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs border-blue-500 text-blue-600 whitespace-nowrap">Borrow</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-all cursor-pointer" onClick={() => navigate(`/items/${item.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-8 w-8 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{item.item_code}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={getConditionColor(item.condition)}>
                          {item.condition}
                        </Badge>
                        {item.category?.name && (
                          <span className="text-xs text-muted-foreground">{item.category.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-medium">Qty: {item.current_quantity}</p>
                      {item.is_borrowable && (
                        <Badge className="bg-success mt-1">Borrowable</Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
