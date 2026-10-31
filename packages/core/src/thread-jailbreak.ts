export type JailbreakThreadTarget = { botId: string } | { groupId: string };

type JailbreakSnapshot = {
  threadId: string;
  botId?: string;
  groupId?: string;
  jailbreakEnabled?: boolean;
};

/** Whether this snapshot is still the conversation the jailbreak RPC was sent for. */
export function snapshotMatchesJailbreakTarget(
  snapshot: JailbreakSnapshot | null,
  target: JailbreakThreadTarget,
  threadId?: string,
): boolean {
  if (!snapshot) return false;
  if (threadId && snapshot.threadId !== threadId) return false;
  if ("groupId" in target) return snapshot.groupId === target.groupId;
  return snapshot.botId === target.botId && snapshot.groupId == null;
}

/** Apply a jailbreak RPC result only to the conversation that was toggled. */
export function applyJailbreakToSnapshot<T extends JailbreakSnapshot>(
  prev: T | null,
  enabled: boolean,
  target: JailbreakThreadTarget,
  threadId?: string,
): T | null {
  if (!snapshotMatchesJailbreakTarget(prev, target, threadId) || !prev) return prev;
  return { ...prev, jailbreakEnabled: enabled };
}
