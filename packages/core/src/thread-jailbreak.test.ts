import { describe, expect, it } from "vitest";
import { applyJailbreakToSnapshot } from "./thread-jailbreak.js";

const botA = { threadId: "thread-a", botId: "bot-a" };
const botB = { threadId: "thread-b", botId: "bot-b" };
const groupA = { threadId: "thread-g", groupId: "group-a" };

describe("applyJailbreakToSnapshot", () => {
  it("sets the flag on the conversation that was toggled", () => {
    expect(applyJailbreakToSnapshot(botA, true, { botId: "bot-a" }, "thread-a")).toEqual({
      ...botA,
      jailbreakEnabled: true,
    });
  });

  it("leaves a different conversation unchanged", () => {
    expect(applyJailbreakToSnapshot(botB, true, { botId: "bot-a" }, "thread-a")).toBe(botB);
    expect(applyJailbreakToSnapshot(groupA, true, { botId: "bot-a" }, "thread-a")).toBe(groupA);
  });

  it("does not apply a bot toggle to a group snapshot of that bot", () => {
    const groupWithBot = { threadId: "thread-g", botId: "bot-a", groupId: "group-a" };
    expect(applyJailbreakToSnapshot(groupWithBot, true, { botId: "bot-a" }, "thread-a")).toBe(
      groupWithBot,
    );
  });
});
