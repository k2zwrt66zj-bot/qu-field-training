/** محوّل تخزين المرفقات: STORAGE_DRIVER صراحةً، وإلا Supabase تلقائياً متى ضُبط رابطه ومفتاحه */
export function storageDriver(env: Record<string, string | undefined> = process.env): "supabase" | "local" {
  if (env.STORAGE_DRIVER === "supabase" || env.STORAGE_DRIVER === "local") return env.STORAGE_DRIVER;
  return env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local";
}
