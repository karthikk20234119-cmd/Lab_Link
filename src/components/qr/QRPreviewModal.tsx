import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Printer, Share2, Package, QrCode, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCodeLib from "qrcode";

interface ItemData {
  id: string;
  name: string;
  item_code: string;
  qr_code_data: string | null;
  status: string;
  current_quantity: number;
  category?: { name: string };
  department?: { name: string };
  storage_location?: string;
}

interface QRPreviewModalProps {
  item: ItemData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QRPreviewModal({ item, open, onOpenChange }: QRPreviewModalProps) {
  const { toast } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (item && open) {
      generateQRImage();
    }
  }, [item, open]);

  const generateQRImage = async () => {
    if (!item) return;
    
    try {
      const qrData = item.qr_code_data || JSON.stringify({
        type: "lablink_item",
        id: item.id,
        code: item.item_code,
      });
      
      const dataUrl = await QRCodeLib.toDataURL(qrData, {
        width: 400,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
        errorCorrectionLevel: "H",
      });
      
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error("Error generating QR:", error);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl || !item) return;
    
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `QR-${item.item_code}.png`;
    link.click();
    
    toast({ title: "Downloaded", description: `QR code for ${item.name}` });
  };

  const handlePrint = () => {
    if (!qrDataUrl || !item) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({ variant: "destructive", title: "Error", description: "Could not open print window" });
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${item.name}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .qr-container {
              text-align: center;
              padding: 20px;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
            }
            .qr-image {
              width: 200px;
              height: 200px;
            }
            .item-name {
              font-size: 18px;
              font-weight: bold;
              margin: 10px 0 5px;
            }
            .item-code {
              font-size: 14px;
              color: #6b7280;
              font-family: monospace;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <img src="${qrDataUrl}" class="qr-image" alt="QR Code" />
            <div class="item-name">${item.name}</div>
            <div class="item-code">${item.item_code}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShare = async () => {
    if (!item) return;
    
    const shareData = {
      title: item.name,
      text: `LabLink Item: ${item.name} (${item.item_code})`,
      url: `${window.location.origin}/items/${item.id}`,
    };
    
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast({ title: "Link Copied", description: "Item link copied to clipboard" });
      }
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const handleCopyCode = async () => {
    if (!item) return;
    
    await navigator.clipboard.writeText(item.item_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied", description: "Item code copied to clipboard" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-green-500";
      case "borrowed": return "bg-blue-500";
      case "under_maintenance": return "bg-yellow-500";
      case "damaged": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            QR Code Preview
          </DialogTitle>
          <DialogDescription>
            Scan this QR code to quickly access item details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* QR Code Display */}
          <div className="flex justify-center p-4 bg-white rounded-xl border">
            {qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt={`QR Code for ${item.name}`}
                className="w-48 h-48"
              />
            ) : (
              <div className="w-48 h-48 bg-muted animate-pulse rounded-lg" />
            )}
          </div>

          {/* Item Details */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{item.name}</span>
              </div>
              <Badge className={`${getStatusColor(item.status)} text-white`}>
                {item.status.replace(/_/g, " ")}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Item Code</span>
              <div className="flex items-center gap-2">
                <code className="bg-background px-2 py-1 rounded text-sm font-mono">
                  {item.item_code}
                </code>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCopyCode}>
                  {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {item.category && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Category</span>
                <span className="text-sm">{item.category.name}</span>
              </div>
            )}

            {item.storage_location && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Location</span>
                <span className="text-sm">{item.storage_location}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Quantity</span>
              <Badge variant="outline">{item.current_quantity}</Badge>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button onClick={handlePrint} variant="outline" className="flex-1">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button onClick={handleShare} variant="outline" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
