import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Camera,
  CameraOff,
  FlipHorizontal,
  Loader2,
  Package,
  ExternalLink,
  QrCode,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface QRScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess?: (itemId: string, itemData: any) => void;
}

interface ScanResult {
  type: string;
  id: string;
  code?: string;
  name?: string;
  status?: string;
}

export function QRScanner({
  open,
  onOpenChange,
  onScanSuccess,
}: QRScannerProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [hasCamera, setHasCamera] = useState(true);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start camera when dialog opens
  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setScanResult(null);
      setError(null);
    }

    return () => {
      stopCamera();
    };
  }, [open, facingMode]);

  const startCamera = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setHasCamera(true);
        startScanning();
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setHasCamera(false);

      if (err.name === "NotAllowedError") {
        setError(
          "Camera access denied. Please allow camera permissions to scan QR codes.",
        );
      } else if (err.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Failed to access camera. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startScanning = useCallback(() => {
    const scan = async () => {
      if (!videoRef.current || !canvasRef.current || scanResult) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationFrameRef.current = requestAnimationFrame(scan);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Use jsQR library loaded via CDN
      try {
        const jsQRFn = (window as any).jsQR;
        if (typeof jsQRFn === "function") {
          const code = jsQRFn(
            imageData.data,
            imageData.width,
            imageData.height,
          );

          if (code) {
            handleScanResult(code.data);
            return;
          }
        }
      } catch (e) {
        // Continue scanning
      }

      animationFrameRef.current = requestAnimationFrame(scan);
    };

    // Load jsQR library if not loaded
    if (typeof (window as any).jsQR === "undefined") {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
      script.onload = () => {
        animationFrameRef.current = requestAnimationFrame(scan);
      };
      document.head.appendChild(script);
    } else {
      animationFrameRef.current = requestAnimationFrame(scan);
    }
  }, [scanResult]);

  const handleScanResult = async (data: string) => {
    stopCamera();
    setIsValidating(true);

    try {
      // ── Handle LABLINK format: "LABLINK:uuid:unitNum:timestamp" ──
      if (data.startsWith("LABLINK:")) {
        const parts = data.split(":");
        const itemId = parts[1]; // UUID of the parent item

        if (itemId) {
          const { data: item, error: fetchError } = await supabase
            .from("items")
            .select(
              "id, name, item_code, status, current_quantity, category:categories(name)",
            )
            .eq("id", itemId)
            .single();

          if (fetchError || !item) {
            setError("Item not found in system. The QR code may be outdated.");
            setIsValidating(false);
            return;
          }

          setScanResult({
            type: "lablink_item",
            id: item.id,
            code: item.item_code,
            name: item.name + (parts[2] ? ` (Unit #${parts[2]})` : ""),
            status: item.status,
          });

          if (navigator.vibrate) navigator.vibrate(100);
          toast({ title: "Item Found!", description: item.name });
          if (onScanSuccess) onScanSuccess(item.id, item);
          setIsValidating(false);
          return;
        }
      }

      // ── Handle JSON format: {"type":"lablink_item","id":"uuid"} ──
      let parsedData: any;
      try {
        parsedData = JSON.parse(data);
      } catch {
        parsedData = { id: data };
      }

      if (parsedData.type === "lablink_item" && parsedData.id) {
        const { data: item, error: fetchError } = await supabase
          .from("items")
          .select(
            "id, name, item_code, status, current_quantity, category:categories(name)",
          )
          .eq("id", parsedData.id)
          .single();

        if (fetchError || !item) {
          setError("Item not found in system. The QR code may be outdated.");
          setIsValidating(false);
          return;
        }

        setScanResult({
          type: "lablink_item",
          id: item.id,
          code: item.item_code,
          name: item.name,
          status: item.status,
        });

        if (navigator.vibrate) navigator.vibrate(100);
        toast({ title: "Item Found!", description: item.name });
        if (onScanSuccess) onScanSuccess(item.id, item);
      } else {
        // ── Fallback: try as item_code or UUID ──
        const searchId = parsedData.id || data;
        const { data: item } = await supabase
          .from("items")
          .select("id, name, item_code, status")
          .or(`item_code.eq.${searchId},id.eq.${searchId}`)
          .single();

        if (item) {
          setScanResult({
            type: "lablink_item",
            id: item.id,
            code: item.item_code,
            name: item.name,
            status: item.status,
          });
          if (navigator.vibrate) navigator.vibrate(100);
          toast({ title: "Item Found!", description: item.name });
          if (onScanSuccess) onScanSuccess(item.id, item);
        } else {
          setError(
            "Invalid QR code. This doesn't appear to be a LabLink item.",
          );
        }
      }
    } catch (err) {
      console.error("Validation error:", err);
      setError("Failed to validate QR code. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    setScanResult(null);
  };

  const rescan = () => {
    setScanResult(null);
    setError(null);
    startCamera();
  };

  const viewItem = () => {
    if (scanResult?.id) {
      onOpenChange(false);
      navigate(`/items/${scanResult.id}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500";
      case "borrowed":
        return "bg-blue-500";
      case "under_maintenance":
        return "bg-yellow-500";
      case "damaged":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Scan QR Code
          </DialogTitle>
          <DialogDescription>
            Point your camera at an item's QR code to scan
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera View */}
          <div className="relative aspect-square bg-black rounded-xl overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {!hasCamera && !isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted p-4 text-center">
                <CameraOff className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  {error || "Camera not available"}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={startCamera}
                >
                  Try Again
                </Button>
              </div>
            )}

            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              style={{ display: hasCamera && !scanResult ? "block" : "none" }}
            />

            {/* Scanning overlay */}
            {hasCamera && !scanResult && !isLoading && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Corner markers */}
                <div className="absolute top-8 left-8 w-12 h-12 border-l-4 border-t-4 border-primary rounded-tl-lg" />
                <div className="absolute top-8 right-8 w-12 h-12 border-r-4 border-t-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-8 left-8 w-12 h-12 border-l-4 border-b-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-8 right-8 w-12 h-12 border-r-4 border-b-4 border-primary rounded-br-lg" />

                {/* Scanning line animation */}
                <div className="absolute left-8 right-8 top-1/2 h-0.5 bg-primary/50 animate-pulse" />
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Camera controls */}
          {hasCamera && !scanResult && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={toggleCamera}>
                <FlipHorizontal className="h-4 w-4 mr-2" />
                Flip Camera
              </Button>
            </div>
          )}

          {/* Validating state */}
          {isValidating && (
            <Card>
              <CardContent className="flex items-center justify-center p-6">
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
                <span>Validating item...</span>
              </CardContent>
            </Card>
          )}

          {/* Error state */}
          {error && !isValidating && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Scan Result */}
          {scanResult && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium truncate">
                        {scanResult.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-background px-2 py-0.5 rounded">
                        {scanResult.code}
                      </code>
                      {scanResult.status && (
                        <Badge
                          className={`${getStatusColor(scanResult.status)} text-white text-xs`}
                        >
                          {scanResult.status.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {scanResult && (
            <div className="flex gap-2">
              <Button onClick={viewItem} className="flex-1">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Item
              </Button>
              <Button variant="outline" onClick={rescan}>
                <Camera className="h-4 w-4 mr-2" />
                Scan Again
              </Button>
            </div>
          )}

          {error && !scanResult && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={rescan} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
