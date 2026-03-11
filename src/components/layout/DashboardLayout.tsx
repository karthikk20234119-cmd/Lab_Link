import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { ChatbotWidget } from "@/components/chatbot/ChatbotWidget";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  userRole?: "admin" | "staff" | "student" | "technician";
}

export function DashboardLayout({
  children,
  title,
  subtitle,
  userRole: propUserRole,
}: DashboardLayoutProps) {
  const { userRole: authUserRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Use prop role if provided, otherwise use auth role, default to "student"
  const userRole = propUserRole || authUserRole || "student";

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Close mobile sidebar when route changes (handled via link clicks)
  const handleMobileLinkClick = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-gray-900 dark:to-gray-900">
      {/* Mobile overlay - Full screen backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300",
          sidebarOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar - Mobile (slides in from left) */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-out lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar 
          userRole={userRole as "admin" | "staff" | "student" | "technician"} 
          onLinkClick={handleMobileLinkClick}
        />
      </div>

      {/* Sidebar - Desktop (fixed position) */}
      <div className="hidden lg:block">
        <Sidebar 
          userRole={userRole as "admin" | "staff" | "student" | "technician"} 
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      </div>

      {/* Main content - No left padding on mobile, padding on desktop */}
      <div className={cn(
        "min-h-screen transition-all duration-300 ease-in-out",
        "lg:pl-64", // Default desktop padding
        sidebarCollapsed && "lg:pl-20" // Collapsed desktop padding
      )}>
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          isMenuOpen={sidebarOpen}
        />
        <main className="p-3 sm:p-4 md:p-6 pb-20">{children}</main>
      </div>

      {/* Chatbot Widget - Available for all roles */}
      <ChatbotWidget />
    </div>
  );
}

