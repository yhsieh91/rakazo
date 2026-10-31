import type { ModelCatalogEntry, ModelRoleView } from "@rakazo/contracts";
import { canonicalPiProviderId } from "@rakazo/contracts";
import { applyJailbreakToSnapshot, JAILBREAK_MODEL_MISSING_ERROR } from "@rakazo/core";
import { useFocusEffect } from "expo-router";
import type { RefObject } from "react";
import { useCallback, useMemo, useState } from "react";
import type { MobileSnapshot } from "./api";
import { rpc } from "./api";
import { openModelSettings } from "./model-settings";

export type JailbreakThreadTarget = { botId: string } | { groupId: string };

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

/** Jailbreak role, label, and per-conversation toggle for the open mobile thread. */
export function useThreadJailbreak({
  botId,
  groupId,
  snap,
  snapRef,
  commitSnap,
}: {
  botId?: string;
  groupId?: string;
  snap: MobileSnapshot | null;
  snapRef: RefObject<MobileSnapshot | null>;
  commitSnap: (next: MobileSnapshot | null) => void;
}) {
  const target = useMemo<JailbreakThreadTarget | null>(
    () => (groupId ? { groupId } : botId ? { botId } : null),
    [botId, groupId],
  );
  const [role, setRole] = useState<ModelRoleView | null>(null);
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([]);

  const load = useCallback(() => {
    void rpc("models/role", { role: "jailbreak" })
      .then(setRole)
      .catch(() => undefined);
    void rpc("models/forRole", { role: "jailbreak" })
      .then(setCatalog)
      .catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const primary = role?.primary ?? null;
  const modelLabel = primary
    ? (catalog.find(
        (entry) =>
          canonicalPiProviderId(entry.provider) === canonicalPiProviderId(primary.provider) &&
          entry.id === primary.modelId,
      )?.label ?? primary.modelId)
    : null;

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!target) return { ok: false as const, missing: false };
      if (enabled && !primary) return { ok: false as const, missing: true };
      const requested = target;
      const threadId = snapRef.current?.threadId;
      try {
        const result = await rpc("threads/setJailbreak", { ...requested, enabled });
        const prev = snapRef.current;
        const next = applyJailbreakToSnapshot(prev, result.enabled, requested, threadId);
        if (next !== prev) commitSnap(next);
        return { ok: true as const, missing: false };
      } catch (error) {
        if (errorMessage(error) === JAILBREAK_MODEL_MISSING_ERROR) {
          return { ok: false as const, missing: true };
        }
        throw error;
      }
    },
    [commitSnap, primary, snapRef, target],
  );

  return {
    enabled: snap?.jailbreakEnabled === true,
    configured: Boolean(primary),
    modelLabel,
    setEnabled,
    openSettings: openModelSettings,
  };
}
