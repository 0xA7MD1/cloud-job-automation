# stack — تثبيت الستاك النهائي لبوت التقديم على الوظائف

## ينتظر أحمد
- [ ] 2026-10-09 · عائق · ما فيه مشروع InsForge ولا مشروع Vercel بعد. قبل ما نختبر التوثيق والبيانات أحتاج: (1) تنشئ مشروع InsForge وتختار منطقته، (2) تضيف `NEXT_PUBLIC_INSFORGE_URL` و`NEXT_PUBLIC_INSFORGE_ANON_KEY` و`INSFORGE_API_KEY` في `.env.local`، (3) تنشئ مشروع Vercel بنفس المتغيرات وتضبط منطقة دواله على منطقة InsForge. هيكل التطبيق نفسه أقدر أبنيه بدونها.
- [ ] 2026-10-09 · أمر · `npx @insforge/cli link --project-id <project-id>` — بعد إنشاء المشروع. يربط المجلد بمشروع InsForge عشان الوكيل يقرأ السكيمة ويطبّق التعديلات. يحتاج تسجيل دخولك، فلازم تشغّله أنت.

## التسليم
**تم:**
- الستاك مقفل في `AGENTS.md`، و`CLAUDE.md` يستورده (نسخة وحدة للـClaude والـCodex).
- تحقّقت من المصادر الرسمية: أسعار InsForge وحزمة `@insforge/sdk/ssr` وSchedules، وحدود Vercel Hobby وWorkflow وCron، وkeepAlive في Browserbase.
- `git init` + `.gitignore` يستبعد `.env*`.

**باقي (بالترتيب):**
1. أحمد ينشئ مشروعي InsForge وVercel ويضيف المتغيرات (البند فوق).
2. هيكل Next.js 16 + pnpm + Tailwind/shadcn + RTL.
3. سكيمة القاعدة + RLS: profiles، provider_keys، documents، companies، jobs، chats/messages، applications، application_events.
4. التوثيق عبر `@insforge/sdk/ssr` (بريد + Google + Microsoft).
5. BYOK: التشفير وصفحة إدارة المفاتيح.
6. الشات بأدوات البحث (Exa + واجهات ATS).
7. Workflow التقديم + محوّل Greenhouse أولًا، ثم تجربة على عينة وظائف حقيقية وقياس النجاح والوقت والتكلفة.

**لازم تعرفه:**
- `create-next-app` بيرفض هذا المجلد لسببين: فيه ملفات غير مسموحة (`AGENTS.md`، `CLAUDE.md`، `_AGENT_HUB/`)، واسم المجلد فيه مسافات فهو اسم حزمة npm غير صالح. ولّد في مجلد مؤقت باسم `cloud-job-automation` وانقل الملفات هنا.
- Trigger.dev (الي كان في تقرير المقارنة) انشال لصالح Vercel Workflow؛ السبب ومخرج الطوارئ في `AGENTS.md`.
- InsForge Sites ينشر على Vercel عبر InsForge، وما نستخدمه: ننشر مباشرة عشان نتحكم بالخطة والمنطقة والـWorkflow.
