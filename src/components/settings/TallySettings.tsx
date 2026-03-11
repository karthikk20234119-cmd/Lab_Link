import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Save,
  Plug,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import {
  getTallyConfig,
  saveTallyConfig,
  testTallyConnection,
  type TallyConfig,
} from "@/services/tallyService";

export function TallySettings() {
  const [config, setConfig] = useState<TallyConfig>({
    host: "localhost",
    port: 9000,
    company_name: "",
    is_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [connectionMessage, setConnectionMessage] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const existingConfig = await getTallyConfig();
      if (existingConfig) {
        setConfig(existingConfig);
      }
    } catch (err) {
      console.error("Failed to load Tally config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await saveTallyConfig(config);
      if (success) {
        toast.success("Tally configuration saved!");
      } else {
        toast.error("Failed to save configuration");
      }
    } catch (err) {
      toast.error("Error saving configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setConnectionStatus("idle");
    setConnectionMessage("");
    try {
      const result = await testTallyConnection(config);
      setConnectionStatus(result.success ? "success" : "error");
      setConnectionMessage(result.message);
      if (result.success) {
        toast.success("Connected to TallyPrime!");
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      setConnectionStatus("error");
      setConnectionMessage(err.message || "Connection failed");
      toast.error("Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            TallyPrime Connection
          </CardTitle>
          <CardDescription>
            Configure connection to TallyPrime HTTP server. Ensure TallyPrime is
            running with HTTP server enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-base font-medium">
                Enable Tally Integration
              </Label>
              <p className="text-sm text-muted-foreground">
                Activate TallyPrime sync and voucher creation
              </p>
            </div>
            <Switch
              checked={config.is_enabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, is_enabled: checked })
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tally-host">Host</Label>
              <Input
                id="tally-host"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                placeholder="localhost"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tally-port">Port</Label>
              <Input
                id="tally-port"
                type="number"
                value={config.port}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    port: parseInt(e.target.value) || 9000,
                  })
                }
                placeholder="9000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tally-company">Company Name</Label>
              <Input
                id="tally-company"
                value={config.company_name}
                onChange={(e) =>
                  setConfig({ ...config, company_name: e.target.value })
                }
                placeholder="Your Company Name in Tally"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Configuration
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plug className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          </div>

          {/* Connection Status */}
          {connectionStatus !== "idle" && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 ${
                connectionStatus === "success"
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                  : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
              }`}
            >
              {connectionStatus === "success" ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span className="text-sm">{connectionMessage}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold dark:bg-blue-950 dark:text-blue-400">
              1
            </span>
            <p>
              Open TallyPrime → Press <strong>F1 (Help)</strong> →{" "}
              <strong>Settings</strong> →{" "}
              <strong>Advanced Configuration</strong>
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold dark:bg-blue-950 dark:text-blue-400">
              2
            </span>
            <p>
              Enable <strong>"Allow Remote Access"</strong> and set the{" "}
              <strong>port to 9000</strong> (default)
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold dark:bg-blue-950 dark:text-blue-400">
              3
            </span>
            <p>
              Enter your <strong>Company Name</strong> exactly as it appears in
              TallyPrime
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold dark:bg-blue-950 dark:text-blue-400">
              4
            </span>
            <p>
              Click <strong>"Test Connection"</strong> to verify everything
              works
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
