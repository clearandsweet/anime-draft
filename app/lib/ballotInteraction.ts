export function isBallotActivationKey(key: string) {
  return key === "Enter" || key === " " || key === "Spacebar";
}
