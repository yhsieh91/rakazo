import { describe, expect, it } from "vitest";
import { jailbreakAppliesToRun } from "./jailbreak.js";

describe("jailbreakAppliesToRun", () => {
  it("applies to user conversation turns when the thread toggle is on", () => {
    expect(jailbreakAppliesToRun({ enabled: true, trigger: "user" })).toBe(true);
    expect(jailbreakAppliesToRun({ enabled: true, trigger: "follow_up" })).toBe(true);
    expect(jailbreakAppliesToRun({ enabled: true, trigger: "reaction" })).toBe(true);
    expect(jailbreakAppliesToRun({ enabled: true, trigger: "call_end" })).toBe(true);
  });

  it("does not apply when the toggle is off", () => {
    expect(jailbreakAppliesToRun({ enabled: false, trigger: "user" })).toBe(false);
  });

  it("does not apply to routines, peers, or background work", () => {
    expect(jailbreakAppliesToRun({ enabled: true, trigger: "routine", routineId: "r1" })).toBe(
      false,
    );
    expect(jailbreakAppliesToRun({ enabled: true, trigger: "user", routineId: "r1" })).toBe(false);
    expect(jailbreakAppliesToRun({ enabled: true, trigger: "bot_message" })).toBe(false);
    expect(jailbreakAppliesToRun({ enabled: true, trigger: "webhook" })).toBe(false);
    expect(jailbreakAppliesToRun({ enabled: true, trigger: "tickets" })).toBe(false);
    expect(jailbreakAppliesToRun({ enabled: true, trigger: "resume" })).toBe(false);
  });
});
