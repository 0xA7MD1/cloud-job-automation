import { logger, task } from "@trigger.dev/sdk";

// مهمة فحص: تتأكد إن Trigger.dev متصل وإن متغيرات البيئة الأساسية واصلة للمهام.
// تطبع أسماء المتغيرات الناقصة بس، ولا تطبع أي قيمة.
export const healthcheck = task({
  id: "healthcheck",
  retry: { maxAttempts: 1 },
  run: async () => {
    const required = [
      "NEXT_PUBLIC_INSFORGE_URL",
      "INSFORGE_API_KEY",
      "BYOK_MASTER_KEY",
    ] as const;
    const missing = required.filter((name) => !process.env[name]);

    if (missing.length > 0) {
      logger.warn("متغيرات ناقصة في بيئة Trigger.dev", { missing });
    }

    return { ok: missing.length === 0, missing, checkedAt: new Date().toISOString() };
  },
});
