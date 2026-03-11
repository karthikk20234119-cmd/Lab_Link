import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, Shield, CheckCircle2, AlertCircle } from "lucide-react";

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isForced, setIsForced] = useState(false);
  
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: "",
    color: "",
  });

  // Check if this is a forced password change
  useEffect(() => {
    const checkPasswordStatus = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from("profiles")
        .select("password_changed_at, must_change_password")
        .eq("id", user.id)
        .single();
      
      if (data && (data.must_change_password || !data.password_changed_at)) {
        setIsForced(true);
      }
    };
    
    checkPasswordStatus();
  }, [user]);

  // Password strength checker
  useEffect(() => {
    const password = formData.newPassword;
    let score = 0;
    
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];
    const colors = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e", "#10b981"];
    
    setPasswordStrength({
      score,
      label: labels[Math.min(score, 5)],
      color: colors[Math.min(score, 5)],
    });
  }, [formData.newPassword]);

  const validatePassword = () => {
    if (formData.newPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
      });
      return false;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords Don't Match",
        description: "New password and confirmation must match.",
      });
      return false;
    }
    
    if (passwordStrength.score < 3) {
      toast({
        variant: "destructive",
        title: "Weak Password",
        description: "Please use a stronger password with uppercase, lowercase, numbers, and symbols.",
      });
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePassword()) return;
    
    setIsLoading(true);
    
    try {
      // Update password via Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });
      
      if (error) throw error;
      
      // Mark password as changed in profile
      if (user) {
        await supabase
          .from("profiles")
          .update({
            password_changed_at: new Date().toISOString(),
            must_change_password: false,
          })
          .eq("id", user.id);
      }
      
      toast({
        title: "Password Changed! 🔐",
        description: "Your password has been updated successfully.",
      });
      
      // Redirect to dashboard
      navigate("/dashboard");
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to change password.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const requirements = [
    { met: formData.newPassword.length >= 8, text: "At least 8 characters" },
    { met: /[A-Z]/.test(formData.newPassword), text: "One uppercase letter" },
    { met: /[a-z]/.test(formData.newPassword), text: "One lowercase letter" },
    { met: /[0-9]/.test(formData.newPassword), text: "One number" },
    { met: /[^a-zA-Z0-9]/.test(formData.newPassword), text: "One special character" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            {isForced ? "Set New Password" : "Change Password"}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {isForced
              ? "For security, please set a new password to continue."
              : "Update your password to keep your account secure."}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isForced && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-slate-200">
                  Current Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="Enter current password"
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white"
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-slate-200">
                New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  className="pl-10 bg-slate-700/50 border-slate-600 text-white"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Password Strength Bar */}
              {formData.newPassword && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="h-1.5 flex-1 rounded-full transition-all"
                        style={{
                          backgroundColor: i < passwordStrength.score ? passwordStrength.color : "#334155",
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-200">
                Confirm New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  className="pl-10 bg-slate-700/50 border-slate-600 text-white"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Match indicator */}
              {formData.confirmPassword && (
                <div className="flex items-center gap-2 text-xs">
                  {formData.newPassword === formData.confirmPassword ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 text-red-500" />
                      <span className="text-red-500">Passwords don't match</span>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Requirements Checklist */}
            <div className="rounded-lg bg-slate-700/30 p-3 space-y-2">
              <p className="text-xs font-medium text-slate-300">Password Requirements:</p>
              <div className="grid grid-cols-2 gap-1">
                {requirements.map((req, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    {req.met ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <div className="h-3 w-3 rounded-full border border-slate-500" />
                    )}
                    <span className={req.met ? "text-green-400" : "text-slate-400"}>
                      {req.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              disabled={isLoading}
            >
              {isLoading ? "Changing Password..." : "Change Password"}
            </Button>
            
            {!isForced && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-slate-400 hover:text-white"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
