import { describe, expect, it } from "vitest";
import { appContract, ThreadSnapshotSchema } from "./index.js";
import { ModelRoleSchema, modelSupportsRole } from "./model-roles.js";

describe("ModelRoleSchema", () => {
  it("accepts main, approval, and jailbreak", () => {
    expect(ModelRoleSchema.parse("main")).toBe("main");
    expect(ModelRoleSchema.parse("approval")).toBe("approval");
    expect(ModelRoleSchema.parse("jailbreak")).toBe("jailbreak");
    expect(ModelRoleSchema.safeParse("unknown").success).toBe(false);
  });

  it("keeps decision models off jailbreak the same way as main", () => {
    const chat = {
      provider: "openrouter",
      id: "cognitivecomputations/dolphin-mistral-24b-venice-edition",
      label: "Dolphin",
      billing: "BYOK",
    };
    const decisions = { ...chat, protocol: "decisions" as const };
    expect(modelSupportsRole(chat, "jailbreak")).toBe(true);
    expect(modelSupportsRole(decisions, "jailbreak")).toBe(false);
    expect(modelSupportsRole(decisions, "main")).toBe(false);
    expect(modelSupportsRole(decisions, "approval")).toBe(true);
  });
});

describe("jailbreak RPC contract", () => {
  it("requires enabled on threads/setJailbreak and accepts a bot or group target", () => {
    const schema = appContract.threads.setJailbreak["~orpc"].inputSchema!;
    expect(schema.parse({ botId: "bot-1", enabled: true })).toEqual({
      botId: "bot-1",
      enabled: true,
    });
    expect(schema.parse({ groupId: "group-1", enabled: false })).toEqual({
      groupId: "group-1",
      enabled: false,
    });
    expect(schema.safeParse({ botId: "bot-1" }).success).toBe(false);
    expect(schema.safeParse({ enabled: true }).success).toBe(false);
  });

  it("accepts models/setRole for jailbreak", () => {
    const schema = appContract.models.setRole["~orpc"].inputSchema!;
    expect(
      schema.parse({
        role: "jailbreak",
        primary: { provider: "openrouter", modelId: "nousresearch/hermes-4-405b" },
        backups: [],
      }),
    ).toMatchObject({ role: "jailbreak" });
  });

  it("reads jailbreakEnabled from a thread snapshot", () => {
    expect(
      ThreadSnapshotSchema.parse({
        threadId: "thread-1",
        cursor: -1,
        messages: [],
        olderCursor: null,
        run: null,
        jailbreakEnabled: true,
      }).jailbreakEnabled,
    ).toBe(true);
  });
});
