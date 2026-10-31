export interface DevMailActions {
  archive: (index: number) => void;
  pin: (index: number) => void;
  read: (index: number) => void;
  select: () => void;
}

let current: DevMailActions | undefined;

export function devMailActions() {
  return current;
}

export function setDevMailActions(actions: DevMailActions) {
  current = actions;
}
