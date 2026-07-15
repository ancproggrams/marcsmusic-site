export function isProductionRuntime(env = process.env) {
  if (String(env?.NODE_ENV || "").trim().toLowerCase() === "production") return true;
  return [
    "RAILWAY_ENVIRONMENT",
    "RAILWAY_ENVIRONMENT_ID",
    "RAILWAY_PROJECT_ID",
    "RAILWAY_SERVICE_ID"
  ].some((name) => typeof env?.[name] === "string" && env[name].trim() !== "");
}
