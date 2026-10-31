import { Alert, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";

const WEB_LINK = /^https?:/iu;

let isBrowserOpen = false;

export async function openEmailLink(url: string) {
  if (!WEB_LINK.test(url)) {
    await Linking.openURL(url).catch(() =>
      Alert.alert("Couldn’t open link", url),
    );
    return;
  }
  if (isBrowserOpen) return;
  isBrowserOpen = true;
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  } catch {
    Alert.alert("Couldn’t open link", url);
  }
  isBrowserOpen = false;
}
