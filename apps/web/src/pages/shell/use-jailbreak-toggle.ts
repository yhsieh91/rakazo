import type { ModelRoleView, ThreadSnapshot } from "@rakazo/contracts";
import { canonicalPiProviderId } from "@rakazo/contracts";
import { JAILBREAK_MODEL_MISSING_ERROR } from "@rakazo/core";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import type { SpaceQueries } from "../../lib/query";
import type { createSpaceRpc } from "../../lib/rpc";

type ThreadTargetInput = { botId: string } | { groupId: string };

function errorMessage(error: unknown): string | undefined {
  return typeof error === "string"
    ? error
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : undefined;
}

export function useJailbreakToggle({
  rpc,
  queries,
  userId,
  target,
  snapshot,
  updateSnapshot,
  settingsOpen,
}: {
  rpc: ReturnType<typeof createSpaceRpc>;
  queries: SpaceQueries;
  userId: string | undefined;
  target: ThreadTargetInput | null;
  snapshot: ThreadSnapshot | null;
  updateSnapshot: (update: (prev: ThreadSnapshot | null) => ThreadSnapshot | null) => void;
  settingsOpen: boolean;
}) {
  const roleQuery = useQuery({
    ...queries.models.role.queryOptions({ input: { role: "jailbreak" } }),
    enabled: Boolean(userId),
  });
  const catalogQuery = useQuery({
    ...queries.models.forRole.queryOptions({ input: { role: "jailbreak" } }),
    enabled: Boolean(userId),
  });
  const settingsWereOpen = useRef(false);
  useEffect(() => {
    if (settingsOpen) {
      settingsWereOpen.current = true;
      return;
    }
    if (!settingsWereOpen.current) return;
    settingsWereOpen.current = false;
    void roleQuery.refetch();
    void catalogQuery.refetch();
  }, [settingsOpen, roleQuery, catalogQuery]);

  const role: ModelRoleView | undefined = roleQuery.data;
  const primary = role?.primary ?? null;
  const modelLabel = primary
    ? (catalogQuery.data?.find(
        (entry) =>
          canonicalPiProviderId(entry.provider) === canonicalPiProviderId(primary.provider) &&
          entry.id === primary.modelId,
      )?.label ?? primary.modelId)
    : null;

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!target) return { ok: false as const, missing: false };
      if (enabled && !primary) return { ok: false as const, missing: true };
      try {
        const result = await rpc.threads.setJailbreak({ ...target, enabled });
        updateSnapshot((prev) => (prev ? { ...prev, jailbreakEnabled: result.enabled } : prev));
        return { ok: true as const, missing: false };
      } catch (error) {
        if (errorMessage(error) === JAILBREAK_MODEL_MISSING_ERROR) {
          return { ok: false as const, missing: true };
        }
        throw error;
      }
    },
    [primary, rpc, target, updateSnapshot],
  );

  return {
    enabled: snapshot?.jailbreakEnabled === true,
    configured: Boolean(primary),
    modelLabel,
    setEnabled,
  };
}
