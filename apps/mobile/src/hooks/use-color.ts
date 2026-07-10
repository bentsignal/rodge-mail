import { useCSSVariable } from "uniwind";

export function useColor(color: string) {
  const cssVariable = useCSSVariable(`--${color}`);
  if (cssVariable === undefined) {
    throw new Error(`Color variable ${color} not found`);
  }
  if (typeof cssVariable !== "string") {
    throw new Error(`Color variable ${color} is not a string`);
  }
  return cssVariable;
}
