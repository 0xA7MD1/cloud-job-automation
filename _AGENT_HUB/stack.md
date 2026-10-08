# stack — تثبيت الستاك النهائي لبوت التقديم على الوظائف

## ينتظر أحمد
- [ ] 2026-10-09 · عائق · الحسابات ما انسوت للحين. قبل ما نختبر أي شي حقيقي أحتاج أربع خدمات، وكل قيمة تنحط في `.env.local` (الأسماء والأماكن في جدول متغيرات البيئة في `AGENTS.md`): (1) مشروع InsForge، تختار منطقته ⇒ `NEXT_PUBLIC_INSFORGE_URL` و`NEXT_PUBLIC_INSFORGE_ANON_KEY` و`INSFORGE_API_KEY`. (2) مشروع Vercel بنفس منطقة InsForge. (3) مشروع Trigger.dev ⇒ `TRIGGER_SECRET_KEY`. (4) حساب Cloudflare + bucket خاص في R2 (غالبًا يطلب بطاقة) + توكن محصور عليه ⇒ `R2_ACCOUNT_ID` و`R2_ACCESS_KEY_ID` و`R2_SECRET_ACCESS_KEY` و`R2_BUCKET`. هيكل التطبيق أقدر أبنيه بدونها. مفتاح Steel حقك للتجربة يدخل من صفحة المفاتيح في التطبيق نفسه، مو من `.env`.
- [ ] 2026-10-09 · أمر · `npx @insforge/cli link --project-id <project-id>` — بعد إنشاء مشروع InsForge. يربط المجلد بالمشروع عشان الوكيل يقرأ السكيمة ويطبّق التعديلات. يحتاج تسجيل دخولك.
- [ ] 2026-10-09 · أمر · `npx trigger.dev@latest login` — بعد إنشاء مشروع Trigger.dev. بدونه ما نقدر نشغّل المهام محليًا ولا ننشرها. يحتاج تسجيل دخولك.
- [x] 2026-10-09 · قرار · كل شي على خدمة وحدة ولا نوزّع على أكثر من حد مجاني؟ → **نوزّع**. InsForge للقاعدة والتوثيق فقط، والتوثيق يبقى مع القاعدة (أحمد بالشات، 2026-10-09)
- [x] 2026-10-09 · قرار · المتصفح السحابي؟ → **Steel أساسي** (أحمد بالشات، 2026-10-09)

## التسليم
**تم:**
- الستاك مقفل في `AGENTS.md`، و`CLAUDE.md` يستورده. النسخة الأولى (كل شي على InsForge + Vercel Workflow + Browserbase) انلغت بقرار أحمد: نوزّع على Vercel وInsForge وR2 وTrigger.dev، والمتصفح Steel.
- تحقّقت من المصادر الرسمية: أسعار InsForge وحزمة `@insforge/sdk/ssr`، وحدود Vercel Hobby، وR2، وTrigger.dev (الحوسبة والـrealtime)، وSteel (الرصيد والجلسات والبث الحي).
- `git init` + `.gitignore` يستبعد `.env*`.

**باقي (بالترتيب):**
1. أحمد ينشئ الحسابات الأربعة ويضيف المتغيرات (البنود فوق).
2. هيكل Next.js 16 + pnpm + Tailwind/shadcn + RTL، ومجلد `trigger/` للمهام.
3. سكيمة القاعدة + RLS: profiles، provider_keys، documents، companies، jobs (مشتركة)، user_jobs، chats/messages، applications، application_events.
4. التوثيق عبر `@insforge/sdk/ssr` (بريد + Google + Microsoft).
5. R2: روابط موقّعة للرفع والتنزيل + CORS.
6. BYOK: التشفير وصفحة إدارة المفاتيح.
7. الشات بأدوات البحث (Exa + واجهات ATS).
8. مهمة التقديم في Trigger.dev مع Steel + محوّل Greenhouse أولًا، ثم تجربة على عينة وظائف حقيقية وقياس النجاح والوقت والتكلفة.

**لازم تعرفه:**
- `create-next-app` بيرفض هذا المجلد لسببين: فيه ملفات غير مسموحة (`AGENTS.md`، `CLAUDE.md`، `_AGENT_HUB/`)، واسم المجلد فيه مسافات فهو اسم حزمة npm غير صالح. ولّد في مجلد مؤقت باسم `cloud-job-automation` وانقل الملفات هنا.
- إعادة الاتصال بجلسة Steel بعد ما ينقطع الاتصال **مو موثّقة** (الجلسة تبقى لين تنحرر أو تنتهي مهلتها، لكن ما فيه توثيق إنك ترجع لها). لا تبني عليها قبل ما تختبرها.
- InsForge Sites ينشر على Vercel عبر InsForge، وما نستخدمه: ننشر مباشرة عشان نتحكم بالخطة والمنطقة.
