export function isDemoModeEnabled() {
  if (process.env.SEED_DEMO_DATA === "true") return true;
  if (process.env.SEED_DEMO_DATA === "false") return false;
  return process.env.NODE_ENV !== "production";
}
