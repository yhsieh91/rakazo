import { ORPCError } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { JAILBREAK_MODEL_MISSING_ERROR } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { ThreadTarget } from "./thread-target.js";
import { setThreadJailbreak, threadSnapshot } from "./thread-target.js";

const actor = { userId: "user-1", spaceId: "space-1" } as Actor;
const target = {
  kind: "bot",
  botId: "bot-1",
  threadId: "thread-1",
  bot: { computer: null },
} as ThreadTarget;

function rolePrisma(options: {
  jailbreakPrimary?: { provider: string; modelId: string } | null;
  updateCount?: number;
}) {
  const jailbreakRows = options.jailbreakPrimary
    ? [{ position: 0, thinkingLevel: null, credentialId: null, ...options.jailbreakPrimary }]
    : [];
  return {
    spaceSettingOverride: { findUnique: vi.fn(async () => null) },
    userModelRoleChoice: {
      findMany: vi.fn(async ({ where }: { where: { role?: string } }) =>
        where.role === "jailbreak" ? jailbreakRows : [],
      ),
    },
    thread: {
      updateMany: vi.fn(async () => ({ count: options.updateCount ?? 1 })),
    },
  } as unknown as PrismaClient;
}

describe("setThreadJailbreak", () => {
  it("rejects enabling when the member has no jailbreak model", async () => {
    const prisma = rolePrisma({ jailbreakPrimary: null });
    const error = await setThreadJailbreak(prisma, actor, target, true).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ORPCError);
    expect(error).toMatchObject({ code: "BAD_REQUEST", message: JAILBREAK_MODEL_MISSING_ERROR });
    expect(prisma.thread.updateMany).not.toHaveBeenCalled();
  });

  it("turns jailbreak on for this thread only when a jailbreak model is configured", async () => {
    const prisma = rolePrisma({
      jailbreakPrimary: {
        provider: "openrouter",
        modelId: "cognitivecomputations/dolphin-mistral-24b-venice-edition",
      },
    });
    await expect(setThreadJailbreak(prisma, actor, target, true)).resolves.toBe(true);
    expect(prisma.thread.updateMany).toHaveBeenCalledWith({
      where: { id: "thread-1", spaceId: "space-1", userId: "user-1" },
      data: { jailbreakEnabled: true },
    });
  });

  it("turns jailbreak off without requiring a configured model", async () => {
    const prisma = rolePrisma({ jailbreakPrimary: null });
    await expect(setThreadJailbreak(prisma, actor, target, false)).resolves.toBe(false);
    expect(prisma.thread.updateMany).toHaveBeenCalledWith({
      where: { id: "thread-1", spaceId: "space-1", userId: "user-1" },
      data: { jailbreakEnabled: false },
    });
  });

  it("does not update another conversation", async () => {
    const prisma = rolePrisma({
      jailbreakPrimary: { provider: "openrouter", modelId: "nousresearch/hermes-4-405b" },
      updateCount: 0,
    });
    const error = await setThreadJailbreak(prisma, actor, target, true).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ORPCError);
    expect(error).toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.thread.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "thread-1" }) }),
    );
  });
});

describe("threadSnapshot jailbreakEnabled", () => {
  it("returns the persisted per-conversation flag", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ jailbreakEnabled: true }]),
      message: { findMany: vi.fn().mockResolvedValue([]) },
      event: { findFirst: vi.fn().mockResolvedValue({ seq: -1 }), findMany: vi.fn() },
      run: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof tx) => unknown) => work(tx)),
    } as unknown as PrismaClient;
    const snapshot = await threadSnapshot({ prisma }, target);
    expect(snapshot.jailbreakEnabled).toBe(true);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
  });
});
