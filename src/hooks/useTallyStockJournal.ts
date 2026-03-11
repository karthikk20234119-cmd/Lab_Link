// ==========================================
// useTallyStockJournal Hook
// Auto-post stock journal to TallyPrime when a consumption event occurs
// ==========================================

import { useCallback } from "react";
import {
  createStockJournal,
  getTallyConfig,
  type TallyConfig,
} from "@/services/tallyService";
import { toast } from "sonner";

interface PostJournalParams {
  transactionId: string;
  transactionType: "chemical" | "item";
  /** If true, show toast notifications */
  showNotifications?: boolean;
  /** Optional: supply config to avoid extra DB call */
  config?: TallyConfig;
}

/**
 * React hook that provides a function to post a stock journal
 * entry to TallyPrime when a consumption event occurs.
 *
 * Usage:
 * ```tsx
 * const { postToTally, isPosting } = useTallyStockJournal();
 *
 * // After recording a chemical usage transaction:
 * await postToTally({
 *   transactionId: newTransactionId,
 *   transactionType: 'chemical',
 * });
 * ```
 */
export function useTallyStockJournal() {
  const postToTally = useCallback(
    async ({
      transactionId,
      transactionType,
      showNotifications = true,
      config: providedConfig,
    }: PostJournalParams) => {
      try {
        // Get config if not provided
        const config = providedConfig || (await getTallyConfig());

        // Silently skip if Tally is not configured or disabled
        if (!config || !config.is_enabled) {
          return {
            success: false,
            skipped: true,
            message: "Tally not enabled",
          };
        }

        const result = await createStockJournal(
          transactionId,
          transactionType,
          config,
        );

        if (showNotifications) {
          if (result.success) {
            toast.success("📊 Stock journal posted to TallyPrime", {
              description: result.message,
            });
          } else {
            toast.warning("Tally stock journal failed", {
              description: result.message,
            });
          }
        }

        return { ...result, skipped: false };
      } catch (err: any) {
        if (showNotifications) {
          toast.error("Tally sync error", {
            description: err.message,
          });
        }
        return {
          success: false,
          skipped: false,
          message: err.message || "Unknown error",
        };
      }
    },
    [],
  );

  return { postToTally };
}
