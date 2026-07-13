import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { isTemporaryIos27SearchEnabled } from "./mobile-search-mode";

const TEMPORARY_IOS_27_SEARCH_KEY = "rodge-mail.temporary-ios-27-search";

let temporaryIos27Search = false;
let persistence = Promise.resolve();
const listeners = new Set<() => void>();

export function useTemporaryIos27Search() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return isTemporaryIos27SearchEnabled(Platform.OS, enabled);
}

export async function loadMobileSearchPreference() {
  temporaryIos27Search =
    (await SecureStore.getItemAsync(TEMPORARY_IOS_27_SEARCH_KEY)) === "true";
  notifyListeners();
}

export async function setTemporaryIos27Search(enabled: boolean) {
  temporaryIos27Search = enabled;
  notifyListeners();
  persistence = persistence
    .catch(() => undefined)
    .then(
      async () =>
        await SecureStore.setItemAsync(
          TEMPORARY_IOS_27_SEARCH_KEY,
          String(enabled),
        ),
    );
  await persistence;
}

function getSnapshot() {
  return temporaryIos27Search;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  for (const listener of listeners) listener();
}
