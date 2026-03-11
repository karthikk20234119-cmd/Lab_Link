import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchSafetyDataSheet, PubChemSafetyData } from "@/services/pubchemApi";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";

interface InlineHazardInfoProps {
  chemicalName: string;
  casNumber?: string | null;
}

/**
 * Compact inline hazard badge for chemical table rows.
 * Auto-fetches GHS signal word and pictograms from PubChem on mount,
 * then caches the result to avoid redundant API calls.
 */

// Module-level cache to persist between renders and avoid duplicate PubChem calls
const sdsCache = new Map<string, PubChemSafetyData | null>();

export function InlineHazardInfo({
  chemicalName,
  casNumber,
}: InlineHazardInfoProps) {
  const [data, setData] = useState<PubChemSafetyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const cacheKey = `${casNumber || ""}::${chemicalName}`;

  const fetchData = useCallback(async () => {
    // Check module cache first
    if (sdsCache.has(cacheKey)) {
      setData(sdsCache.get(cacheKey) || null);
      setHasFetched(true);
      return;
    }

    setIsLoading(true);
    try {
      const result = await fetchSafetyDataSheet(casNumber, chemicalName);
      sdsCache.set(cacheKey, result);
      setData(result);
    } catch {
      sdsCache.set(cacheKey, null);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [cacheKey, casNumber, chemicalName]);

  useEffect(() => {
    if (!hasFetched) {
      fetchData();
    }
  }, [hasFetched, fetchData]);

  if (isLoading) {
    return (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
    );
  }

  if (!data || !hasFetched) return null;

  const signalWord = data.signalWord;
  const isHighRisk = signalWord.toLowerCase() === "danger";
  const isModRisk = signalWord.toLowerCase() === "warning";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-help">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-5 gap-1 ${
                isHighRisk
                  ? "bg-red-500/10 text-red-600 border-red-300"
                  : isModRisk
                    ? "bg-amber-500/10 text-amber-600 border-amber-300"
                    : "bg-green-500/10 text-green-600 border-green-300"
              }`}
            >
              {isHighRisk ? (
                <ShieldAlert className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              {signalWord}
            </Badge>
            {data.pictograms.length > 0 && (
              <div className="flex -space-x-1">
                {data.pictograms.slice(0, 3).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt="GHS"
                    className="h-5 w-5 rounded-sm border border-red-200 bg-white"
                  />
                ))}
                {data.pictograms.length > 3 && (
                  <span className="text-[9px] text-muted-foreground ml-0.5">
                    +{data.pictograms.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[320px] p-3">
          <div className="space-y-2">
            <p className="font-semibold text-xs">GHS Hazard Summary</p>
            <p
              className={`text-xs font-medium ${
                isHighRisk
                  ? "text-red-600"
                  : isModRisk
                    ? "text-amber-600"
                    : "text-green-600"
              }`}
            >
              Signal Word: {signalWord}
            </p>
            {data.hazardStatements.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">
                  Top Hazard Statements:
                </p>
                <ul className="space-y-0.5">
                  {data.hazardStatements.slice(0, 3).map((stmt, i) => (
                    <li
                      key={i}
                      className="text-[10px] text-muted-foreground flex items-start gap-1"
                    >
                      <span className="text-red-400 mt-1 shrink-0">•</span>
                      <span>{stmt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.pictograms.length > 0 && (
              <div className="flex gap-1.5 pt-1">
                {data.pictograms.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt="GHS"
                    className="h-7 w-7 rounded border border-red-200 bg-white"
                  />
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
