import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, XCircle } from "lucide-react";

interface RejectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  itemName: string;
  studentName: string;
  studentId: string;
  onSuccess?: () => void;
}

export function RejectionDialog({
  isOpen,
  onClose,
  requestId,
  itemName,
  studentName,
  studentId,
  onSuccess,
}: RejectionDialogProps) {
  const { toast } = useToast();
  
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReject = async () => {
    if (!reason.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a reason for rejection.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Update borrow request status
      const { error: updateError } = await supabase
        .from("borrow_requests")
        .update({
          status: "rejected",
          approved_by: user?.id,
          approved_date: new Date().toISOString(),
          rejection_reason: reason.trim(),
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // Create a borrow message for the student
      const { error: messageError } = await supabase
        .from("borrow_messages")
        .insert({
          borrow_request_id: requestId,
          sender_id: user?.id,
          recipient_id: studentId,
          message_type: "rejection",
          subject: `Borrow Request Rejected: ${itemName}`,
          message: `Your request to borrow ${itemName} has been rejected.\n\nReason: ${reason}`,
        });

      if (messageError) {
        console.error("Failed to create message:", messageError);
      }

      toast({
        title: "Request Rejected",
        description: `${studentName}'s request has been rejected. They will be notified.`,
      });

      setReason("");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error rejecting request:", error);
      toast({
        variant: "destructive",
        title: "Rejection Failed",
        description: error.message || "Failed to reject request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Reject Borrow Request
          </DialogTitle>
          <DialogDescription>
            Reject <strong>{studentName}</strong>'s request to borrow <strong>{itemName}</strong>.
            Please provide a reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Rejection *</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Item not available, Insufficient quantity, Student has pending returns..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
            variant="destructive"
            onClick={handleReject}
            disabled={isSubmitting || !reason.trim()}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Reject Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
