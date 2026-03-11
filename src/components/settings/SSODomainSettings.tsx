import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield,
  Plus,
  Trash2,
  Globe,
  Loader2,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

interface TrustedDomain {
  id: string;
  domain: string;
  auto_role: string;
  is_active: boolean;
  created_at: string;
  notes: string | null;
  auto_approve: boolean;
  preferred_provider: string | null;
}

export function SSODomainSettings() {
  const { toast } = useToast();
  const [domains, setDomains] = useState<TrustedDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [newRole, setNewRole] = useState("student");
  const [newAutoApprove, setNewAutoApprove] = useState(false);
  const [newProvider, setNewProvider] = useState("any");
  const [newNotes, setNewNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchDomains = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("sso_trusted_domains")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      setDomains((data as any[]) || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    setIsSaving(true);

    const domainClean = newDomain.replace(/^@/, "").trim().toLowerCase();

    const { error } = await supabase.from("sso_trusted_domains").insert({
      domain: domainClean,
      auto_role: newRole,
      is_active: true,
      auto_approve: newAutoApprove,
      preferred_provider: newProvider === "any" ? null : newProvider,
      notes: newNotes.trim() || null,
    } as any);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Domain Added",
        description: `Users with @${domainClean} emails will be auto-verified${newAutoApprove ? " with auto-approved borrows" : ""}.`,
      });
      setNewDomain("");
      setNewNotes("");
      setNewAutoApprove(false);
      setNewProvider("any");
      fetchDomains();
    }
    setIsSaving(false);
  };

  const toggleDomain = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("sso_trusted_domains")
      .update({ is_active: active } as any)
      .eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      setDomains((prev) =>
        prev.map((d) => (d.id === id ? { ...d, is_active: active } : d)),
      );
    }
  };

  const deleteDomain = async (id: string) => {
    if (!confirm("Remove this trusted domain?")) return;
    const { error } = await supabase
      .from("sso_trusted_domains")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Removed",
        description: "Domain removed from trusted list.",
      });
      fetchDomains();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          SSO Domain Whitelist
        </CardTitle>
        <CardDescription>
          Users registering with emails from trusted domains are automatically
          verified and assigned the specified role. Enable auto-approve to skip
          borrow request approval for trusted domain users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Domain */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="e.g. university.edu"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="pl-10"
              onKeyDown={(e) => {
                if (e.key === "Enter") addDomain();
              }}
            />
          </div>
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="technician">Technician</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={addDomain}
            disabled={!newDomain.trim() || isSaving}
            className="gap-1"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </Button>
        </div>

        {/* Extended Options Row */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-approve-new"
              checked={newAutoApprove}
              onCheckedChange={setNewAutoApprove}
            />
            <Label
              htmlFor="auto-approve-new"
              className="text-sm cursor-pointer"
            >
              Auto-approve borrows
            </Label>
          </div>
          <Select value={newProvider} onValueChange={setNewProvider}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="OAuth Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Provider</SelectItem>
              <SelectItem value="google">Google Only</SelectItem>
              <SelectItem value="azure">Microsoft Only</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1 min-w-[200px]">
            <Textarea
              placeholder="Notes (optional, e.g. 'Computer Science dept')…"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="min-h-[36px] h-9 resize-none text-sm py-2"
            />
          </div>
        </div>

        {/* Domains List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : domains.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No trusted domains configured.</p>
            <p className="text-sm">
              Add a domain to enable automatic user verification.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Auto Role</TableHead>
                <TableHead>Auto-Approve</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div>
                      <span className="font-mono font-medium">@{d.domain}</span>
                      {d.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {d.notes}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {d.auto_role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {d.auto_approve ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 gap-1">
                        <ShieldCheck className="h-3 w-3" /> Enabled
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Manual
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.preferred_provider ? (
                      <Badge variant="outline" className="capitalize text-xs">
                        {d.preferred_provider === "azure"
                          ? "Microsoft"
                          : d.preferred_provider}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Any</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={d.is_active}
                      onCheckedChange={(checked) => toggleDomain(d.id, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteDomain(d.id)}
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
