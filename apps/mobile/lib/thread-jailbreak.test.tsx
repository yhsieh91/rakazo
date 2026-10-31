// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadJailbreakRow } from "../components/thread/thread-jailbreak";

vi.mock("./appearance", () => ({
  mobileTokens: () => ({ mutedForeground: "#888" }),
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

vi.mock("react-native", () => {
  const Surface = ({
    children,
    testID,
    accessibilityRole,
    onPress,
    disabled,
  }: {
    children?: ReactNode;
    testID?: string;
    accessibilityRole?: string;
    onPress?: () => void;
    disabled?: boolean;
  }) =>
    createElement(
      accessibilityRole === "button" || onPress ? "button" : "div",
      { "data-testid": testID, type: "button", disabled, onClick: onPress },
      children,
    );
  return {
    View: Surface,
    Pressable: Surface,
    Text: ({ children }: { children?: ReactNode }) => createElement("span", null, children),
  };
});

vi.mock("../components/native-switch", () => ({
  NativeSwitch: ({
    value,
    onValueChange,
    accessibilityLabel,
    disabled,
  }: {
    value: boolean;
    onValueChange: (value: boolean) => void;
    accessibilityLabel?: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      aria-checked={value}
      aria-label={accessibilityLabel}
      disabled={disabled}
      role="switch"
      onClick={() => onValueChange(!value)}
    />
  ),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function render(props: Partial<ComponentProps<typeof ThreadJailbreakRow>> = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const onChange = props.onChange ?? vi.fn();
  const onOpenSettings = props.onOpenSettings ?? vi.fn();
  act(() => {
    root!.render(
      <ThreadJailbreakRow
        enabled={false}
        configured={false}
        modelLabel={null}
        onChange={onChange}
        onOpenSettings={onOpenSettings}
        {...props}
      />,
    );
  });
  return { onChange, onOpenSettings };
}

describe("ThreadJailbreakRow", () => {
  it("links to settings when no jailbreak model is configured", () => {
    const { onOpenSettings } = render();
    const button = container!.querySelector<HTMLElement>(
      '[data-testid="composer-jailbreak-settings"]',
    );
    expect(button?.textContent).toBe("Jailbreak");
    act(() => button!.click());
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("shows Jailbreak without the model name while off", () => {
    render({
      configured: true,
      enabled: false,
      modelLabel: "Dolphin Mistral 24B",
    });
    expect(container!.textContent).toBe("Jailbreak");
    expect(container!.textContent).not.toContain("Dolphin Mistral 24B");
    expect(container!.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
    expect(container!.querySelector('[role="switch"]')?.getAttribute("aria-label")).toBe(
      "Jailbreak",
    );
  });

  it("shows the model name while on", () => {
    render({
      configured: true,
      enabled: true,
      modelLabel: "Dolphin Mistral 24B",
    });
    expect(container!.textContent).toContain("Jailbreak · Dolphin Mistral 24B");
    expect(container!.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("true");
    expect(container!.querySelector('[role="switch"]')?.getAttribute("aria-label")).toBe(
      "Jailbreak, Dolphin Mistral 24B",
    );
  });

  it("keeps the off switch when jailbreak is on and no model is configured", () => {
    const { onChange } = render({ configured: false, enabled: true });
    expect(container!.querySelector('[data-testid="composer-jailbreak-settings"]')).toBeNull();
    act(() => container!.querySelector<HTMLElement>('[role="switch"]')!.click());
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
