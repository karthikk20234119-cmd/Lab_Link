import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { 
  Loader2, 
  RotateCcw, 
  Package, 
  Camera,
  AlertTriangle
} from "lucide-react";

interface ReturnRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  borrowRequestId: string;
  itemId: string;
  itemName: string;
  borrowedQuantity: number;
  onSuccess?: () => void;
}

const conditionOptions = [
  { value: "good", label: "Good - No damage", icon: "✅" },
  { value: "minor_wear", label: "Minor Wear - Slight usage marks", icon: "🔶" },
  { value: "damaged", label: "Damaged - Has visible damage", icon: "⚠️" },
  { value: "missing_parts", label: "Missing Parts - Components missing", icon: "❌" },
  { value: "lost", label: "Lost - Cannot return item", icon: "🚫" },
];

export function ReturnRequestDialog({
  isOpen,
  onClose,
  borrowRequestId,
  itemId,
  itemName,
  borrowedQuantity,
  onSuccess,
}: ReturnRequestDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [quantity, setQuantity] = useState(borrowedQuantity);
  const [condition, setCondition] = useState("good");
  const [conditionNotes, setConditionNotes] = useState("");
  const [returnImageUrl, setReturnImageUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQuantityChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= borrowedQuantity) {
      setQuantity(num);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to submit a return.",
      });
      return;
    }

    if (!returnImageUrl) {
      toast({
        variant: "destructive",
        title: "Image Required",
        description: "Please upload a photo of the item being returned.",
      });
      return;
    }

    if (condition === "damaged" || condition === "missing_parts" || condition === "lost") {
      if (!conditionNotes.trim()) {
        toast({
          variant: "destructive",
          title: "Details Required",
          description: "Please describe the condition issue in the notes.",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("return_requests")
        .insert({
          borrow_request_id: borrowRequestId,
          student_id: user.id,
          item_id: itemId,
          quantity: quantity,
          return_datetime: new Date().toISOString(),
          item_condition: condition,
          condition_notes: conditionNotes.trim() || null,
          return_image_url: returnImageUrl,
          notes: notes.trim() || null,
          status: "pending",
        });

      if (error) throw error;

      // Update borrow request status to return_pending
      await supabase
        .from("borrow_requests")
        .update({ status: "return_pending" })
        .eq("id", borrowRequestId);

      toast({
        title: "Return Submitted!",
        description: "Your return request has been submitted. Staff will verify and confirm.",
      });

      // Reset form
      setQuantity(borrowedQuantity);
      setCondition("good");
      setConditionNotes("");
      setReturnImageUrl("");
      setNotes("");
      
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error submitting return:", error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "Failed to submit return. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showConditionWarning = ["damaged", "missing_parts", "lost"].includes(condition);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Submit Return
          </DialogTitle>
          <DialogDescription>
            Return <strong>{itemName}</strong>. Please provide details and a photo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="return-quantity" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Quantity Returning
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="return-quantity"
                type="number"
                min={1}
                max={borrowedQuantity}
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                of {borrowedQuantity} borrowed
              </span>
            </div>
          </div>

          {/* Item Condition */}
          <div className="space-y-2">
            <Label>Item Condition *</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {conditionOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condition Warning */}
          {showConditionWarning && (
            <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Please Explain</p>
                <p className="text-muted-foreground">
                  Describe the damage, missing parts, or loss reason below.
                </p>
              </div>
            </div>
          )}

          {/* Condition Notes */}
          <div className="space-y-2">
            <Label htmlFor="condition-notes">
              Condition Notes {showConditionWarning && "*"}
            </Label>
            <Textarea
              id="condition-notes"
              placeholder={showConditionWarning 
                ? "Please describe the condition issue in detail..." 
                : "Optional notes about the item condition..."}
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              className="min-h-[60px] resize-none"
            />
          </div>

          {/* Return Image */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Return Photo *
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Upload a clear photo of the item being returned
            </p>
            <ImageUpload
              value={returnImageUrl}
              onChange={setReturnImageUrl}
              bucket="return-images"
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any other information..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[60px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !returnImageUrl}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Submit Return
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
