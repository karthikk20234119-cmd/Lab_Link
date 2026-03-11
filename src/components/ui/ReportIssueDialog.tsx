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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, Loader2 } from "lucide-react";

interface ReportIssueDialogProps {
  itemId: string;
  itemName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type DamageSeverity = "minor" | "moderate" | "severe";

const severityConfig: Record<DamageSeverity, { label: string; description: string; color: string }> = {
  minor: {
    label: "Minor",
    description: "Cosmetic damage, still fully functional",
    color: "text-yellow-600",
  },
  moderate: {
    label: "Moderate",
    description: "Partially functional, needs attention",
    color: "text-orange-600",
  },
  severe: {
    label: "Severe",
    description: "Non-functional, requires immediate repair",
    color: "text-red-600",
  },
};

export function ReportIssueDialog({
  itemId,
  itemName,
  isOpen,
  onClose,
  onSuccess,
}: ReportIssueDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [damageType, setDamageType] = useState("");
  const [severity, setSeverity] = useState<DamageSeverity>("minor");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not Authenticated",
        description: "Please log in to report an issue.",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        variant: "destructive",
        title: "Description Required",
        description: "Please describe the issue you're reporting.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("damage_reports").insert({
        item_id: itemId,
        reported_by: user.id,
        damage_type: damageType.trim() || null,
        severity: severity,
        description: description.trim(),
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Issue Reported!",
        description: "Thank you for reporting this issue. Staff will review it shortly.",
      });

      // Reset form
      setDamageType("");
      setSeverity("minor");
      setDescription("");

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error reporting issue:", error);
      toast({
        variant: "destructive",
        title: "Report Failed",
        description: error.message || "Failed to submit report. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Report a problem or damage with <strong>{itemName}</strong>. Staff will review and take action.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Damage Type */}
          <div className="space-y-2">
            <Label htmlFor="damage-type">Issue Type</Label>
            <Input
              id="damage-type"
              placeholder="e.g., Broken screen, Missing parts, Not working..."
              value={damageType}
              onChange={(e) => setDamageType(e.target.value)}
            />
          </div>

          {/* Severity */}
          <div className="space-y-3">
            <Label>Severity Level</Label>
            <RadioGroup
              value={severity}
              onValueChange={(value) => setSeverity(value as DamageSeverity)}
              className="grid grid-cols-1 gap-2"
            >
              {(Object.entries(severityConfig) as [DamageSeverity, typeof severityConfig.minor][]).map(
                ([key, config]) => (
                  <div
                    key={key}
                    className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
                      severity === key ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => setSeverity(key)}
                  >
                    <RadioGroupItem value={key} id={`severity-${key}`} />
                    <div className="flex-1">
                      <Label
                        htmlFor={`severity-${key}`}
                        className={`font-medium cursor-pointer ${config.color}`}
                      >
                        {config.label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {config.description}
                      </p>
                    </div>
                  </div>
                )
              )}
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Please describe the issue in detail. Include when you noticed it and any relevant circumstances..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] resize-none"
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
            disabled={isSubmitting || !description.trim()}
            variant="destructive"
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
