import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { AnimatedCounter } from "./AnimatedCounter";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "info" | "orange";
  loading?: boolean;
  link?: string;
  className?: string;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  loading = false,
  link,
  className,
}: StatsCardProps) {
  const navigate = useNavigate();

  const iconContainerColors = {
    default: "icon-container bg-gray-100 text-gray-600",
    primary: "icon-container blue",
    success: "icon-container green",
    warning: "icon-container amber",
    danger: "icon-container red",
    info: "icon-container sky",
    orange: "icon-container orange",
  };

  if (loading) {
    return (
      <div className="stat-card">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    );
  }

  const numericValue = typeof value === 'string' ? parseInt(value.replace(/,/g, '')) || 0 : value;

  return (
    <div 
      className={cn("stat-card group", variant, className)}
      onClick={() => link && navigate(link)}
    >
      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        {/* Icon with gradient background effect */}
        <div className={cn(
          "h-10 w-10 sm:h-12 md:h-14 sm:w-12 md:w-14 rounded-xl transition-transform duration-300 group-hover:scale-110 flex-shrink-0",
          iconContainerColors[variant]
        )}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-0.5 sm:mb-1 truncate">{title}</p>
          <div className="flex items-baseline gap-2 sm:gap-3">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
              <AnimatedCounter value={numericValue} duration={800} />
            </h3>
            {trend && (
              <span className={cn(
                "hidden sm:inline-flex items-center text-xs font-semibold px-2 py-1 rounded-full",
                trend.isPositive ? "trend-up" : "trend-down"
              )}>
                {trend.isPositive ? (
                  <ArrowUpRight className="h-3 w-3 mr-0.5" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 mr-0.5" />
                )}
                {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
