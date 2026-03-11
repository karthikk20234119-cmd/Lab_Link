import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Wrench,
  Plus,
  Trash2,
  Loader2,
  Play,
  Zap,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ticket,
} from "lucide-react";

interface MaintenanceRule {
  id: string;
  name: string;
  description: string | null;
  condition_type: string;
  threshold_value: number;
  category_id: string | null;
  auto_create_ticket: boolean;
  priority: string;
  is_active: boolean;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
}

export function PredictiveMaintenanceRules() {
  const { toast } = useToast();
  const [rules, setRules] = useState<MaintenanceRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    condition_type: "borrow_count",
    threshold_value: 10,
    category_id: "",
    priority: "medium",
    auto_create_ticket: true,
  });
  const [lastRunResult, setLastRunResult] = useState<{
    flaggedCount: number;
    ticketsCreated: number;
    flaggedItems: string[];
    ranAt: Date;
  } | null>(null);

  const fetchRules = async () => {
    setIsLoading(true);
    const [rulesResult, catsResult] = await Promise.all([
      supabase
        .from("maintenance_rules")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("id, name"),
    ]);

    if (rulesResult.data) setRules((rulesResult.data as any[]) || []);
    if (catsResult.data) setCategories(catsResult.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const addRule = async () => {
    const { error } = await supabase.from("maintenance_rules").insert({
      name: form.name,
      description: form.description || null,
      condition_type: form.condition_type,
      threshold_value: form.threshold_value,
      category_id: form.category_id || null,
      priority: form.priority,
      auto_create_ticket: form.auto_create_ticket,
    } as any);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Rule Created",
        description: `"${form.name}" will auto-flag items for maintenance.`,
      });
      setShowAddDialog(false);
      setForm({
        name: "",
        description: "",
        condition_type: "borrow_count",
        threshold_value: 10,
        category_id: "",
        priority: "medium",
        auto_create_ticket: true,
      });
      fetchRules();
    }
  };

  const toggleRule = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("maintenance_rules")
      .update({ is_active: active } as any)
      .eq("id", id);

    if (!error) {
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_active: active } : r)),
      );
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this maintenance rule?")) return;
    const { error } = await supabase
      .from("maintenance_rules")
      .delete()
      .eq("id", id);
    if (!error) fetchRules();
  };

  const runPredictiveCheck = async () => {
    setIsRunning(true);
    try {
      const { error } = await supabase.rpc("check_predictive_maintenance");
      if (error) throw error;

      // Fetch recently flagged items (maintenance_schedule entries from last 60 seconds)
      const since = new Date(Date.now() - 60_000).toISOString();
      const { data: flagged } = await supabase
        .from("maintenance_schedule")
        .select("id, items(name)")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);

      const flaggedItems = (flagged || []).map(
        (f: any) => f.items?.name || "Unknown Item",
      );

      setLastRunResult({
        flaggedCount: flaggedItems.length,
        ticketsCreated: flaggedItems.length,
        flaggedItems,
        ranAt: new Date(),
      });

      toast({
        title: "Check Complete",
        description:
          flaggedItems.length > 0
            ? `${flaggedItems.length} item(s) flagged for maintenance.`
            : "No items need maintenance at this time.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
    setIsRunning(false);
  };

  const getConditionLabel = (type: string) => {
    switch (type) {
      case "borrow_count":
        return "Borrow Count ≥";
      case "days_since_maintenance":
        return "Days Since Maintenance ≥";
      case "age_days":
        return "Item Age (days) ≥";
      case "damage_reports":
        return "Damage Reports ≥";
      default:
        return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Predictive Maintenance Rules
            </CardTitle>
            <CardDescription>
              Auto-flag items for maintenance based on usage patterns
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={runPredictiveCheck}
              disabled={isRunning}
              className="gap-1"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run Check
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Add Rule
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No maintenance rules configured.</p>
            <p className="text-sm">
              Create rules to auto-flag items needing maintenance.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Auto-Ticket</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{rule.name}</p>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground">
                          {rule.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getConditionLabel(rule.condition_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">
                    {rule.threshold_value}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        rule.priority === "high"
                          ? "bg-red-500/10 text-red-500 border-red-500/20"
                          : rule.priority === "medium"
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      }
                    >
                      {rule.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {rule.auto_create_ticket ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        <Ticket className="h-3 w-3 mr-1" /> Auto
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Manual
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(v) => toggleRule(rule.id, v)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRule(rule.id)}
                      className="h-8 w-8 text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Last Run Results */}
        {lastRunResult && (
          <div className="mt-4 p-4 rounded-xl border bg-muted/30">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span className="font-semibold text-sm">Last Run Summary</span>
              <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lastRunResult.ranAt.toLocaleTimeString()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="text-2xl font-bold text-amber-500">
                  {lastRunResult.flaggedCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  Items Flagged
                </div>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-2xl font-bold text-blue-500">
                  {lastRunResult.ticketsCreated}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tickets Created
                </div>
              </div>
            </div>
            {lastRunResult.flaggedItems.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Flagged Items:
                </p>
                <div className="flex flex-wrap gap-1">
                  {lastRunResult.flaggedItems.map((name, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Add Rule Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Maintenance Rule</DialogTitle>
            <DialogDescription>
              Create a rule to auto-flag items for preventive maintenance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. High-usage equipment check"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Condition Type</Label>
                <Select
                  value={form.condition_type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, condition_type: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="borrow_count">Borrow Count ≥</SelectItem>
                    <SelectItem value="days_since_maintenance">
                      Days Since Maintenance ≥
                    </SelectItem>
                    <SelectItem value="age_days">Item Age (Days) ≥</SelectItem>
                    <SelectItem value="damage_reports">
                      Damage Reports ≥
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Threshold Value</Label>
                <Input
                  type="number"
                  value={form.threshold_value}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      threshold_value: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category (optional)</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category_id: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.auto_create_ticket}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, auto_create_ticket: v }))
                }
              />
              <Label>Auto-create maintenance tickets</Label>
            </div>
            <Button
              onClick={addRule}
              disabled={!form.name.trim()}
              className="w-full"
            >
              Create Rule
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
