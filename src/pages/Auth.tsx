import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  FlaskConical,
  Mail,
  Lock,
  User,
  Building2,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  Hash,
  Loader2,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

type AuthMode = "login" | "register" | "verify" | "forgot_password";

// Validation schemas
const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character",
  );

interface Department {
  id: string;
  name: string;
}

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    registerNumber: "",
    department: "",
    phone: "",
    collegeName: "",
    address: "",
  });

  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  // --- OAuth Sign-In ---
  const handleOAuthSignIn = async (provider: "google" | "azure") => {
    setOauthLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth?confirmed=true`,
          queryParams: provider === "azure" ? { prompt: "select_account" } : {},
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "OAuth Error",
        description:
          err.message ||
          `Failed to sign in with ${provider === "azure" ? "Microsoft" : "Google"}`,
      });
      setOauthLoading(null);
    }
  };

  // NOTE: setup-admin call removed for security — it should only be run
  // manually via CLI or admin panel with the SETUP_SECRET header.

  // Fetch departments for registration
  useEffect(() => {
    const fetchDepartments = async () => {
      const { data } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true);

      if (data) {
        setDepartments(data);
      }
    };
    fetchDepartments();
  }, []);

  // Handle email confirmation callback
  useEffect(() => {
    const handleEmailConfirmation = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const confirmed = urlParams.get("confirmed");

      if (confirmed === "true" && user) {
        // User just confirmed their email, activate their profile
        const { error } = await supabase
          .from("profiles")
          .update({
            is_verified: true,
            is_active: true,
          })
          .eq("id", user.id);

        if (!error) {
          toast({
            title: "Email Verified! ✅",
            description: "Your account is now active. Welcome to LabLink!",
          });
          // Clean up URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        }
      }
    };

    handleEmailConfirmation();
  }, [user]);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = urlParams.get("redirect");
      navigate(redirectTo || "/dashboard");
    }
  }, [user, loading, navigate]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const emailResult = emailSchema.safeParse(formData.email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(formData.password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    if (mode === "register") {
      if (!formData.fullName.trim()) {
        newErrors.fullName = "Full name is required";
      }
      if (!formData.registerNumber.trim()) {
        newErrors.registerNumber = "Register number is required";
      }
      if (!formData.department) {
        newErrors.department = "Please select a department";
      }
      if (!formData.collegeName.trim()) {
        newErrors.collegeName = "College name is required";
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords don't match";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const sendVerificationOTP = async (email: string, name: string) => {
    const otpCode = generateOTP();

    // Store OTP via rate-limited SECURITY DEFINER function
    const { error: otpError } = await supabase.rpc("create_otp", {
      p_email: email,
      p_otp: otpCode,
    });

    if (otpError) {
      console.error("OTP create error:", otpError);
      if (
        otpError.message?.includes("rate") ||
        otpError.message?.includes("Too many")
      ) {
        throw new Error("Too many OTP requests. Please wait a few minutes.");
      }
      throw new Error("Failed to generate OTP");
    }

    // Send OTP email
    const { data, error: emailError } = await supabase.functions.invoke(
      "send-email",
      {
        body: {
          type: "verification",
          to: email,
          name,
          otp: otpCode,
        },
      },
    );

    if (emailError) {
      throw new Error(
        "Failed to send verification email: " + emailError.message,
      );
    }

    if (data && !data.success) {
      throw new Error(data.error || "Failed to send verification email");
    }
  };

  const verifyOTP = async () => {
    setIsLoading(true);

    try {
      // Verify OTP via SECURITY DEFINER function (no direct table access)
      const { data: verifyResult, error: verifyError } = await supabase.rpc(
        "verify_otp",
        { p_email: pendingEmail, p_otp: otp },
      );

      if (verifyError || !(verifyResult as any)?.valid) {
        toast({
          variant: "destructive",
          title: "Invalid OTP",
          description:
            (verifyResult as any)?.error ||
            "The OTP is invalid or has expired. Please try again.",
        });
        setIsLoading(false);
        return;
      }

      // Now create the user account
      const redirectUrl = `${window.location.origin}/auth`;

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: pendingEmail,
          password: formData.password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: formData.fullName,
              phone: formData.phone || null,
              address: formData.address || null,
              college_name: formData.collegeName,
              department_id: formData.department,
              register_number: formData.registerNumber,
            },
          },
        });

      if (signUpError) {
        throw signUpError;
      }

      // Update profile with register number and set as verified
      if (signUpData.user) {
        await supabase
          .from("profiles")
          .update({
            register_number: formData.registerNumber,
            college_name: formData.collegeName,
            phone: formData.phone || null,
            is_verified: true,
            is_active: true,
          })
          .eq("id", signUpData.user.id);
      }

      // Send credentials email to student from lablink83@gmail.com
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "credentials",
            to: pendingEmail,
            name: formData.fullName,
            email: pendingEmail,
            password: formData.password,
          },
        });
      } catch (emailError) {
        console.log("Credentials email may not have been sent:", emailError);
        // Don't fail registration if email fails
      }

      toast({
        title: "Registration Successful!",
        description:
          "Your account has been created. Login credentials have been sent to your email. You can now log in.",
      });

      setMode("login");
      setFormData({
        email: "",
        password: "",
        confirmPassword: "",
        fullName: "",
        registerNumber: "",
        department: "",
        phone: "",
        collegeName: "",
        address: "",
      });
      setOtp("");
      setPendingEmail("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message || "An error occurred during verification.",
      });
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailResult = emailSchema.safeParse(forgotPasswordEmail);
    if (!emailResult.success) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: emailResult.error.errors[0].message,
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotPasswordEmail,
        {
          redirectTo: `${window.location.origin}/auth?reset=true`,
        },
      );

      if (error) throw error;

      toast({
        title: "Reset Email Sent! 📧",
        description: "Check your email for a password reset link.",
      });
      setMode("login");
      setForgotPasswordEmail("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send reset email.",
      });
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "verify") {
      await verifyOTP();
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              variant: "destructive",
              title: "Login Failed",
              description: "Invalid email or password. Please try again.",
            });
          } else if (error.message.includes("Email not confirmed")) {
            toast({
              variant: "destructive",
              title: "Email Not Verified",
              description: "Please verify your email before logging in.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Login Failed",
              description: error.message,
            });
          }
          setIsLoading(false);
          return;
        }

        // Log login time
        const {
          data: { user: loggedInUser },
        } = await supabase.auth.getUser();
        if (loggedInUser) {
          await supabase.from("login_logs").insert({
            user_id: loggedInUser.id,
            login_time: new Date().toISOString(),
          });
        }

        toast({
          title: "Welcome back!",
          description: "Login successful. Redirecting...",
        });
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get("redirect");
        navigate(redirectTo || "/dashboard");
      } else {
        // Registration - first check if email already exists
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("email")
          .eq("email", formData.email)
          .maybeSingle();

        if (existingUser) {
          toast({
            variant: "destructive",
            title: "Registration Failed",
            description: "An account with this email already exists.",
          });
          setIsLoading(false);
          return;
        }

        // Use Supabase built-in email confirmation
        const redirectUrl = `${window.location.origin}/auth?confirmed=true`;

        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
              emailRedirectTo: redirectUrl,
              data: {
                full_name: formData.fullName,
                phone: formData.phone || null,
                address: formData.address || null,
                college_name: formData.collegeName,
                department_id: formData.department,
                register_number: formData.registerNumber,
              },
            },
          });

        if (signUpError) {
          throw signUpError;
        }

        // Update profile with register number (will be pending until email confirmed)
        if (signUpData.user) {
          await supabase
            .from("profiles")
            .update({
              register_number: formData.registerNumber,
              college_name: formData.collegeName,
              phone: formData.phone || null,
              is_verified: false,
              is_active: false,
            })
            .eq("id", signUpData.user.id);
        }

        // Check if email confirmation is required
        if (signUpData.user && !signUpData.session) {
          // Email confirmation required
          toast({
            title: "Check Your Email! 📧",
            description:
              "We've sent a confirmation link to your email. Please click it to activate your account.",
          });
        } else {
          // No email confirmation needed (or already confirmed)
          toast({
            title: "Registration Successful!",
            description: "Your account has been created. You can now log in.",
          });
        }

        setMode("login");
        setFormData({
          email: "",
          password: "",
          confirmPassword: "",
          fullName: "",
          registerNumber: "",
          department: "",
          phone: "",
          collegeName: "",
          address: "",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An unexpected error occurred.",
      });
    }

    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-secondary/95 to-primary/20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-secondary/95 to-primary/20">
      <div className="flex min-h-screen">
        {/* Left Panel - Branding */}
        <div className="hidden w-1/2 flex-col justify-between p-12 lg:flex">
          <div>
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl overflow-hidden shadow-lg shadow-blue-500/30">
                <img
                  src="/lablink-logo.jpg"
                  alt="LabLink"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-2xl font-bold text-secondary-foreground">
                  LabLink
                </span>
                <span className="text-xs text-blue-400 -mt-1 tracking-wider">
                  LAB SMART
                </span>
              </div>
            </Link>
          </div>

          <div className="space-y-6">
            <h1 className="font-display text-4xl font-bold leading-tight text-secondary-foreground">
              Digital Laboratory
              <br />
              <span className="text-primary">Inventory Management</span>
            </h1>
            <p className="max-w-md text-lg text-secondary-foreground/70">
              Streamline your lab operations with real-time inventory tracking,
              QR-based management, and comprehensive analytics.
            </p>
            <div className="flex gap-4">
              <div className="rounded-lg bg-background/10 p-4 backdrop-blur">
                <p className="text-3xl font-bold text-secondary-foreground">
                  2,450+
                </p>
                <p className="text-sm text-secondary-foreground/70">
                  Items Managed
                </p>
              </div>
              <div className="rounded-lg bg-background/10 p-4 backdrop-blur">
                <p className="text-3xl font-bold text-secondary-foreground">
                  99.9%
                </p>
                <p className="text-sm text-secondary-foreground/70">Uptime</p>
              </div>
              <div className="rounded-lg bg-background/10 p-4 backdrop-blur">
                <p className="text-3xl font-bold text-secondary-foreground">
                  500+
                </p>
                <p className="text-sm text-secondary-foreground/70">
                  Active Users
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-secondary-foreground/50">
              © 2025 LabLink. Enterprise Lab Management Solution.
            </p>
            <p className="text-xs text-secondary-foreground/40">
              A <span className="text-blue-400">LabLink Solution</span> by{" "}
              <span className="text-orange-400">Alphax Heros</span>
            </p>
          </div>
        </div>

        {/* Right Panel - Auth Form */}
        <div className="flex w-full items-center justify-center p-6 lg:w-1/2 lg:bg-background">
          <Card className="w-full max-w-md border-0 shadow-2xl lg:border">
            <CardHeader className="space-y-1 text-center">
              <div className="mb-4 flex flex-col items-center lg:hidden">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl overflow-hidden shadow-lg shadow-blue-500/30">
                  <img
                    src="/lablink-logo.jpg"
                    alt="LabLink"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col items-center mt-2">
                  <span className="font-display text-xl font-bold">
                    LabLink
                  </span>
                  <span className="text-xs text-blue-500 -mt-0.5 tracking-wider">
                    LAB SMART
                  </span>
                </div>
              </div>
              <CardTitle className="font-display text-2xl">
                {mode === "login"
                  ? "Welcome Back"
                  : mode === "verify"
                    ? "Verify Email"
                    : mode === "forgot_password"
                      ? "Reset Password"
                      : "Create Account"}
              </CardTitle>
              <CardDescription>
                {mode === "login"
                  ? "Enter your credentials to access your account"
                  : mode === "verify"
                    ? `Enter the 6-digit code sent to ${pendingEmail}`
                    : mode === "forgot_password"
                      ? "Enter your email to receive a password reset link"
                      : "Register as a student to start using LabLink"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* OAuth Buttons — login mode only */}
              {mode === "login" && (
                <div className="space-y-3 mb-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full gap-3 h-11"
                    disabled={!!oauthLoading}
                    onClick={() => handleOAuthSignIn("google")}
                  >
                    {oauthLoading === "google" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                    )}
                    Continue with Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full gap-3 h-11"
                    disabled={!!oauthLoading}
                    onClick={() => handleOAuthSignIn("azure")}
                  >
                    {oauthLoading === "azure" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <svg viewBox="0 0 23 23" className="h-5 w-5">
                        <path fill="#f35325" d="M1 1h10v10H1z" />
                        <path fill="#81bc06" d="M12 1h10v10H12z" />
                        <path fill="#05a6f0" d="M1 12h10v10H1z" />
                        <path fill="#ffba08" d="M12 12h10v10H12z" />
                      </svg>
                    )}
                    Continue with Microsoft
                  </Button>

                  <div className="relative my-3">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
                      or continue with email
                    </span>
                  </div>
                </div>
              )}
              {mode === "forgot_password" ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgotEmail">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="forgotEmail"
                        type="email"
                        placeholder="Enter your email"
                        className="pl-10"
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Back to login
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "verify" ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="otp">Verification Code</Label>
                        <Input
                          id="otp"
                          name="otp"
                          placeholder="Enter 6-digit code"
                          className="text-center text-2xl tracking-widest"
                          value={otp}
                          onChange={(e) =>
                            setOtp(
                              e.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          maxLength={6}
                        />
                      </div>
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full bg-primary hover:bg-primary/90"
                        disabled={isLoading || otp.length !== 6}
                      >
                        {isLoading ? "Verifying..." : "Verify & Create Account"}
                      </Button>
                      <p className="text-center text-sm text-muted-foreground">
                        Didn't receive the code?{" "}
                        <button
                          type="button"
                          onClick={() =>
                            sendVerificationOTP(pendingEmail, formData.fullName)
                          }
                          className="font-medium text-primary hover:underline"
                        >
                          Resend
                        </button>
                      </p>
                      <button
                        type="button"
                        onClick={() => setMode("register")}
                        className="w-full text-sm text-muted-foreground hover:text-foreground"
                      >
                        ← Back to registration
                      </button>
                    </div>
                  ) : (
                    <>
                      {mode === "register" && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name *</Label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="fullName"
                                name="fullName"
                                placeholder="Enter your full name"
                                className={`pl-10 ${errors.fullName ? "border-destructive" : ""}`}
                                value={formData.fullName}
                                onChange={handleInputChange}
                              />
                            </div>
                            {errors.fullName && (
                              <p className="text-sm text-destructive">
                                {errors.fullName}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="registerNumber">
                              Register Number *
                            </Label>
                            <div className="relative">
                              <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="registerNumber"
                                name="registerNumber"
                                placeholder="Enter your register number"
                                className={`pl-10 ${errors.registerNumber ? "border-destructive" : ""}`}
                                value={formData.registerNumber}
                                onChange={handleInputChange}
                              />
                            </div>
                            {errors.registerNumber && (
                              <p className="text-sm text-destructive">
                                {errors.registerNumber}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="department">Department *</Label>
                            <div className="relative">
                              <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <select
                                id="department"
                                name="department"
                                aria-label="Select Department"
                                className={`flex h-11 w-full rounded-lg border-2 border-input bg-background px-4 py-2 pl-10 text-sm transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${errors.department ? "border-destructive" : ""}`}
                                value={formData.department}
                                onChange={handleInputChange}
                              >
                                <option value="">Select Department</option>
                                {departments.map((dept) => (
                                  <option key={dept.id} value={dept.id}>
                                    {dept.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {errors.department && (
                              <p className="text-sm text-destructive">
                                {errors.department}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="collegeName">College Name *</Label>
                            <div className="relative">
                              <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="collegeName"
                                name="collegeName"
                                placeholder="Enter your college name"
                                className={`pl-10 ${errors.collegeName ? "border-destructive" : ""}`}
                                value={formData.collegeName}
                                onChange={handleInputChange}
                              />
                            </div>
                            {errors.collegeName && (
                              <p className="text-sm text-destructive">
                                {errors.collegeName}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="phone">
                              Phone Number (Optional)
                            </Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="phone"
                                name="phone"
                                type="tel"
                                placeholder="Enter phone number"
                                className="pl-10"
                                value={formData.phone}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="Enter your email"
                            className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                            value={formData.email}
                            onChange={handleInputChange}
                          />
                        </div>
                        {errors.email && (
                          <p className="text-sm text-destructive">
                            {errors.email}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            className={`pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
                            value={formData.password}
                            onChange={handleInputChange}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {errors.password && (
                          <p className="text-sm text-destructive">
                            {errors.password}
                          </p>
                        )}
                        {mode === "register" && (
                          <p className="text-xs text-muted-foreground">
                            Min 8 chars, with uppercase, lowercase, number &
                            special character
                          </p>
                        )}
                      </div>

                      {mode === "register" && (
                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">
                            Confirm Password *
                          </Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="confirmPassword"
                              name="confirmPassword"
                              type={showPassword ? "text" : "password"}
                              placeholder="Confirm your password"
                              className={`pl-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
                              value={formData.confirmPassword}
                              onChange={handleInputChange}
                            />
                          </div>
                          {errors.confirmPassword && (
                            <p className="text-sm text-destructive">
                              {errors.confirmPassword}
                            </p>
                          )}
                        </div>
                      )}

                      {mode === "login" && (
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => setMode("forgot_password")}
                            className="text-sm text-primary hover:underline"
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}

                      <Button
                        type="submit"
                        size="lg"
                        className="w-full bg-primary hover:bg-primary/90"
                        disabled={isLoading}
                      >
                        {isLoading
                          ? "Please wait..."
                          : mode === "login"
                            ? "Sign In"
                            : "Continue"}
                      </Button>

                      <p className="text-center text-sm text-muted-foreground">
                        {mode === "login" ? (
                          <>
                            Don't have an account?{" "}
                            <button
                              type="button"
                              onClick={() => setMode("register")}
                              className="font-medium text-primary hover:underline"
                            >
                              Register as Student
                            </button>
                          </>
                        ) : (
                          <>
                            Already have an account?{" "}
                            <button
                              type="button"
                              onClick={() => setMode("login")}
                              className="font-medium text-primary hover:underline"
                            >
                              Sign In
                            </button>
                          </>
                        )}
                      </p>
                    </>
                  )}
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
