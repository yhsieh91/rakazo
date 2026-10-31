import { router } from "expo-router";

/** Opens Settings → Models. */
export function openModelSettings() {
  router.push("/(settings)/models");
}

/** Opens Settings → Models at Jailbreak models. */
export function openJailbreakModelSettings() {
  router.push({ pathname: "/(settings)/models", params: { focus: "jailbreak" } });
}
