import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Wifi, WifiOff, Loader2, CloudUpload } from "lucide-react";

/**
 * Compact offline status indicator for the dashboard header.
 * Shows: online/offline state, pending operation count, manual sync button.
 */
export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();

  // Don't show anything when online with no pending ops
  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            {!isOnline ? (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-500 border-amber-500/30 gap-1 text-xs h-7"
              >
                <WifiOff className="h-3 w-3" />
                Offline
                {pendingCount > 0 && (
                  <span className="ml-0.5 bg-amber-500/20 rounded-full px-1.5 text-[10px]">
                    {pendingCount}
                  </span>
                )}
              </Badge>
            ) : isSyncing ? (
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-500 border-blue-500/30 gap-1 text-xs h-7"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Syncing...
              </Badge>
            ) : pendingCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={syncNow}
                className="gap-1 h-7 text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
              >
                <CloudUpload className="h-3 w-3" />
                Sync {pendingCount}
              </Button>
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p className="font-medium flex items-center gap-1">
              {isOnline ? (
                <>
                  <Wifi className="h-3 w-3 text-emerald-500" /> Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-amber-500" /> Offline
                </>
              )}
            </p>
            {pendingCount > 0 && (
              <p className="text-muted-foreground">
                {pendingCount} operation{pendingCount > 1 ? "s" : ""} queued
              </p>
            )}
            {!isOnline && (
              <p className="text-muted-foreground">
                Operations will sync when back online
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
