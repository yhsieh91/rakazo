import { describe, expect, it } from "vitest";
import {
  requestModelSettingsFocus,
  subscribeModelSettingsFocus,
  takeModelSettingsFocus,
} from "./model-settings-focus";

describe("model settings focus", () => {
  it("delivers a jailbreak section request once", () => {
    const seen: string[] = [];
    const stop = subscribeModelSettingsFocus(() => {
      const next = takeModelSettingsFocus();
      if (next) seen.push(next);
    });
    requestModelSettingsFocus("jailbreak");
    expect(seen).toEqual(["jailbreak"]);
    expect(takeModelSettingsFocus()).toBeNull();
    stop();
  });
});
