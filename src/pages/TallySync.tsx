import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  Package,
  Users,
  MapPin,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ArrowUpDown,
  AlertCircle,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import {
  syncStockItems,
  syncLedgers,
  syncGodowns,
  syncCostCenters,
  syncBatchItems,
  getSyncStats,
  getSyncLogs,
  getSyncMappings,
  getTallyConfig,
  type TallyConfig,
} from "@/services/tallyService";
import { format } from "date-fns";

export default function TallySync() {
  const [config, setConfig] = useState<TallyConfig | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfgData, statsData, logsData, mappingsData] = await Promise.all([
        getTallyConfig(),
        getSyncStats(),
        getSyncLogs(),
        getSyncMappings(),
      ]);
      setConfig(cfgData);
      setStats(statsData);
      setLogs(logsData);
      setMappings(mappingsData);
    } catch (err) {
      console.error("Error loading sync data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (type: string) => {
    if (!config) {
      toast.error("Please configure Tally connection in Settings first");
      return;
    }
    if (!config.is_enabled) {
      toast.error("Tally integration is disabled. Enable it in Settings.");
      return;
    }

    setSyncing(type);
    try {
      let results;
      switch (type) {
        case "stock_items":
          results = await syncStockItems(config);
          break;
        case "ledgers":
          results = await syncLedgers(config);
          break;
        case "godowns":
          results = await syncGodowns(config);
          break;
        case "cost_centers":
          results = await syncCostCenters(config);
          break;
        case "batch_items":
          results = await syncBatchItems(config);
          break;
      }

      if (results) {
        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;
        if (failCount === 0) {
          toast.success(`All ${successCount} items synced successfully!`);
        } else {
          toast.warning(
            `${successCount} synced, ${failCount} failed. Check logs for details.`,
          );
        }
      }

      // Reload data
      await loadData();
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncAll = async () => {
    for (const type of [
      "stock_items",
      "ledgers",
      "godowns",
      "cost_centers",
      "batch_items",
    ]) {
      await handleSync(type);
    }
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case "synced":
      case "success":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" /> Synced
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
            <XCircle className="h-3 w-3 mr-1" /> Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" /> Pending
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const syncCategories = [
    {
      key: "stock_items",
      label: "Stock Items",
      icon: Package,
      description: "Chemicals & Equipment",
      color: "from-blue-500 to-blue-600",
    },
    {
      key: "ledgers",
      label: "Vendor Ledgers",
      icon: Users,
      description: "Suppliers & Creditors",
      color: "from-purple-500 to-purple-600",
    },
    {
      key: "godowns",
      label: "Godowns",
      icon: MapPin,
      description: "Lab Locations",
      color: "from-emerald-500 to-emerald-600",
    },
    {
      key: "cost_centers",
      label: "Cost Centers",
      icon: Building2,
      description: "Departments",
      color: "from-orange-500 to-orange-600",
    },
    {
      key: "batch_items",
      label: "Batch & Expiry",
      icon: FlaskConical,
      description: "Chemical batches with mfg/expiry dates",
      color: "from-pink-500 to-rose-600",
    },
  ];

  if (loading) {
    return (
      <DashboardLayout title="Tally Sync" subtitle="Loading sync data...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!config || !config.is_enabled) {
    return (
      <DashboardLayout
        title="Tally Sync"
        subtitle="Sync master data with TallyPrime"
      >
        <Card className="max-w-lg mx-auto mt-12">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Tally Integration Not Configured
            </h3>
            <p className="text-muted-foreground mb-4">
              Please configure and enable TallyPrime connection in Settings
              before syncing data.
            </p>
            <Button onClick={() => (window.location.href = "/settings")}>
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Tally Sync"
      subtitle="Sync master data with TallyPrime"
    >
      <div className="space-y-6">
        {/* Sync All Button */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">
              Connected to{" "}
              <strong>{config.company_name || "TallyPrime"}</strong> at{" "}
              {config.host}:{config.port}
            </p>
          </div>
          <Button
            onClick={handleSyncAll}
            disabled={syncing !== null}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync All to Tally
          </Button>
        </div>

        {/* Sync Category Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {syncCategories.map((cat) => {
            const catStats = stats?.[cat.key] || {
              total: 0,
              synced: 0,
              failed: 0,
              pending: 0,
            };
            return (
              <Card key={cat.key} className="overflow-hidden">
                <div className={`h-1.5 bg-gradient-to-r ${cat.color}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <cat.icon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-sm font-medium">
                        {cat.label}
                      </CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    {cat.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-green-600">
                        {catStats.synced}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Synced
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-yellow-600">
                        {catStats.pending}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Pending
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-600">
                        {catStats.failed}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Failed
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleSync(cat.key)}
                    disabled={syncing !== null}
                  >
                    {syncing === cat.key ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Sync Now
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs: Mappings & Logs */}
        <Tabs defaultValue="mappings" className="w-full">
          <TabsList>
            <TabsTrigger value="mappings">
              <ArrowUpDown className="h-4 w-4 mr-1" />
              Mappings ({mappings.length})
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Clock className="h-4 w-4 mr-1" />
              Sync Logs ({logs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mappings">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>LabLink Name</TableHead>
                        <TableHead>Tally Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Synced</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappings.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No mappings yet. Run a sync to create mappings.
                          </TableCell>
                        </TableRow>
                      ) : (
                        mappings.map((m: any) => (
                          <TableRow key={m.id}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {m.entity_type?.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {m.lablink_name}
                            </TableCell>
                            <TableCell>{m.tally_name}</TableCell>
                            <TableCell>
                              {getSyncStatusBadge(m.sync_status)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {m.last_synced_at
                                ? format(
                                    new Date(m.last_synced_at),
                                    "dd MMM yyyy HH:mm",
                                  )
                                : "Never"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Operation</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No sync logs yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {log.created_at
                                ? format(
                                    new Date(log.created_at),
                                    "dd MMM HH:mm",
                                  )
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {log.operation?.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {log.entity_name || "—"}
                            </TableCell>
                            <TableCell>
                              {getSyncStatusBadge(log.status)}
                            </TableCell>
                            <TableCell className="text-sm text-red-600 max-w-[200px] truncate">
                              {log.error_message || "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
