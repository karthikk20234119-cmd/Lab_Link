import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, User, Calendar, DollarSign, FileText, Clock } from "lucide-react";

interface MaintenanceRecord {
  id: string;
  reason: string | null;
  status: string;
  start_date: string | null;
  estimated_completion: string | null;
  actual_completion: string | null;
  cost: number | null;
  repair_notes: string | null;
  parts_used: string | null;
  created_at: string;
  assigned_to: string | null;
  technician?: { full_name: string } | null;
}

interface MaintenanceLogCardProps {
  itemId: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  in_progress: { label: "In Progress", variant: "default" },
  on_hold: { label: "On Hold", variant: "outline" },
  completed: { label: "Completed", variant: "default" },
  scrapped: { label: "Scrapped", variant: "destructive" },
};

export function MaintenanceLogCard({ itemId }: MaintenanceLogCardProps) {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMaintenanceRecords();
  }, [itemId]);

  const fetchMaintenanceRecords = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("maintenance_records")
        .select(`
          *,
          technician:profiles!maintenance_records_assigned_to_fkey(full_name)
        `)
        .eq("item_id", itemId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("Error fetching maintenance records:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          Maintenance History
        </CardTitle>
        <CardDescription>
          {records.length} maintenance record{records.length !== 1 ? "s" : ""} found
        </CardDescription>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No maintenance records yet</p>
            <p className="text-sm mt-1">Records will appear here when maintenance is performed</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {records.map((record) => {
              const config = statusConfig[record.status] || statusConfig.pending;
              
              return (
                <div
                  key={record.id}
                  className="p-4 rounded-lg border bg-muted/30 space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-2">
                        {record.reason || "Maintenance"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Created {formatDate(record.created_at)}
                      </p>
                    </div>
                    <Badge variant={config.variant} className="shrink-0">
                      {config.label}
                    </Badge>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {record.technician && (
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{record.technician.full_name}</span>
                      </div>
                    )}
                    
                    {record.start_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Started: {formatDate(record.start_date)}</span>
                      </div>
                    )}
                    
                    {record.actual_completion ? (
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Completed: {formatDate(record.actual_completion)}</span>
                      </div>
                    ) : record.estimated_completion ? (
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>ETA: {formatDate(record.estimated_completion)}</span>
                      </div>
                    ) : null}
                    
                    {record.cost && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>₹{record.cost.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {record.repair_notes && (
                    <div className="pt-2 border-t">
                      <div className="flex items-start gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {record.repair_notes}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Parts Used */}
                  {record.parts_used && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Parts used:</span> {record.parts_used}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
