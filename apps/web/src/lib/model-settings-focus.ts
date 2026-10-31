export type ModelSettingsFocus = "jailbreak";

let pending: ModelSettingsFocus | null = null;
const listeners = new Set<() => void>();

/** Ask Settings → Models to reveal a section when it next opens or if it is already open. */
export function requestModelSettingsFocus(section: ModelSettingsFocus): void {
  pending = section;
  for (const listener of listeners) listener();
}

export function takeModelSettingsFocus(): ModelSettingsFocus | null {
  const next = pending;
  pending = null;
  return next;
}

export function subscribeModelSettingsFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
