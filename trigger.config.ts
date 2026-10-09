import { defineConfig } from "@trigger.dev/sdk";
import { additionalFiles } from "@trigger.dev/build/extensions/core";

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
  build: {
    // playwright-core يتصل بمتصفح بعيد (Steel) أو محلي (جهاز المالك): ما نحزمه، ولا ننزّل متصفح في السحابة
    external: ["playwright-core", "chromium-bidi", "@react-pdf/renderer"],
    // خط الـPDF العربي (src/lib/apply/documents.ts يقرأه من process.cwd()/assets/fonts)
    extensions: [additionalFiles({ files: ["./assets/fonts/*.ttf"] })],
  },
});
