import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FlaskConical,
  QrCode,
  Package,
  Users,
  BarChart3,
  Shield,
  Zap,
  CheckCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: QrCode,
    title: "QR-Based Tracking",
    description:
      "Instant item identification with secure QR codes. Scan to issue, return, or view item details in seconds.",
  },
  {
    icon: Package,
    title: "Smart Inventory",
    description:
      "Real-time stock levels, automated low-stock alerts, and comprehensive item lifecycle management.",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    description:
      "Granular permissions for Admin, Staff, Students, and Technicians. Secure and audit-compliant.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description:
      "Data-driven insights with beautiful dashboards. Track usage patterns, generate reports, predict needs.",
  },
  {
    icon: Shield,
    title: "Chemical Safety",
    description:
      "Track expiry dates, hazard levels, and safety requirements. Automated compliance alerts.",
  },
  {
    icon: Zap,
    title: "Instant Workflows",
    description:
      "Streamlined borrow/return processes. Approve requests, track maintenance, all in real-time.",
  },
];

const stats = [
  { value: "99.9%", label: "Uptime Guarantee" },
  { value: "2,450+", label: "Items Managed" },
  { value: "500+", label: "Active Users" },
  { value: "60%", label: "Time Saved" },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 rounded-xl opacity-75 group-hover:opacity-100 blur-sm transition-opacity"></div>
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-white">
                <img
                  src="/lablink-logo.jpg"
                  alt="LabLink"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                LabLink
              </span>
              <span className="text-[10px] text-blue-500 -mt-1 tracking-wider font-medium">
                LAB SMART
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/catalog">
              <Button variant="ghost">Browse Catalog</Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button variant="hero">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20">
        {/* Background Elements */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-2">
            <Sparkles className="mr-2 h-4 w-4" />
            Enterprise Lab Management Solution
          </Badge>

          <h1 className="mx-auto max-w-4xl font-display text-5xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
            Digital Laboratory
            <br />
            <span className="text-gradient">Inventory Management</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Modernize your lab operations with real-time inventory tracking,
            QR-based management, and comprehensive analytics. Built for
            educational institutions and research facilities.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/catalog">
              <Button variant="hero" size="xl">
                Browse Equipment Catalog
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" size="xl">
                Get Started Free
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-4xl font-bold text-primary">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <Badge variant="default" className="mb-4">
              Features
            </Badge>
            <h2 className="font-display text-3xl font-bold md:text-4xl">
              Everything You Need to Manage Your Lab
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              A complete suite of tools designed specifically for laboratory
              inventory management, built with modern technology and intuitive
              design.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} hover className="group">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary">
                    <feature.icon className="h-6 w-6 text-primary transition-colors group-hover:text-white" />
                  </div>
                  <h3 className="font-display text-lg font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-secondary to-primary/80">
            <CardContent className="p-12 text-center">
              <h2 className="font-display text-3xl font-bold text-white md:text-4xl">
                Ready to Modernize Your Lab?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/80">
                Join hundreds of institutions already using LabLink to
                streamline their laboratory operations.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link to="/auth">
                  <Button variant="glass" size="xl">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-white/70">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" /> Free 14-day trial
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" /> No credit card required
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" /> Enterprise-grade security
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-gradient-to-b from-background to-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-8">
            {/* Logo and Company Info */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 rounded-xl opacity-60 blur-sm"></div>
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden bg-white shadow-lg">
                    <img
                      src="/lablink-logo.jpg"
                      alt="LabLink"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                    LabLink
                  </span>
                  <span className="text-xs text-blue-500 -mt-0.5 tracking-wider font-medium">
                    LAB SMART
                  </span>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground max-w-md">
                Enterprise Lab Management Solution - Streamlining laboratory
                operations with cutting-edge technology.
              </p>
            </div>

            {/* Divider */}
            <div className="w-full max-w-xs h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>

            {/* Copyright and Credits */}
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">
                © 2025 LabLink. All rights reserved.
              </p>
              <p className="text-xs text-muted-foreground/70">
                A{" "}
                <span className="font-semibold text-blue-500">
                  LabLink Solution
                </span>{" "}
                by{" "}
                <span className="font-semibold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                  Alphax Heros
                </span>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
