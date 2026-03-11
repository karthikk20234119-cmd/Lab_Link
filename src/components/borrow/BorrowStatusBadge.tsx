import { Badge } from "@/components/ui/badge";
import { Clock, Check, X, RotateCcw, Loader2, AlertTriangle } from "lucide-react";

interface BorrowStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const statusConfig: Record<string, { 
  icon: React.ReactNode; 
  label: string; 
  className: string;
}> = {
  pending: {
    icon: <Clock className="h-3 w-3" />,
    label: "Pending",
    className: "bg-warning/20 text-warning border-warning/30",
  },
  approved: {
    icon: <Check className="h-3 w-3" />,
    label: "Approved",
    className: "bg-success/20 text-success border-success/30",
  },
  rejected: {
    icon: <X className="h-3 w-3" />,
    label: "Rejected",
    className: "bg-destructive/20 text-destructive border-destructive/30",
  },
  returned: {
    icon: <RotateCcw className="h-3 w-3" />,
    label: "Returned",
    className: "bg-primary/20 text-primary border-primary/30",
  },
  return_pending: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    label: "Return Pending",
    className: "bg-info/20 text-info border-info/30",
  },
  damaged: {
    icon: <AlertTriangle className="h-3 w-3" />,
    label: "Damaged",
    className: "bg-orange-500/20 text-orange-500 border-orange-500/30",
  },
};

export function BorrowStatusBadge({ status, size = "md" }: BorrowStatusBadgeProps) {
  const config = statusConfig[status] || {
    icon: null,
    label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " "),
    className: "bg-muted text-muted-foreground",
  };

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} ${size === "sm" ? "text-xs py-0" : ""}`}
    >
      <span className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </span>
    </Badge>
  );
}
