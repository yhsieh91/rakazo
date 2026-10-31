import type { AgentRunRequest } from "@rakazo/adapter-kit";
import { JAILBREAK_MODEL_UNAVAILABLE_ERROR } from "@rakazo/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { createRunExecutor } from "./executor.js";
import { serializeModelSecret } from "./pi-oauth.js";
import { withModelRoles } from "./testing/model-roles.js";

vi.mock("./computer-lifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ComputerLifecycleModule>()),
  acquireComputerExecutionLease: async () => null,
  acquireDedicatedScreenLeaseFence: async (
    _prisma: unknown,
    input: { computerId: string; botId: string; runId: string },
  ) => ({ ...input, fence: 7 }),
  provisionComputer: async () => ({ id: "computer-1", kind: "desktop" }),
  renewComputerExecutionLease: async () => true,
}));

const USER_ID = "user-1";
// Catalog ids the offline validator already accepts. MAIN uses an api_key provider so
// off/routine paths start without a live OAuth refresh (openai-codex oauth hits 401).
const MAIN = { provider: "openrouter", modelId: "openai/gpt-5.6-luna" };
const JAILBREAK = { provider: "openrouter", modelId: "openai/gpt-4o" };
const JAILBREAK_BACKUP = { provider: "anthropic", modelId: "claude-fable-5-1" };
const stamp = new Date("2026-08-30T00:00:00.000Z");

type Credential = {
  id: string;
  userId: string;
  provider: string;
  label: string;
  secretId: string;
  supportsImages: boolean;
  createdAt: Date;
  updatedAt: Date;
};
type ProviderFilter = string | { in: string[] };

const matchesProvider = (filter: ProviderFilter | undefined, provider: string) =>
  filter === undefined ||
  (typeof filter === "string" ? filter === provider : filter.in.includes(provider));

function connection(provider: string, secretId: string, id = `credential-${secretId}`): Credential {
  return {
    id,
    userId: USER_ID,
    provider,
    label: provider,
    secretId,
    supportsImages: false,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function withPrefs(row: Credential | null | undefined) {
  return row ? { ...row, userPreferences: [] as [] } : null;
}

const plaintexts: Record<string, string> = {
  "secret-main": serializeModelSecret({ kind: "api_key", key: "fake-main-key" }),
  "secret-jailbreak": serializeModelSecret({ kind: "api_key", key: "fake-jailbreak-key" }),
  "secret-jailbreak-backup": serializeModelSecret({
    kind: "api_key",
    key: "fake-jailbreak-backup-key",
  }),
};

async function runTurn({
  jailbreakEnabled = true,
  trigger = "user",
  routineId = null,
  jailbreakConnected = true,
  jailbreakBackupConnected = false,
  mainConnected = true,
  includeJailbreak = true,
  includeJailbreakBackup = false,
}: {
  jailbreakEnabled?: boolean;
  trigger?: string;
  routineId?: string | null;
  jailbreakConnected?: boolean;
  jailbreakBackupConnected?: boolean;
  mainConnected?: boolean;
  includeJailbreak?: boolean;
  includeJailbreakBackup?: boolean;
}) {
  const run: Record<string, unknown> = {
    id: "run-1",
    botId: "bot-1",
    threadId: "thread-1",
    taskId: "task-1",
    spaceId: "space-1",
    userId: USER_ID,
    status: "queued",
    trigger,
    routineId,
    leaseFence: 0,
  };
  const credentials = [
    ...(mainConnected ? [connection(MAIN.provider, "secret-main")] : []),
    ...(jailbreakConnected ? [connection(JAILBREAK.provider, "secret-jailbreak")] : []),
    ...(jailbreakBackupConnected
      ? [connection(JAILBREAK_BACKUP.provider, "secret-jailbreak-backup")]
      : []),
  ];
  const secrets = Object.keys(plaintexts).map((id) => ({
    id,
    userId: USER_ID,
    spaceId: null,
    kind: "model",
    ciphertext: `cipher-${id}`,
  }));
  const credentialsFor = (where: { userId?: string; provider?: ProviderFilter }) =>
    credentials.filter(
      (row) => row.userId === where.userId && matchesProvider(where.provider, row.provider),
    );
  const tx = {
    userModelCredential: {
      findFirst: vi.fn(
        async (args: { where: { id: string } }) =>
          withPrefs(credentials.find((row) => row.id === args.where.id)),
      ),
      delete: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    userVoiceCredential: { count: vi.fn(async () => 0) },
    secret: {
      findFirst: vi.fn(
        async (args: { where: { id: string } }) =>
          secrets.find((row) => row.id === args.where.id) ?? null,
      ),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => null),
    },
  };
  let request: AgentRunRequest | undefined;
  const runtimeRun = vi.fn(async function* (next: AgentRunRequest) {
    request = next;
    yield { type: "done" as const, text: "Done" };
  });
  const prisma = withModelRoles(
    {
      $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
      user: { findUnique: vi.fn(async () => null) },
      run: {
        findUnique: vi.fn(async () => run),
        findUniqueOrThrow: vi.fn(async () => run),
        findFirst: vi.fn(async () => ({
          bot: { notifyOnFinish: false },
          thread: { groupId: null },
        })),
        updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(run, data);
          return { count: 1 };
        }),
      },
      chatGroup: { findMany: vi.fn(async () => []) },
      bot: {
        findUnique: vi.fn(async () => ({ name: "Assistant" })),
        findUniqueOrThrow: vi.fn(async () => ({
          id: "bot-1",
          name: "Assistant",
          title: "Assistant",
          description: "Test assistant",
          modelProvider: null,
          modelId: null,
          thinkingLevel: null,
          computerId: "computer-1",
          computerSwitching: false,
          memoryScope: null,
          computer: { id: "computer-1", scope: "dedicated" },
        })),
        findMany: vi.fn(async () => []),
      },
      attempt: {
        create: vi.fn(async () => ({ id: "attempt-1" })),
        findMany: vi.fn(async () => []),
        update: vi.fn(),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      thread: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: "thread-1",
          groupId: null,
          jailbreakEnabled,
          historyCompactionSummary: null,
          historyCompactedUpToSeq: null,
          nextMessageSeq: 2,
        })),
      },
      message: {
        findMany: vi.fn(async () => []),
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => null),
      },
      task: { findUniqueOrThrow: vi.fn(async () => ({ id: "task-1", prompt: "hello" })) },
      computer: { updateMany: vi.fn(async () => ({ count: 1 })) },
      connection: { findMany: vi.fn(async () => []) },
      userModelPreference: {
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
      },
      userModelCredential: {
        findMany: vi.fn(
          async ({ where }: { where: { userId?: string; provider?: ProviderFilter } }) =>
            credentialsFor(where),
        ),
        findFirst: vi.fn(
          async ({
            where,
          }: {
            where: { id?: string; userId?: string; provider?: ProviderFilter };
          }) =>
            withPrefs(
              where.id
                ? (credentials.find((row) => row.id === where.id) ?? null)
                : (credentialsFor(where)[0] ?? null),
            ),
        ),
      },
      secret: {
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(
          async (args: { where: { id: string } }) =>
            secrets.find((row) => row.id === args.where.id) ?? null,
        ),
      },
      deploymentSettings: { findUnique: vi.fn(async () => null) },
      taughtSkill: { findMany: vi.fn(async () => []) },
      vaultCredential: { findMany: vi.fn(async () => []) },
      agentSkill: { findMany: vi.fn(async () => []) },
      scratchpadItem: { findMany: vi.fn(async () => []) },
      externalEffect: { findMany: vi.fn(async () => []) },
      userActionApprovalRule: { findMany: vi.fn(async () => []) },
      userActionAutoReviewPreference: { findUnique: vi.fn(async () => null) },
      artifact: { findMany: vi.fn(async () => []) },
    },
    [
      {
        userId: USER_ID,
        role: "main",
        position: 0,
        thinkingLevel: null,
        credentialId: "credential-secret-main",
        ...MAIN,
      },
      ...(includeJailbreak
        ? [
            {
              userId: USER_ID,
              role: "jailbreak",
              position: 0,
              thinkingLevel: null,
              credentialId: "credential-secret-jailbreak",
              ...JAILBREAK,
            },
          ]
        : []),
      ...(includeJailbreakBackup
        ? [
            {
              userId: USER_ID,
              role: "jailbreak",
              position: 1,
              thinkingLevel: null,
              credentialId: "credential-secret-jailbreak-backup",
              ...JAILBREAK_BACKUP,
            },
          ]
        : []),
    ],
  );
  const finalizeRun = vi.fn(async () => ({ continuationRunId: null }));
  const executor = createRunExecutor({
    prisma,
    billingEnabled: false,
    secretStore: {
      load: vi.fn(async (_ciphertext: string, secretId: string) => plaintexts[secretId]),
      put: vi.fn(async () => ({ ciphertext: "sealed-marker" })),
      delete: vi.fn(async () => undefined),
    },
    runtime: { describe: () => ({ capabilities: { scripted: false } }), run: runtimeRun },
    sandbox: {
      describe: () => ({ capabilities: { graphical: false } }),
      listFiles: vi.fn(async () => []),
      readFile: vi.fn().mockRejectedValue(new Error("missing")),
      exportWorkspace: vi.fn(async function* () {
        yield* [];
      }),
    },
    home: { commit: vi.fn(async () => "fixture-revision") },
    memory: { read: async () => ({ documents: [] }) },
    memoryProviders: { resolve: async () => null },
    events: { append: vi.fn(async () => undefined), finalizeRun },
    jobs: { enqueue: vi.fn(async () => undefined) },
    secrets: [],
  } as unknown as Parameters<typeof createRunExecutor>[0]);
  await executor.continueRun("run-1", "worker-1");
  return { request, run, runtimeRun, finalizeRun };
}

describe("jailbreak model resolution", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs the jailbreak model when the conversation toggle is on", async () => {
    const { request, run } = await runTurn({ jailbreakEnabled: true });
    expect(request?.model).toMatchObject({
      provider: JAILBREAK.provider,
      id: JAILBREAK.modelId,
      apiKey: "fake-jailbreak-key",
    });
    expect(run).toMatchObject({ modelProvider: JAILBREAK.provider, modelId: JAILBREAK.modelId });
  });

  it("keeps the main model when the conversation toggle is off", async () => {
    const { request, run } = await runTurn({ jailbreakEnabled: false });
    expect(request?.model).toMatchObject({ provider: MAIN.provider, id: MAIN.modelId });
    expect(run).toMatchObject({ modelProvider: MAIN.provider, modelId: MAIN.modelId });
  });

  it("does not use jailbreak for a routine on the same thread", async () => {
    const { request } = await runTurn({
      jailbreakEnabled: true,
      trigger: "routine",
      routineId: "routine-1",
    });
    expect(request?.model).toMatchObject({ provider: MAIN.provider, id: MAIN.modelId });
  });

  it("tries the next jailbreak model when the active one cannot start", async () => {
    const { request, run } = await runTurn({
      jailbreakConnected: false,
      includeJailbreakBackup: true,
      jailbreakBackupConnected: true,
    });
    expect(request?.model).toMatchObject({
      provider: JAILBREAK_BACKUP.provider,
      id: JAILBREAK_BACKUP.modelId,
      apiKey: "fake-jailbreak-backup-key",
    });
    expect(run).toMatchObject({
      modelProvider: JAILBREAK_BACKUP.provider,
      modelId: JAILBREAK_BACKUP.modelId,
    });
  });

  it("fails without using the main model when no jailbreak model can start", async () => {
    const { runtimeRun, finalizeRun } = await runTurn({
      jailbreakConnected: false,
      mainConnected: true,
    });
    expect(runtimeRun).not.toHaveBeenCalled();
    expect(finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        error: JAILBREAK_MODEL_UNAVAILABLE_ERROR,
      }),
    );
  });

  it("fails when jailbreak is on and none is configured", async () => {
    const { runtimeRun, finalizeRun } = await runTurn({
      jailbreakEnabled: true,
      includeJailbreak: false,
      mainConnected: true,
    });
    expect(runtimeRun).not.toHaveBeenCalled();
    expect(finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed", error: JAILBREAK_MODEL_UNAVAILABLE_ERROR }),
    );
  });
});
