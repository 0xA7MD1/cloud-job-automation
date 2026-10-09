import { createHash } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import Steel from "steel-sdk";

// واجهة مزود المتصفح: نفس الكود يعبّي النموذج سواء المتصفح عند Steel
// (المستخدمين، بمفتاحهم) أو Chrome محلي على جهاز المالك (عبر pnpm trigger:dev).

export type BrowserProviderId = "steel" | "local";

export interface BrowserSession {
  provider: BrowserProviderId;
  page: Page;
  context: BrowserContext;
  /** آخر وقت مسموح نشتغل فيه قبل ما تنتهي الجلسة (Steel المجاني: 15 دقيقة) */
  deadline: number;
  close(): Promise<void>;
}

const VIEWPORT = { width: 1280, height: 900 };
/** حد Steel للجلسة في الخطة المجانية 15 دقيقة. نخلي هامش للإغلاق. */
const STEEL_TIMEOUT_MS = 14 * 60_000;
const LOCAL_LIMIT_MS = 25 * 60_000;

/**
 * معرّف جلسة Steel مشتق من الطلب والتشغيل: صفحة البث (debugUrl) تنجاب
 * وقت الحاجة من مسار موثّق، وما ينحفظ الرابط في القاعدة ولا في السجلات (قاعدة 4).
 */
export function liveSessionId(applicationId: string, runId: string): string {
  const hex = createHash("sha256").update(`${applicationId}:${runId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function openSteelSession(options: {
  apiKey: string;
  captcha: boolean;
  sessionId: string;
}): Promise<BrowserSession> {
  const steel = new Steel({ steelAPIKey: options.apiKey, timeout: 60_000, maxRetries: 1 });
  const session = await steel.sessions.create({
    sessionId: options.sessionId,
    timeout: STEEL_TIMEOUT_MS,
    blockAds: true,
    dimensions: VIEWPORT,
    // حل الكابتشا يحتاج المستخدم يفعّله في حسابه عند Steel (إيداع $10): قاعدة 5
    solveCaptcha: options.captcha,
    stealthConfig: { humanizeInteractions: true, ...(options.captcha ? { autoCaptchaSolving: true } : {}) },
  });
  const deadline = Date.now() + STEEL_TIMEOUT_MS - 60_000;

  let browser: Browser | null = null;
  try {
    const url = new URL(session.websocketUrl);
    url.searchParams.set("apiKey", options.apiKey);
    browser = await chromium.connectOverCDP(url.toString(), { timeout: 30_000 });
    const context = browser.contexts()[0] ?? (await browser.newContext({ viewport: VIEWPORT }));
    const page = context.pages()[0] ?? (await context.newPage());
    const opened = browser;
    return {
      provider: "steel",
      page,
      context,
      deadline,
      close: async () => {
        await opened.close().catch(() => undefined);
        // الجلسة المعلّقة تنحسب لين تنتهي مهلتها: نسكّرها دائمًا (قاعدة 2)
        await steel.sessions.release(session.id).catch(() => undefined);
      },
    };
  } catch (error) {
    await browser?.close().catch(() => undefined);
    await steel.sessions.release(session.id).catch(() => undefined);
    throw error;
  }
}

/** Chrome (أو Edge) المثبّت على جهاز المالك. نافذة ظاهرة عشان يتدخل بنفسه لو لزم. */
export async function openLocalBrowser(options: { channel?: string } = {}): Promise<BrowserSession> {
  const channel = options.channel || process.env.LOCAL_BROWSER_CHANNEL || "chrome";
  const browser = await chromium.launch({ channel, headless: false, args: ["--start-maximized"] });
  try {
    const context = await browser.newContext({ viewport: null, locale: "en-US" });
    const page = await context.newPage();
    return {
      provider: "local",
      page,
      context,
      deadline: Date.now() + LOCAL_LIMIT_MS,
      close: () => browser.close().catch(() => undefined),
    };
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw error;
  }
}

/** رابط البث الحي لجلسة Steel (للمالك بس، من مسار موثّق). null لو انتهت الجلسة. */
export async function steelLiveViewUrl(apiKey: string, sessionId: string): Promise<string | null> {
  const steel = new Steel({ steelAPIKey: apiKey, timeout: 15_000, maxRetries: 0 });
  try {
    const session = await steel.sessions.retrieve(sessionId);
    if (session.status !== "live") return null;
    const url = new URL(session.debugUrl);
    url.searchParams.set("interactive", "true");
    url.searchParams.set("showControls", "true");
    return url.toString();
  } catch {
    return null;
  }
}
