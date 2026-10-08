import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // معرّف المشروع من لوحة Trigger.dev (proj_...). مو سر، لكن يختلف لكل حساب.
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_missing_set_TRIGGER_PROJECT_REF",
  dirs: ["./trigger"],
  runtime: "node",
  // المتصفح بعيد عند Steel، فعميل المهمة خفيف: Micro يكفي ويوفّر الحصة المجانية.
  machine: "micro",
  maxDuration: 1800,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
});
