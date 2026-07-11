import { Platform } from "react-native";

export const postalDisplayFont = Platform.select({
  android: "serif",
  default: "Georgia",
  ios: "New York",
});
