import type { RunTrigger } from "@rakazo/contracts";

/** User turns in a conversation. Routines, peers, and background work stay on the main model. */
const JAILBREAK_TRIGGERS = new Set<RunTrigger>(["user", "follow_up", "reaction", "call_end"]);

/** Whether this run should resolve the member's jailbreak models instead of the main model. */
export function jailbreakAppliesToRun(input: {
  enabled: boolean;
  trigger: string;
  routineId?: string | null;
}): boolean {
  return input.enabled && !input.routineId && JAILBREAK_TRIGGERS.has(input.trigger as RunTrigger);
}
