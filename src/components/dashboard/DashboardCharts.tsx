import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  LineChart,
} from "recharts";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Activity,
  Calendar,
  Users,
  ArrowUpRight,
  FileX,
  Layers,
  Database,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DashboardChartsProps {
  monthlyTrends: any[];
  categoryDistribution: any[];
  weeklyUsage: any[];
  itemStatusDistribution: any[];
  maintenanceTrends: any[];
  dailyUsageReports?: any[];
  studentActivity?: any[];
  isLoading: boolean;
}

// Premium color palette with gradients
const CHART_COLORS = {
  primary: "#3b82f6",
  secondary: "#8b5cf6",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#06b6d4",
  orange: "#f97316",
  pink: "#ec4899",
  indigo: "#6366f1",
  teal: "#14b8a6",
};

// Custom tooltip component with modern styling
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 backdrop-blur-xl p-4 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 min-w-[140px]">
        <p className="text-sm font-bold text-gray-900 dark:text-white mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full shadow-sm" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Enhanced Pie tooltip
const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const total = data.payload?.total || 1;
    const percentage = ((data.value / total) * 100).toFixed(1);
    return (
      <div className="bg-white dark:bg-gray-800 backdrop-blur-xl p-4 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 min-w-[160px]">
        <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
          <div 
            className="w-4 h-4 rounded-full shadow-sm" 
            style={{ backgroundColor: data.payload.color }}
          />
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {data.name}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">Count</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {data.value}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Percentage</span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {percentage}%
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Loading skeleton component
const ChartSkeleton = () => (
  <div className="h-[260px] w-full flex flex-col items-center justify-center">
    <div className="animate-pulse flex flex-col items-center gap-4">
      <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-full" />
      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-full" />
      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
    </div>
  </div>
);

// Empty state component
const EmptyChartState = ({ title = "No data available" }: { title?: string }) => (
  <div className="h-[240px] w-full flex flex-col items-center justify-center text-center p-6">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center mb-4 shadow-inner">
      <FileX className="w-8 h-8 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
      Data will appear here once available
    </p>
  </div>
);

export function DashboardCharts({ 
  monthlyTrends, 
  categoryDistribution, 
  weeklyUsage,
  itemStatusDistribution,
  maintenanceTrends,
  dailyUsageReports = [],
  studentActivity = [],
  isLoading 
}: DashboardChartsProps) {
  
  // Use REAL data only - no fallbacks to fake data
  // Data from database will be shown as-is, including zeros
  const effectiveMonthlyTrends = monthlyTrends || [];
  const effectiveStatusData = itemStatusDistribution || [];
  const effectiveDailyUsage = dailyUsageReports.length > 0 ? dailyUsageReports : weeklyUsage.map(d => ({
    ...d, 
    checkouts: d.borrowed || d.value || 0, 
    returns: d.returned || 0,
    shortName: d.name
  }));
  const effectiveStudentActivity = studentActivity || [];
  const effectiveCategoryDistribution = categoryDistribution || [];
  const effectiveWeeklyUsage = weeklyUsage || [];
  const effectiveMaintenanceTrends = maintenanceTrends || [];

  // Calculate totals for pie chart percentage
  const statusTotal = effectiveStatusData.reduce((acc: number, item: any) => acc + (item.value || 0), 0);
  const enrichedStatusData = effectiveStatusData.map((item: any) => ({
    ...item,
    total: statusTotal,
  }));

  // Calculate trend percentage based on real data
  const lastTwoMonths = effectiveMonthlyTrends.slice(-2);
  const trendPercentage = lastTwoMonths.length === 2 && lastTwoMonths[0].requests > 0
    ? Math.round(((lastTwoMonths[1].requests - lastTwoMonths[0].requests) / lastTwoMonths[0].requests) * 100)
    : 0; // Show 0% if no data to compare

  // Helper to check if data has values for rendering charts
  // Changed: Now shows chart if data array exists with items (even if all zeros),
  // since showing a "flat" chart is more informative than empty state
  const hasChartData = (data: any[], keys: string[] = ['value'], requirePositive: boolean = false): boolean => {
    if (!data || data.length === 0) return false;
    // If requirePositive, check for at least one positive value
    if (requirePositive) {
      return data.some(item => keys.some(key => (item[key] || 0) > 0));
    }
    // Otherwise, just check that data array has items
    return true;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="dashboard-card h-[420px]"><ChartSkeleton /></div>
          <div className="dashboard-card h-[420px]"><ChartSkeleton /></div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="dashboard-card h-[360px]"><ChartSkeleton /></div>
          <div className="dashboard-card h-[360px]"><ChartSkeleton /></div>
          <div className="dashboard-card h-[360px]"><ChartSkeleton /></div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="dashboard-card h-[360px]"><ChartSkeleton /></div>
          <div className="dashboard-card h-[360px]"><ChartSkeleton /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Monthly Trends & Item Status - Main Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Request Trends - Enhanced Area Chart with Line */}
        <div className="dashboard-card animate-fade-in-up overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-3">
                <div className="icon-container blue h-11 w-11 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-gray-900 dark:text-white">Request Trends</span>
                  <p className="text-xs font-normal text-muted-foreground mt-0.5">
                    Monthly overview of lab requests
                  </p>
                </div>
              </CardTitle>
              <Badge variant="outline" className={`text-xs ${trendPercentage >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}>
                <ArrowUpRight className={`h-3 w-3 mr-1 ${trendPercentage < 0 ? 'rotate-180' : ''}`} />
                {Math.abs(trendPercentage)}% vs last month
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {hasChartData(effectiveMonthlyTrends, ['requests', 'approved']) ? (
              <>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={effectiveMonthlyTrends} margin={{ top: 20, right: 20, left: -10, bottom: 10 }}>
                      <defs>
                        <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }} 
                        dy={10} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        width={40}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="requests" 
                        stroke="#3b82f6" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#colorRequests)"
                        name="Total Requests"
                        animationDuration={1200}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="approved" 
                        stroke="#22c55e" 
                        strokeWidth={3} 
                        dot={{ fill: '#22c55e', r: 5, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 7, stroke: '#22c55e', strokeWidth: 2 }}
                        name="Approved"
                        animationDuration={1200}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="rejected" 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                        strokeDasharray="5 5"
                        dot={{ fill: '#ef4444', r: 4 }}
                        name="Rejected"
                        animationDuration={1200}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Requests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Approved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-red-500" style={{ borderRadius: 2 }} />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Rejected</span>
                  </div>
                </div>
              </>
            ) : (
              <EmptyChartState title="No request data yet" />
            )}
          </CardContent>
        </div>

        {/* Item Status Distribution - Enhanced Donut Chart */}
        <div className="dashboard-card animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-3">
                <div className="icon-container orange h-11 w-11 rounded-xl flex items-center justify-center">
                  <PieChartIcon className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-gray-900 dark:text-white">Item Status</span>
                  <p className="text-xs font-normal text-muted-foreground mt-0.5">
                    Current inventory distribution
                  </p>
                </div>
              </CardTitle>
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 font-semibold">
                {statusTotal} Total Items
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {statusTotal > 0 ? (
              <>
                <div className="h-[260px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {enrichedStatusData.map((entry: any, index: number) => (
                          <linearGradient key={index} id={`statusGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                            <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={enrichedStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        cornerRadius={8}
                        animationBegin={0}
                        animationDuration={1200}
                      >
                        {enrichedStatusData.map((entry: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`url(#statusGradient-${index})`} 
                            strokeWidth={0}
                            className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Label */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <p className="text-4xl font-bold text-gray-900 dark:text-white">{statusTotal}</p>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">Total Items</p>
                  </div>
                </div>
                {/* Custom Legend */}
                <div className="grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                  {enrichedStatusData.map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all cursor-pointer group">
                      <div 
                        className="w-4 h-4 rounded-full shadow-sm ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 group-hover:ring-opacity-50 transition-all" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex-1 font-medium">{item.name}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyChartState title="No items in inventory" />
            )}
          </CardContent>
        </div>
      </div>

      {/* Row 2: Daily Usage Reports & Student Activity & Category */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Daily Usage Reports - Line Chart */}
        <div className="dashboard-card animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-3">
              <div className="icon-container green h-10 w-10 rounded-xl flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <span className="text-gray-900 dark:text-white">Daily Usage</span>
                <p className="text-xs font-normal text-muted-foreground mt-0.5">Last 7 days report</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {effectiveDailyUsage.length > 0 ? (
              <>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={effectiveDailyUsage} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                      <XAxis 
                        dataKey="shortName" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6b7280', fontSize: 11 }} 
                        width={30} 
                        domain={[0, 'auto']}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="checkouts"
                        stroke="#22c55e"
                        strokeWidth={3}
                        fill="url(#dailyGradient)"
                        name="Checkouts"
                        animationDuration={1000}
                        dot={{ fill: '#22c55e', r: 4, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="returns" 
                        stroke="#3b82f6" 
                        strokeWidth={2.5}
                        dot={{ fill: '#3b82f6', r: 3, strokeWidth: 2, stroke: '#fff' }}
                        name="Returns"
                        animationDuration={1000}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                    <span className="text-xs font-medium text-gray-500">Checkouts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" />
                    <span className="text-xs font-medium text-gray-500">Returns</span>
                  </div>
                </div>
              </>
            ) : (
              <EmptyChartState title="No usage data this week" />
            )}
          </CardContent>
        </div>

        {/* Student Activity by Department - Bar Chart */}
        <div className="dashboard-card animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-3">
              <div className="icon-container purple h-10 w-10 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <span className="text-gray-900 dark:text-white">Student Activity</span>
                <p className="text-xs font-normal text-muted-foreground mt-0.5">By department</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasChartData(effectiveStudentActivity, ['active', 'borrowed']) ? (
              <>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={effectiveStudentActivity} 
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      barGap={3}
                    >
                      <defs>
                        <linearGradient id="activeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="borrowedGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 500 }} interval={0} angle={-15} textAnchor="end" height={40} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} width={30} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="active" fill="url(#activeGradient)" radius={[4, 4, 0, 0]} name="Active Students" animationDuration={1000} />
                      <Bar dataKey="borrowed" fill="url(#borrowedGradient)" radius={[4, 4, 0, 0]} name="Items Borrowed" animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-violet-500 shadow-sm" />
                    <span className="text-xs font-medium text-gray-500">Active Students</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-sm" />
                    <span className="text-xs font-medium text-gray-500">Items Borrowed</span>
                  </div>
                </div>
              </>
            ) : (
              <EmptyChartState title="No student activity data" />
            )}
          </CardContent>
        </div>

        {/* Category Distribution - Professional Bar Chart */}
        <div className="dashboard-card animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-3">
              <div className="icon-container sky h-10 w-10 rounded-xl flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <span className="text-gray-900 dark:text-white">By Category</span>
                <p className="text-xs font-normal text-muted-foreground mt-0.5">Item distribution</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasChartData(effectiveCategoryDistribution, ['value']) ? (
              <>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={effectiveCategoryDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }} 
                        width={80} 
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar 
                        dataKey="value" 
                        radius={[0, 6, 6, 0]} 
                        name="Items"
                        animationDuration={800}
                        label={{ position: 'right', fill: '#374151', fontSize: 11, fontWeight: 600 }}
                      >
                        {effectiveCategoryDistribution.map((entry: any, index: number) => {
                          const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <EmptyChartState title="No categories with items" />
            )}
          </CardContent>
        </div>
      </div>

      {/* Row 3: Weekly Usage & Maintenance Trends */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly Usage - Enhanced Bar Chart */}
        <div className="dashboard-card animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-3">
                <div className="icon-container amber h-10 w-10 rounded-xl flex items-center justify-center">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-gray-900 dark:text-white">Weekly Usage</span>
                  <p className="text-xs font-normal text-muted-foreground mt-0.5">This week's activity</p>
                </div>
              </CardTitle>
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 font-semibold">
                Current Week
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {hasChartData(effectiveWeeklyUsage, ['value']) ? (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={effectiveWeeklyUsage} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weeklyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                        <stop offset="50%" stopColor="#fbbf24" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#fcd34d" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }} 
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} width={30} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="value" 
                      fill="url(#weeklyGradient)" 
                      radius={[8, 8, 0, 0]} 
                      name="Requests"
                      animationDuration={800}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChartState title="No weekly activity data" />
            )}
          </CardContent>
        </div>

        {/* Maintenance Trends - Stacked Bar Chart */}
        <div className="dashboard-card animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-3">
                <div className="icon-container red h-10 w-10 rounded-xl flex items-center justify-center">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-gray-900 dark:text-white">Maintenance</span>
                  <p className="text-xs font-normal text-muted-foreground mt-0.5">Trends over time</p>
                </div>
              </CardTitle>
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 font-semibold">
                Last 6 Months
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {effectiveMaintenanceTrends.length > 0 ? (
              <>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={effectiveMaintenanceTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="pendingGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="inProgressGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6b7280', fontSize: 11 }} 
                        width={30}
                        domain={[0, 'auto']}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar 
                        dataKey="completed" 
                        stackId="a" 
                        fill="url(#completedGradient)" 
                        radius={[0, 0, 0, 0]} 
                        name="Completed"
                        animationDuration={1000}
                      />
                      <Bar 
                        dataKey="pending" 
                        stackId="a" 
                        fill="url(#pendingGradient)" 
                        radius={[0, 0, 0, 0]} 
                        name="Pending"
                        animationDuration={1000}
                      />
                      <Bar 
                        dataKey="inProgress" 
                        stackId="a" 
                        fill="url(#inProgressGradient)" 
                        radius={[6, 6, 0, 0]} 
                        name="In Progress"
                        animationDuration={1000}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500 shadow-sm" />
                    <span className="text-xs font-medium text-gray-500">Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-amber-500 shadow-sm" />
                    <span className="text-xs font-medium text-gray-500">Pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-500 shadow-sm" />
                    <span className="text-xs font-medium text-gray-500">In Progress</span>
                  </div>
                </div>
              </>
            ) : (
              <EmptyChartState title="No maintenance records" />
            )}
          </CardContent>
        </div>
      </div>
    </div>
  );
}
