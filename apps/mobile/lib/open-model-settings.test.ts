import { router } from "expo-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openJailbreakModelSettings, openModelSettings } from "./model-settings";

vi.mock("expo-router", () => ({
  router: { push: vi.fn() },
}));

describe("openModelSettings", () => {
  beforeEach(() => {
    vi.mocked(router.push).mockClear();
  });

  it("opens Models", () => {
    openModelSettings();
    expect(router.push).toHaveBeenCalledWith("/(settings)/models");
  });

  it("opens Models at the jailbreak section", () => {
    openJailbreakModelSettings();
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(settings)/models",
      params: { focus: "jailbreak" },
    });
  });
});
