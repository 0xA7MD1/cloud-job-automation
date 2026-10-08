/**
 * يسكّر جسم رد ما راح نقرأه. بدونها، مهلة AbortSignal.timeout تنطلق لاحقًا على
 * جسم مفتوح وتطلع كخطأ غير ملتقط (TimeoutError) يطيّح العملية.
 */
export function discardBody(response: Response | null | undefined): void {
  response?.body?.cancel().catch(() => undefined);
}
