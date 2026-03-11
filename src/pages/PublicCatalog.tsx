import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Package,
  Grid3X3,
  List,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  LogIn,
  HandHeart,
  Shield,
  Eye,
  X,
  Sparkles,
} from "lucide-react";

/* ---------- types ---------- */
interface CatalogItem {
  id: string;
  name: string;
  item_code: string;
  description: string | null;
  category_id: string | null;
  department_id: string | null;
  current_quantity: number;
  status: string;
  condition: string;
  is_borrowable: boolean;
  image_url: string | null;
  item_type: string | null;
  safety_level: string | null;
  brand: string | null;
  model_number: string | null;
  category?: { name: string } | null;
  department?: { name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

const ITEMS_PER_PAGE = 24;

type SortOption = "name_asc" | "name_desc" | "newest" | "qty_desc" | "qty_asc";

const SORT_LABELS: Record<SortOption, string> = {
  name_asc: "Name A → Z",
  name_desc: "Name Z → A",
  newest: "Newest First",
  qty_desc: "Quantity: High to Low",
  qty_asc: "Quantity: Low to High",
};

const CONDITION_OPTIONS = ["excellent", "good", "fair", "poor"];
const STATUS_OPTIONS = ["available", "borrowed", "under_maintenance"];

/* ---------- helpers ---------- */
const conditionColor = (c: string) => {
  const map: Record<string, string> = {
    excellent:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
    good: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
    fair: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
    poor: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  };
  return map[c] || "bg-gray-100 text-gray-600";
};

const statusStyle = (s: string) => {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    available: { bg: "bg-emerald-500", text: "text-white", label: "Available" },
    borrowed: { bg: "bg-blue-500", text: "text-white", label: "Borrowed" },
    under_maintenance: {
      bg: "bg-amber-500",
      text: "text-white",
      label: "Maintenance",
    },
  };
  return map[s] || { bg: "bg-gray-500", text: "text-white", label: s };
};

const safetyColor = (l: string | null) => {
  if (!l) return null;
  const map: Record<string, string> = {
    low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    medium:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    hazardous: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return map[l] || null;
};

/* ============================================================= */

export default function PublicCatalog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Data state
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [catFilter, setCatFilter] = useState(searchParams.get("cat") || "all");
  const [deptFilter, setDeptFilter] = useState(
    searchParams.get("dept") || "all",
  );
  const [statusFilter, setStatusFilter] = useState<string[]>(
    searchParams.get("status")?.split(",").filter(Boolean) || [],
  );
  const [conditionFilter, setConditionFilter] = useState<string[]>(
    searchParams.get("condition")?.split(",").filter(Boolean) || [],
  );
  const [borrowableOnly, setBorrowableOnly] = useState(
    searchParams.get("borrow") === "1",
  );
  const [sort, setSort] = useState<SortOption>(
    (searchParams.get("sort") as SortOption) || "name_asc",
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  /* --- fetch data --- */
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      const [itemsRes, catsRes, deptsRes] = await Promise.all([
        supabase
          .from("items")
          .select(`*, category:categories(name), department:departments(name)`)
          .neq("status", "archived")
          .order("name"),
        supabase.from("categories").select("id, name").order("name"),
        supabase.from("departments").select("id, name").order("name"),
      ]);
      setItems((itemsRes.data || []) as unknown as CatalogItem[]);
      setCategories((catsRes.data || []) as Category[]);
      setDepartments((deptsRes.data || []) as Department[]);
      setIsLoading(false);
    };
    fetchAll();
  }, []);

  /* --- sync filters to URL --- */
  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (catFilter !== "all") p.set("cat", catFilter);
    if (deptFilter !== "all") p.set("dept", deptFilter);
    if (statusFilter.length) p.set("status", statusFilter.join(","));
    if (conditionFilter.length) p.set("condition", conditionFilter.join(","));
    if (borrowableOnly) p.set("borrow", "1");
    if (sort !== "name_asc") p.set("sort", sort);
    setSearchParams(p, { replace: true });
  }, [
    search,
    catFilter,
    deptFilter,
    statusFilter,
    conditionFilter,
    borrowableOnly,
    sort,
  ]);

  /* --- filter + sort + paginate --- */
  const filtered = useMemo(() => {
    let result = items.filter((item) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.item_code.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        (item.brand || "").toLowerCase().includes(q);
      const matchCat = catFilter === "all" || item.category_id === catFilter;
      const matchDept =
        deptFilter === "all" || item.department_id === deptFilter;
      const matchStatus =
        statusFilter.length === 0 || statusFilter.includes(item.status);
      const matchCondition =
        conditionFilter.length === 0 ||
        conditionFilter.includes(item.condition);
      const matchBorrow = !borrowableOnly || item.is_borrowable;
      return (
        matchSearch &&
        matchCat &&
        matchDept &&
        matchStatus &&
        matchCondition &&
        matchBorrow
      );
    });

    // Sort
    result.sort((a, b) => {
      switch (sort) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "newest":
          return b.item_code.localeCompare(a.item_code);
        case "qty_desc":
          return b.current_quantity - a.current_quantity;
        case "qty_asc":
          return a.current_quantity - b.current_quantity;
        default:
          return 0;
      }
    });

    return result;
  }, [
    items,
    search,
    catFilter,
    deptFilter,
    statusFilter,
    conditionFilter,
    borrowableOnly,
    sort,
  ]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setPage(1);
  }, [
    search,
    catFilter,
    deptFilter,
    statusFilter,
    conditionFilter,
    borrowableOnly,
    sort,
  ]);

  const activeFilterCount =
    (catFilter !== "all" ? 1 : 0) +
    (deptFilter !== "all" ? 1 : 0) +
    statusFilter.length +
    conditionFilter.length +
    (borrowableOnly ? 1 : 0);

  const clearFilters = () => {
    setCatFilter("all");
    setDeptFilter("all");
    setStatusFilter([]);
    setConditionFilter([]);
    setBorrowableOnly(false);
    setSort("name_asc");
  };

  const toggleArrayFilter = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  /* --- Filter Panel (shared between desktop sidebar & mobile sheet) --- */
  const FilterPanel = () => (
    <div className="space-y-6">
      {/* Category */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">Category</h4>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Department */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">
          Department
        </h4>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">Status</h4>
        <div className="space-y-2">
          {STATUS_OPTIONS.map((s) => (
            <label
              key={s}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <Checkbox
                checked={statusFilter.includes(s)}
                onCheckedChange={() =>
                  setStatusFilter(toggleArrayFilter(statusFilter, s))
                }
              />
              <span className="text-sm capitalize group-hover:text-foreground transition-colors">
                {s.replace(/_/g, " ")}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Condition */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">
          Condition
        </h4>
        <div className="space-y-2">
          {CONDITION_OPTIONS.map((c) => (
            <label
              key={c}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <Checkbox
                checked={conditionFilter.includes(c)}
                onCheckedChange={() =>
                  setConditionFilter(toggleArrayFilter(conditionFilter, c))
                }
              />
              <span className="text-sm capitalize group-hover:text-foreground transition-colors">
                {c}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Borrowable */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            checked={borrowableOnly}
            onCheckedChange={(v) => setBorrowableOnly(v === true)}
          />
          <span className="text-sm font-medium group-hover:text-foreground transition-colors">
            <HandHeart className="inline h-4 w-4 mr-1 text-blue-500" />
            Borrowable Only
          </span>
        </label>
      </div>

      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={clearFilters}
        >
          <X className="h-4 w-4 mr-1" /> Clear All Filters
        </Button>
      )}
    </div>
  );

  /* ============================================================= */
  return (
    <div className="min-h-screen bg-background">
      {/* ---- Sticky Header ---- */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto flex items-center gap-4 h-16 px-4 lg:px-6">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 flex-shrink-0 group"
          >
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 rounded-lg opacity-75 group-hover:opacity-100 blur-sm transition-opacity" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden bg-white">
                <img
                  src="/lablink-logo.jpg"
                  alt="LabLink"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent leading-tight">
                LabLink
              </span>
              <span className="text-[9px] text-blue-500 -mt-0.5 tracking-wider font-medium">
                CATALOG
              </span>
            </div>
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search equipment, chemicals, tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 bg-muted/50 border-border/50 focus:bg-background transition-colors rounded-xl"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                title="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {user ? (
              <Link to="/dashboard">
                <Button variant="default" size="sm" className="gap-2">
                  <Package className="h-4 w-4" /> Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 hidden sm:flex"
                  >
                    <LogIn className="h-4 w-4" /> Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="default" size="sm" className="gap-1.5">
                    <Sparkles className="h-4 w-4" /> Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---- Main Content ---- */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
        <div className="flex gap-6">
          {/* ---- Desktop Sidebar Filters ---- */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-primary" /> Filters
                </h3>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </div>
              <div className="p-4 rounded-2xl border border-border/50 bg-card shadow-sm">
                <FilterPanel />
              </div>
            </div>
          </aside>

          {/* ---- Products Area ---- */}
          <main className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                {/* Mobile filter button */}
                <Sheet
                  open={mobileFiltersOpen}
                  onOpenChange={setMobileFiltersOpen}
                >
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="lg:hidden gap-2"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="text-xs ml-1">
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <SlidersHorizontal className="h-5 w-5" /> Filters
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <FilterPanel />
                    </div>
                  </SheetContent>
                </Sheet>

                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {filtered.length}
                  </span>{" "}
                  items found
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Sort */}
                <Select
                  value={sort}
                  onValueChange={(v) => setSort(v as SortOption)}
                >
                  <SelectTrigger className="w-[180px] h-9">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SORT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* View mode */}
                <div className="hidden sm:flex border rounded-lg">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {catFilter !== "all" && (
                  <Badge
                    variant="secondary"
                    className="gap-1 cursor-pointer"
                    onClick={() => setCatFilter("all")}
                  >
                    {categories.find((c) => c.id === catFilter)?.name}{" "}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {deptFilter !== "all" && (
                  <Badge
                    variant="secondary"
                    className="gap-1 cursor-pointer"
                    onClick={() => setDeptFilter("all")}
                  >
                    {departments.find((d) => d.id === deptFilter)?.name}{" "}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {statusFilter.map((s) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="gap-1 cursor-pointer capitalize"
                    onClick={() =>
                      setStatusFilter(statusFilter.filter((v) => v !== s))
                    }
                  >
                    {s.replace(/_/g, " ")} <X className="h-3 w-3" />
                  </Badge>
                ))}
                {conditionFilter.map((c) => (
                  <Badge
                    key={c}
                    variant="secondary"
                    className="gap-1 cursor-pointer capitalize"
                    onClick={() =>
                      setConditionFilter(conditionFilter.filter((v) => v !== c))
                    }
                  >
                    {c} <X className="h-3 w-3" />
                  </Badge>
                ))}
                {borrowableOnly && (
                  <Badge
                    variant="secondary"
                    className="gap-1 cursor-pointer"
                    onClick={() => setBorrowableOnly(false)}
                  >
                    Borrowable <X className="h-3 w-3" />
                  </Badge>
                )}
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={clearFilters}
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Items Grid / List */}
            {isLoading ? (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
                    : "space-y-3"
                }
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className={
                      viewMode === "grid"
                        ? "h-72 rounded-2xl"
                        : "h-24 rounded-xl"
                    }
                  />
                ))}
              </div>
            ) : paged.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Package className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No items found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Try adjusting your search or filters
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {paged.map((item) => {
                  const ss = statusStyle(item.status);
                  return (
                    <Card
                      key={item.id}
                      className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/30 overflow-hidden rounded-2xl"
                      onClick={() => navigate(`/catalog/${item.id}`)}
                    >
                      {/* Image */}
                      <div className="aspect-square bg-gradient-to-br from-muted/50 to-muted relative overflow-hidden">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FlaskConical className="h-12 w-12 text-muted-foreground/20" />
                          </div>
                        )}
                        {/* Status badge */}
                        <div className="absolute top-2.5 right-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${ss.bg} ${ss.text}`}
                          >
                            {ss.label}
                          </span>
                        </div>
                        {/* Borrowable tag */}
                        {item.is_borrowable && (
                          <div className="absolute top-2.5 left-2.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500 text-white">
                              <HandHeart className="h-3 w-3" /> Borrow
                            </span>
                          </div>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full p-3 shadow-lg">
                              <Eye className="h-5 w-5 text-foreground" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <CardContent className="p-3 sm:p-4 space-y-2">
                        <div>
                          <h3 className="font-semibold text-sm sm:text-base truncate group-hover:text-primary transition-colors">
                            {item.name}
                          </h3>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {item.item_code}
                          </p>
                        </div>

                        {item.brand && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.brand}{" "}
                            {item.model_number && `• ${item.model_number}`}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={`text-[10px] border ${conditionColor(item.condition)}`}
                          >
                            {item.condition}
                          </Badge>
                          <span className="text-xs font-medium text-muted-foreground">
                            Qty:{" "}
                            <span className="text-foreground font-semibold">
                              {item.current_quantity}
                            </span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          {item.category?.name && (
                            <span className="text-[11px] text-muted-foreground truncate">
                              {item.category.name}
                            </span>
                          )}
                          {item.safety_level &&
                            safetyColor(item.safety_level) && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${safetyColor(item.safety_level)}`}
                              >
                                <Shield className="h-3 w-3 mr-0.5" />{" "}
                                {item.safety_level}
                              </Badge>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* ---- List View ---- */
              <div className="space-y-2">
                {paged.map((item) => {
                  const ss = statusStyle(item.status);
                  return (
                    <Card
                      key={item.id}
                      className="hover:shadow-md transition-all cursor-pointer border-border/50 hover:border-primary/30 rounded-xl"
                      onClick={() => navigate(`/catalog/${item.id}`)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FlaskConical className="h-8 w-8 text-muted-foreground/20" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">
                              {item.name}
                            </h3>
                            <p className="text-xs text-muted-foreground font-mono">
                              {item.item_code}
                            </p>
                            <div className="flex items-center flex-wrap gap-2 mt-1.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${ss.bg} ${ss.text}`}
                              >
                                {ss.label}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${conditionColor(item.condition)}`}
                              >
                                {item.condition}
                              </Badge>
                              {item.category?.name && (
                                <span className="text-xs text-muted-foreground">
                                  {item.category.name}
                                </span>
                              )}
                              {item.is_borrowable && (
                                <Badge className="text-[10px] bg-blue-500 text-white border-0 gap-1">
                                  <HandHeart className="h-3 w-3" /> Borrowable
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 hidden sm:block">
                            <p className="text-sm font-semibold">
                              Qty: {item.current_quantity}
                            </p>
                            {item.department?.name && (
                              <p className="text-xs text-muted-foreground">
                                {item.department.name}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0"
                            title="View item details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="h-9 w-9"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 7) {
                      p = i + 1;
                    } else if (page <= 4) {
                      p = i + 1;
                    } else if (page >= totalPages - 3) {
                      p = totalPages - 6 + i;
                    } else {
                      p = page - 3 + i;
                    }
                    return (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "ghost"}
                        size="icon"
                        className="h-9 w-9 text-sm"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="h-9 w-9"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/30 mt-12">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden bg-white">
                <img
                  src="/lablink-logo.jpg"
                  alt="LabLink"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="font-display text-sm font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                LabLink
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              © 2025 LabLink. A{" "}
              <span className="text-blue-500 font-medium">
                LabLink Solution
              </span>{" "}
              by{" "}
              <span className="font-medium bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                Alphax Heros
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
