import { createRefreshAuthRouter } from "@insforge/sdk/ssr";

// عميل المتصفح يستدعي هذا لما يقارب توكن الدخول ينتهي.
export const { POST } = createRefreshAuthRouter();
