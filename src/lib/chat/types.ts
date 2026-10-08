import type { InferUITools, UIMessage } from "ai";
import type { ChatTools } from "./tools";

// نوع رسائل الشات للواجهة. استيراد أنواع بس، فما يدخل كود الخادم في حزمة المتصفح.
export type ChatUIMessage = UIMessage<never, never, InferUITools<ChatTools>>;
