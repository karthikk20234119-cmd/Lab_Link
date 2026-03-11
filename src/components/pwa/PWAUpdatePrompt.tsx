import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, X, Wifi, WifiOff, Download } from "lucide-react";

/**
 * PWA Update Prompt — notifies users when a new version of the app is available
 * and provides a one-click update. Also shows an offline indicator.
 */
export function PWAUpdatePrompt() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOffline, setShowOffline] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Check for updates every 60 minutes
      if (registration) {
        setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000,
        );
      }
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOffline(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <>
      {/* Update Available Banner */}
      {needRefresh && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-4">
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 shadow-lg max-w-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Update Available</p>
                <p className="text-xs text-muted-foreground">
                  A new version of LabLink is ready
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => updateServiceWorker(true)}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Update
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setNeedRefresh(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Offline Indicator */}
      {showOffline && !isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] animate-in slide-in-from-top-2">
          <div className="bg-amber-500/90 text-white text-center py-2 px-4 flex items-center justify-center gap-2 text-sm">
            <WifiOff className="h-4 w-4" />
            <span>You're offline — cached data is being shown</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white hover:bg-white/20 ml-2"
              onClick={() => setShowOffline(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
