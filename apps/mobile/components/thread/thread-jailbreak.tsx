import { Pressable, Text, View } from "react-native";
import { mobileTokens } from "../../lib/appearance";
import { useI18n } from "../../lib/i18n";
import { NativeSwitch } from "../native-switch";

/** Composer control: switch when a model is configured or this chat is already on, else Settings. */
export function ThreadJailbreakRow({
  enabled,
  configured,
  modelLabel,
  disabled,
  onChange,
  onOpenSettings,
}: {
  enabled: boolean;
  configured: boolean;
  modelLabel: string | null;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
  onOpenSettings: () => void;
}) {
  const tokens = mobileTokens();
  const { t } = useI18n();
  const label =
    enabled && modelLabel ? t("Jailbreak · {model}", { model: modelLabel }) : t("Jailbreak");
  const accessibilityLabel =
    enabled && modelLabel ? t("Jailbreak, {model}", { model: modelLabel }) : t("Jailbreak");

  if (!configured && !enabled) {
    return (
      <Pressable
        accessibilityLabel={t("Jailbreak")}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onOpenSettings}
        testID="composer-jailbreak-settings"
        style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}
      >
        <Text style={{ color: tokens.mutedForeground, fontSize: 13 }}>{t("Jailbreak")}</Text>
      </Pressable>
    );
  }

  return (
    <View
      testID="composer-jailbreak"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
      }}
    >
      <NativeSwitch
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onValueChange={onChange}
        value={enabled}
      />
      <Text numberOfLines={1} style={{ color: tokens.mutedForeground, flex: 1, fontSize: 13 }}>
        {label}
      </Text>
    </View>
  );
}
