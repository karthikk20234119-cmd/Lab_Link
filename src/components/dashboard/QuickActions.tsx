import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  Package, 
  ClipboardList, 
  History, 
  Bell, 
  QrCode, 
  Search,
  Settings,
  BookOpen
} from "lucide-react";

interface QuickAction {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  color: string;
  bgColor: string;
}

const studentActions: QuickAction[] = [
  {
    icon: Search,
    label: "Browse Items",
    description: "Find available equipment",
    href: "/browse",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: ClipboardList,
    label: "New Request",
    description: "Request to borrow items",
    href: "/my-requests",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20",
  },
  {
    icon: History,
    label: "My History",
    description: "View past requests",
    href: "/history",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    icon: Bell,
    label: "Notifications",
    description: "Check alerts",
    href: "/notifications",
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
  },
];

const adminActions: QuickAction[] = [
  {
    icon: Package,
    label: "Add Item",
    description: "Add new inventory",
    href: "/items/new",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: ClipboardList,
    label: "Requests",
    description: "Manage requests",
    href: "/requests",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20",
  },
  {
    icon: QrCode,
    label: "Scan QR",
    description: "Scan item QR codes",
    href: "/scan",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    icon: BookOpen,
    label: "Reports",
    description: "View analytics",
    href: "/reports",
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
  },
];

interface QuickActionsProps {
  userRole?: string;
}

export function QuickActions({ userRole = "student" }: QuickActionsProps) {
  const navigate = useNavigate();
  const actions = userRole === "student" ? studentActions : adminActions;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {actions.map((action) => (
        <Card 
          key={action.label}
          className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border-0 bg-white dark:bg-card"
          onClick={() => navigate(action.href)}
        >
          <CardContent className="p-4 flex flex-col items-center text-center">
            <div className={cn("p-3 rounded-xl mb-3", action.bgColor)}>
              <action.icon className={cn("h-6 w-6", action.color)} />
            </div>
            <h3 className="font-semibold text-sm">{action.label}</h3>
            <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
