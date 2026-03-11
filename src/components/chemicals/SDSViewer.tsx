import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { fetchSafetyDataSheet, PubChemSafetyData } from "@/services/pubchemApi";
import {
  Shield,
  ExternalLink,
  AlertTriangle,
  Loader2,
  FileText,
  Info,
  FlaskConical,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

interface SDSViewerProps {
  chemicalName: string;
  casNumber?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SDSViewer({
  chemicalName,
  casNumber,
  open,
  onOpenChange,
}: SDSViewerProps) {
  const { toast } = useToast();
  const [sdsData, setSdsData] = useState<PubChemSafetyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchData = async () => {
    if (hasFetched && sdsData) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchSafetyDataSheet(casNumber, chemicalName);
      if (!data) {
        setError(
          "No safety data found for this chemical. Verify the CAS number or name.",
        );
      } else {
        setSdsData(data);
      }
      setHasFetched(true);
    } catch (err: any) {
      setError(err.message || "Failed to fetch safety data");
      toast({
        variant: "destructive",
        title: "SDS Lookup Failed",
        description: "Could not retrieve data from PubChem",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && !hasFetched) {
      fetchData();
    }
    onOpenChange(isOpen);
  };

  const getSignalWordColor = (word: string) => {
    const w = word.toLowerCase();
    if (w === "danger") return "bg-red-500/15 text-red-600 border-red-300";
    if (w === "warning")
      return "bg-amber-500/15 text-amber-600 border-amber-300";
    return "bg-green-500/15 text-green-600 border-green-300";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-blue-500" />
            Safety Data Sheet — {chemicalName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span>CAS: {casNumber || "Not specified"}</span>
            {sdsData && (
              <a
                href={sdsData.pubchemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline inline-flex items-center gap-1 text-xs"
              >
                PubChem <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4 py-6">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-muted-foreground">
                Fetching safety data from PubChem...
              </p>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <div className="text-center">
              <p className="font-medium">No Safety Data Found</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {error}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <Loader2 className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        )}

        {sdsData && !isLoading && (
          <div className="space-y-5">
            {/* Compound Identity */}
            <Card className="border-blue-200/50 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-blue-500" />
                  Compound Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">
                    IUPAC Name
                  </span>
                  <span className="font-medium">
                    {sdsData.iupacName || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">
                    Molecular Formula
                  </span>
                  <span className="font-mono font-medium">
                    {sdsData.molecularFormula || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">
                    Molecular Weight
                  </span>
                  <span className="font-medium">
                    {sdsData.molecularWeight
                      ? `${sdsData.molecularWeight} g/mol`
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">
                    PubChem CID
                  </span>
                  <span className="font-mono font-medium">{sdsData.cid}</span>
                </div>
              </CardContent>
            </Card>

            {/* GHS Classification */}
            <Card className="border-amber-200/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  GHS Classification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Signal Word */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Signal Word:
                  </span>
                  <Badge
                    className={getSignalWordColor(sdsData.signalWord)}
                    variant="outline"
                  >
                    {sdsData.signalWord}
                  </Badge>
                </div>

                {/* GHS Pictograms */}
                {sdsData.pictograms.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-2">
                      GHS Pictograms
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {sdsData.pictograms.map((url, i) => (
                        <div
                          key={i}
                          className="w-16 h-16 border border-red-200 rounded-lg bg-white p-1 shadow-sm"
                        >
                          <img
                            src={url}
                            alt={`GHS Pictogram ${i + 1}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Hazard Statements */}
            {sdsData.hazardStatements.length > 0 && (
              <Card className="border-red-200/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Hazard Statements ({sdsData.hazardStatements.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {sdsData.hazardStatements.slice(0, 15).map((stmt, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-red-400 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                        <span>{stmt}</span>
                      </li>
                    ))}
                    {sdsData.hazardStatements.length > 15 && (
                      <li className="text-sm text-muted-foreground italic">
                        ...and {sdsData.hazardStatements.length - 15} more
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Precautionary Statements */}
            {sdsData.precautionaryStatements.length > 0 && (
              <Card className="border-blue-200/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                    Precautionary Statements (
                    {sdsData.precautionaryStatements.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {sdsData.precautionaryStatements
                      .slice(0, 15)
                      .map((stmt, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-blue-400 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                          <span>{stmt}</span>
                        </li>
                      ))}
                    {sdsData.precautionaryStatements.length > 15 && (
                      <li className="text-sm text-muted-foreground italic">
                        ...and {sdsData.precautionaryStatements.length - 15}{" "}
                        more
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* External Links */}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={sdsData.sdsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Full SDS on PubChem
                  <ExternalLink className="h-3 w-3 ml-1.5" />
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={sdsData.pubchemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Info className="h-3.5 w-3.5 mr-1.5" />
                  PubChem Compound Page
                  <ExternalLink className="h-3 w-3 ml-1.5" />
                </a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
