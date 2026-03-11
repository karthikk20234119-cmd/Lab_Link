import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Printer, Download, Loader2, Grid3X3, LayoutGrid, Grid2X2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCodeLib from "qrcode";
import jsPDF from "jspdf";

interface ItemData {
  id: string;
  name: string;
  item_code: string;
  qr_code_data: string | null;
  category?: { name: string };
}

interface BulkQRPrintProps {
  items: ItemData[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LayoutType = "2x2" | "3x3" | "4x4";

const LAYOUTS: Record<LayoutType, { cols: number; rows: number; qrSize: number; fontSize: number }> = {
  "2x2": { cols: 2, rows: 2, qrSize: 70, fontSize: 10 },
  "3x3": { cols: 3, rows: 3, qrSize: 50, fontSize: 8 },
  "4x4": { cols: 4, rows: 4, qrSize: 35, fontSize: 6 },
};

export function BulkQRPrint({ items, open, onOpenChange }: BulkQRPrintProps) {
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<LayoutType>("3x3");
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeLabels, setIncludeLabels] = useState(true);

  useEffect(() => {
    if (open) {
      // Select all items by default
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  }, [open, items]);

  const toggleItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    setSelectedItems(new Set(items.map(i => i.id)));
  };

  const selectNone = () => {
    setSelectedItems(new Set());
  };

  const generatePDF = async () => {
    if (selectedItems.size === 0) {
      toast({ variant: "destructive", title: "Error", description: "Please select at least one item" });
      return;
    }

    setIsGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const { cols, rows, qrSize, fontSize } = LAYOUTS[layout];
      const itemsPerPage = cols * rows;
      
      // Calculate margins and spacing
      const marginX = 15;
      const marginY = 20;
      const cellWidth = (pageWidth - (marginX * 2)) / cols;
      const cellHeight = (pageHeight - (marginY * 2)) / rows;
      
      const selectedItemsList = items.filter(i => selectedItems.has(i.id));
      const totalPages = Math.ceil(selectedItemsList.length / itemsPerPage);

      // Add header on first page
      doc.setFontSize(16);
      doc.setTextColor(59, 130, 246);
      doc.text("LabLink QR Codes", marginX, 12);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Items: ${selectedItemsList.length}`, marginX, 17);

      let currentPage = 0;
      let itemIndex = 0;

      for (const item of selectedItemsList) {
        const pagePosition = itemIndex % itemsPerPage;
        
        // Add new page if needed
        if (pagePosition === 0 && itemIndex > 0) {
          doc.addPage();
          currentPage++;
        }
        
        const row = Math.floor(pagePosition / cols);
        const col = pagePosition % cols;
        
        const x = marginX + (col * cellWidth) + (cellWidth - qrSize) / 2;
        const y = marginY + (row * cellHeight) + 5;
        
        // Generate QR code
        const qrData = item.qr_code_data || JSON.stringify({
          type: "lablink_item",
          id: item.id,
          code: item.item_code,
        });
        
        const dataUrl = await QRCodeLib.toDataURL(qrData, {
          width: qrSize * 4, // Higher resolution for print
          margin: 1,
          errorCorrectionLevel: "M",
        });
        
        // Add QR code image
        doc.addImage(dataUrl, "PNG", x, y, qrSize, qrSize);
        
        // Add labels if enabled
        if (includeLabels) {
          doc.setFontSize(fontSize);
          doc.setTextColor(0);
          
          // Item name (truncated if too long)
          const maxChars = Math.floor(cellWidth / (fontSize * 0.5));
          const displayName = item.name.length > maxChars 
            ? item.name.slice(0, maxChars - 2) + "..."
            : item.name;
          
          const labelX = marginX + (col * cellWidth) + cellWidth / 2;
          const labelY = y + qrSize + 4;
          
          doc.text(displayName, labelX, labelY, { align: "center" });
          
          // Item code
          doc.setFontSize(fontSize - 1);
          doc.setTextColor(100);
          doc.text(item.item_code, labelX, labelY + fontSize * 0.4, { align: "center" });
        }
        
        itemIndex++;
      }

      // Add footer with page numbers
      for (let i = 0; i < totalPages; i++) {
        doc.setPage(i + 1);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${i + 1} of ${totalPages} | LabLink Inventory System`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      }

      doc.save(`lablink-qr-codes-${new Date().toISOString().split("T")[0]}.pdf`);
      
      toast({ 
        title: "Success", 
        description: `Generated PDF with ${selectedItemsList.length} QR codes` 
      });
      onOpenChange(false);
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate PDF" });
    } finally {
      setIsGenerating(false);
    }
  };

  const getLayoutIcon = (l: LayoutType) => {
    switch (l) {
      case "2x2": return <Grid2X2 className="h-4 w-4" />;
      case "3x3": return <Grid3X3 className="h-4 w-4" />;
      case "4x4": return <LayoutGrid className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Print QR Code Sheet
          </DialogTitle>
          <DialogDescription>
            Generate a printable PDF with QR codes for selected items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Layout Selection */}
          <div className="space-y-2">
            <Label>Page Layout</Label>
            <RadioGroup
              value={layout}
              onValueChange={(v) => setLayout(v as LayoutType)}
              className="grid grid-cols-3 gap-2"
            >
              {(["2x2", "3x3", "4x4"] as LayoutType[]).map((l) => (
                <div key={l}>
                  <RadioGroupItem value={l} id={l} className="peer sr-only" />
                  <Label
                    htmlFor={l}
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    {getLayoutIcon(l)}
                    <span className="text-xs mt-1">{l}</span>
                    <span className="text-xs text-muted-foreground">
                      {LAYOUTS[l].cols * LAYOUTS[l].rows}/page
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="labels"
              checked={includeLabels}
              onCheckedChange={(checked) => setIncludeLabels(checked as boolean)}
            />
            <Label htmlFor="labels" className="text-sm cursor-pointer">
              Include item names and codes below QR
            </Label>
          </div>

          <Separator />

          {/* Item Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Items ({selectedItems.size} of {items.length})</Label>
              <div className="space-x-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  Clear
                </Button>
              </div>
            </div>
            
            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                      selectedItems.has(item.id) ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                    onClick={() => toggleItem(item.id)}
                  >
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.item_code}</p>
                    </div>
                    {item.category && (
                      <Badge variant="secondary" className="text-xs">
                        {item.category.name}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={generatePDF} disabled={isGenerating || selectedItems.size === 0}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Generate PDF ({selectedItems.size} items)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
