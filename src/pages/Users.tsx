import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  UserPlus,
  Search,
  Filter,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Shield,
  Users,
  UserCheck,
  UserX,
  Loader2,
  Edit,
  Trash2,
  Send,
  RefreshCcw,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react";
import { generateMembersPDF, generateMembersExcel, MemberReportRow } from "@/lib/reportExports";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/components/auth/ProtectedRoute";
import { EditUserDialog } from "@/components/users/EditUserDialog";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  college_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_default_admin: boolean;
  created_at: string;
  staff_id: string | null;
  register_number: string | null;
  role?: string;
}

interface Department {
  id: string;
  name: string;
}

const roleColors: Record<string, string> = {
  admin: "bg-danger/10 text-danger border-danger/20",
  staff: "bg-primary/10 text-primary border-primary/20",
  technician: "bg-warning/10 text-warning border-warning/20",
  student: "bg-success/10 text-success border-success/20",
};

export default function UsersPage() {
  const { userRole } = useUserRole();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [sendingEmailUserId, setSendingEmailUserId] = useState<string | null>(null);
  
  // Edit user state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // New user form state
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "staff" as "admin" | "staff" | "technician",
    department_id: "",
    staff_id: "",
  });

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  async function fetchUsers() {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for each user
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) || []);

      const usersWithRoles = profiles?.map((profile) => ({
        ...profile,
        role: roleMap.get(profile.id) || "student",
      })) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function fetchDepartments() {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true);

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  }

  async function handleCreateUser() {
    if (!newUser.email || !newUser.password || !newUser.full_name) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (newUser.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          phone: newUser.phone || null,
          role: newUser.role,
          department_id: newUser.department_id || null,
          staff_id: newUser.staff_id || null,
        },
      });

      if (error) {
        console.error("Function invoke error:", error);
        throw new Error(error.message || "Failed to send request to server");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Failed to create user");
      }

      toast.success(`${newUser.role.charAt(0).toUpperCase() + newUser.role.slice(1)} account created successfully`);
      setIsCreateDialogOpen(false);
      setNewUser({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        role: "staff",
        department_id: "",
        staff_id: "",
      });
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleActive(userId: string, currentStatus: boolean) {
    // Optimistic update
    const previousUsers = [...users];
    setUsers(users.map(u => 
      u.id === userId ? { ...u, is_active: !currentStatus } : u
    ));

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !currentStatus })
        .eq("id", userId);

      if (error) throw error;

      toast.success(`User ${currentStatus ? "deactivated" : "activated"} successfully`);
    } catch (error) {
      console.error("Error updating user:", error);
      setUsers(previousUsers); // Rollback
      toast.error("Failed to update user status");
    }
  }

  async function handleVerifyUser(userId: string) {
    // Optimistic update
    const previousUsers = [...users];
    setUsers(users.map(u => 
      u.id === userId ? { ...u, is_verified: true, is_active: true } : u
    ));

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: true, is_active: true })
        .eq("id", userId);

      if (error) throw error;

      toast.success("User verified and activated successfully");
    } catch (error) {
      console.error("Error verifying user:", error);
      setUsers(previousUsers); // Rollback
      toast.error("Failed to verify user");
    }
  }

  async function handleUpdateRole(userId: string, newRole: "admin" | "staff" | "student" | "technician") {
    // Optimistic update
    const previousUsers = [...users];
    setUsers(users.map(u => 
      u.id === userId ? { ...u, role: newRole } : u
    ));

    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("User role updated successfully");
    } catch (error) {
      console.error("Error updating role:", error);
      setUsers(previousUsers); // Rollback
      toast.error("Failed to update user role");
    }
  }

  async function handleDeleteUser(userId: string, userName: string) {
    if (!confirm(`Are you sure you want to permanently delete ${userName}? This action cannot be undone.`)) {
      return;
    }

    // Set loading state
    setDeletingUserId(userId);
    
    // Optimistic update - remove from UI immediately
    const previousUsers = [...users];
    setUsers(users.filter(u => u.id !== userId));

    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId },
      });

      if (error) {
        console.error("Delete user error:", error);
        throw new Error(error.message || "Failed to delete user");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Failed to delete user");
      }

      toast.success(data.message || "User deleted successfully");
    } catch (error: any) {
      console.error("Error deleting user:", error);
      // Rollback - restore user to list on error
      setUsers(previousUsers);
      toast.error(error.message || "Failed to delete user. Please try again.");
    } finally {
      setDeletingUserId(null);
    }
  }

  function handleOpenEditDialog(user: UserProfile) {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  }

  async function handleSendConfirmationEmail(userId: string, userEmail: string, userName: string) {
    setSendingEmailUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "confirmation",
          to: userEmail,
          name: userName,
          confirmationLink: `${window.location.origin}/auth?confirm=true&email=${encodeURIComponent(userEmail)}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast.success("Confirmation email sent successfully");
      } else {
        throw new Error(data?.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send confirmation email");
    } finally {
      setSendingEmailUserId(null);
    }
  }


  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    admins: users.filter((u) => u.role === "admin").length,
    staff: users.filter((u) => u.role === "staff").length,
    technicians: users.filter((u) => u.role === "technician").length,
    students: users.filter((u) => u.role === "student").length,
  };

  const handleExport = async (exportType: 'pdf' | 'excel') => {
    if (filteredUsers.length === 0) {
      toast.error("No users to export");
      return;
    }

    setIsExporting(true);
    try {
      const exportData: MemberReportRow[] = filteredUsers.map(user => ({
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone || '',
        role: user.role || 'student',
        department: '',
        college: user.college_name || '',
        isActive: user.is_active,
        isVerified: user.is_verified,
        createdAt: user.created_at,
        lastLogin: '',
      }));

      const filters = {
        memberType: roleFilter !== 'all' ? roleFilter as 'student' | 'staff' | 'technician' : 'all',
      };

      if (exportType === 'pdf') {
        generateMembersPDF(exportData, filters as any);
      } else {
        generateMembersExcel(exportData, filters as any);
      }

      toast.success(`Users exported as ${exportType.toUpperCase()} successfully.`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export users. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout title="User Management" subtitle="Manage all users, staff, and technicians" userRole={(userRole as "admin" | "staff" | "student" | "technician") || "admin"}>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <UserCheck className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <Shield className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Staff & Technicians</p>
                <p className="text-2xl font-bold">{stats.staff + stats.technicians}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
                <Building2 className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Students</p>
                <p className="text-2xl font-bold">{stats.students}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Card */}
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>All Users</CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-9 w-full sm:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={isExporting || filteredUsers.length === 0}>
                    {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    Export
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('pdf')}>
                    <FileText className="h-4 w-4 mr-2" /> Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('excel')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Export as Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Add a new staff member, technician, or admin account.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="role">Role *</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value: "admin" | "staff" | "technician") =>
                          setNewUser({ ...newUser, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="technician">Technician</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="full_name">Full Name *</Label>
                      <Input
                        id="full_name"
                        value={newUser.full_name}
                        onChange={(e) =>
                          setNewUser({ ...newUser, full_name: e.target.value })
                        }
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) =>
                          setNewUser({ ...newUser, email: e.target.value })
                        }
                        placeholder="user@example.com"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) =>
                          setNewUser({ ...newUser, password: e.target.value })
                        }
                        placeholder="Min 8 characters"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="staff_id">Staff ID</Label>
                      <Input
                        id="staff_id"
                        value={newUser.staff_id}
                        onChange={(e) =>
                          setNewUser({ ...newUser, staff_id: e.target.value })
                        }
                        placeholder="E.g., STF001"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={newUser.phone}
                        onChange={(e) =>
                          setNewUser({ ...newUser, phone: e.target.value })
                        }
                        placeholder="Phone number"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="department">Department</Label>
                      <Select
                        value={newUser.department_id}
                        onValueChange={(value) =>
                          setNewUser({ ...newUser, department_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateUser} disabled={isCreating}>
                      {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create User
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden md:table-cell">Contact</TableHead>
                      <TableHead className="hidden lg:table-cell">ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                <span className="text-sm font-semibold text-primary">
                                  {user.full_name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{user.full_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={roleColors[user.role || "student"]}
                            >
                              {user.role || "student"}
                            </Badge>
                            {user.is_default_admin && (
                              <Badge variant="secondary" className="ml-2">
                                Default
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="space-y-1">
                              {user.phone && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {user.phone}
                                </div>
                              )}
                              {user.college_name && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Building2 className="h-3 w-3" />
                                  {user.college_name}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {user.staff_id || user.register_number || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {!user.is_verified ? (
                              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Pending</Badge>
                            ) : user.is_active ? (
                              <Badge variant="available">Active</Badge>
                            ) : (
                              <Badge variant="destructive">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleOpenEditDialog(user)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleSendConfirmationEmail(user.id, user.email, user.full_name)}
                                  disabled={sendingEmailUserId === user.id}
                                >
                                  {sendingEmailUserId === user.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Mail className="mr-2 h-4 w-4" />
                                  )}
                                  {sendingEmailUserId === user.id ? "Sending..." : "Send Confirmation Email"}
                                </DropdownMenuItem>
                                {!user.is_default_admin && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {!user.is_verified && (
                                      <DropdownMenuItem
                                        onClick={() => handleVerifyUser(user.id)}
                                        className="text-success"
                                      >
                                        <UserCheck className="mr-2 h-4 w-4" />
                                        Verify Account
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleToggleActive(user.id, user.is_active)
                                      }
                                    >
                                      {user.is_active ? (
                                        <>
                                          <UserX className="mr-2 h-4 w-4" />
                                          Deactivate
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="mr-2 h-4 w-4" />
                                          Activate
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteUser(user.id, user.full_name)}
                                      className="text-destructive focus:text-destructive"
                                      disabled={deletingUserId === user.id}
                                    >
                                      {deletingUserId === user.id ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="mr-2 h-4 w-4" />
                                      )}
                                      {deletingUserId === user.id ? "Deleting..." : "Delete Account"}
                                    </DropdownMenuItem>
                                  </>

                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit User Dialog */}
      <EditUserDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingUser(null);
        }}
        user={editingUser}
        departments={departments}
        onSuccess={fetchUsers}
      />
    </DashboardLayout>
  );
}