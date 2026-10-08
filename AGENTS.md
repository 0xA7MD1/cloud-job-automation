# Cloud Job Automation

بوت شات يبحث عن الشركات ووظائفها الرسمية، ويقدّم عليها **فعليًا** نيابةً عن المستخدم، ويحفظ نتائج البحث وسياقها. كل مستخدم يضيف مفاتيح مزوديه (BYOK).

## المبدأ: نفصل بس لما الفصل يستاهل

نفصل الخدمة لما تعطينا قدرة ما نقدر نسويها بغيرها، أو تشيل حملًا ثقيلًا عن حد مجاني. أما الشي الي بيدخل في ترقية InsForge أصلًا، فيبقى في InsForge.

- **InsForge = القاعدة + التوثيق + الملفات.** ترقية Pro الي بنسويها للقاعدة تعطي 100GB ملفات و250GB نقل. وسياسات الملفات تقرأ نفس JWT الي تقرأه RLS، فما فيه صلاحيات ثانية نصونها. التخزين متوافق مع S3، فلو صار النقل هو الحد يومًا ما، النقل لـR2 سهل.
- **Trigger.dev منفصل** لأنه يشغّل مهام بلا مهلة، ويشيل الحوسبة الثقيلة عن Vercel.

| الخدمة | تشيل إيش | الحد المجاني الي يحكمنا |
|---|---|---|
| Vercel Hobby | الواجهة، الشات (بث)، واجهات API قصيرة | مليون استدعاء، 4 ساعات CPU، 100GB نقل شهريًا. **غير تجاري** |
| InsForge Free | Postgres + Auth + Storage | 500MB قاعدة، 1GB ملفات، 5GB نقل، 50 ألف MAU. يتوقف بعد أسبوع خمول |
| Trigger.dev Free | كل الشغل الخلفي + حالة التقديم الحية | $5 حوسبة شهريًا، 20 تشغيل متزامن، 10 جداول، 10 اتصالات realtime |
| مزودون بمفتاح المستخدم | Steel، نماذج AI، Exa/Tavily | على حساب كل مستخدم، مو علينا |

## الستاك — مقفل (2026-10-09)

لا تستبدل طبقة ولا تضيف خدمة جديدة بدون موافقة أحمد.
«الأولى» = نبنيه في النسخة الأولى. «لاحقًا» = الاختيار محسوم، لكن لا تبنيه الحين.

| الطبقة | الاختيار | المرحلة |
|---|---|---|
| الإطار | Next.js 16 (App Router) + TypeScript strict. الواجهة والشات وواجهات API في تطبيق واحد، بدون Fastify/Express | الأولى |
| الاستضافة | Vercel، ننشر مباشرة من حسابنا (مو عبر InsForge Sites) | الأولى |
| قاعدة البيانات | InsForge Postgres + RLS على كل جدول فيه `user_id` | الأولى |
| التوثيق | InsForge Auth عبر `@insforge/sdk/ssr`: بريد + Google + Microsoft | الأولى |
| الملفات | InsForge Storage: bucket خاص، رفع مباشر من المتصفح برابط موقّع، تنزيل برابط مؤقت | الأولى |
| الشغل الخلفي | Trigger.dev v4: التقديم، الفحص الدوري، توليد المستندات. المهام في نفس الريبو (`trigger/`) | الأولى |
| الجدولة | جدول Trigger.dev واحد يختار المستخدمين المستحقين ويوزّع عليهم (مو جدول لكل مستخدم) | الأولى |
| حالة التقديم الحية | Trigger.dev Realtime (`useRealtimeRun`) + الحالة الدائمة في القاعدة | الأولى |
| الشات | AI SDK 7 (`ai`) على Vercel + أدوات تطبيق واضحة | الأولى |
| مزود الذكاء | يختاره المستخدم بمفتاحه: Groq، OpenRouter، OpenAI، Anthropic، Google | الأولى |
| مفاتيح BYOK | تشفير AES-256-GCM في الخادم بمفتاح رئيسي في env | الأولى |
| بحث الشركات | Exa، وTavily بديل، بمفتاح المستخدم | الأولى |
| الوظائف الرسمية | واجهات Greenhouse / Lever / Ashby العامة + جلب صفحة careers مباشرة | الأولى |
| المتصفح السحابي | **Steel** + `playwright-core` عبر CDP، بمفتاح المستخدم. خيارات الجلسة `solveCaptcha` و`stealthConfig` و`useProxy`، والبث الحي (`debugUrl`) للتدخل البشري | الأولى |
| متصفح المالك | **محلي**: Chromium على جهاز أحمد عبر Playwright، والمهمة تشتغل عنده بـ`pnpm trigger:dev` (تشغيلات التطوير ما تنحسب). $0 بلا حد للوصول لـ500 تقديم شهريًا. نافذة ظاهرة فيحل الكابتشا بنفسه. نفس واجهة مزود المتصفح، ومقصور على حساب المالك (2026-10-09) | الأولى |
| تعبئة النماذج | محوّلات Playwright لـGreenhouse / Lever / Ashby | الأولى |
| المستندات | `docx` للـWord، و`@react-pdf/renderer` للـPDF، تتولّد داخل Trigger.dev (العربي يُختبر قبل اعتماده: تشكيل الحروف واتجاهها) | الأولى |
| البريد للشركات | مسودة أو `mailto`، والمستخدم يرسل بنفسه | الأولى |
| واتساب / إنستغرام / X | رابط Click-to-Chat ومسودات؛ الإرسال يدوي دائمًا | الأولى |
| أدوات | pnpm، Tailwind + shadcn/ui، Zod 4، واجهة RTL | الأولى |
| نماذج تقديم غير معروفة | Stagehand فوق Playwright | لاحقًا |
| متصفح احتياطي | Browserbase عبر نفس واجهة مزود المتصفح | لاحقًا |
| صفحات صعبة القراءة | Firecrawl | لاحقًا |
| مصادر وظائف تكميلية | Hirebase، TheirStack | لاحقًا |
| شركات قريبة | Google Places (نحفظ `place_id` فقط) | لاحقًا |
| إرسال البريد باسم المستخدم | Gmail OAuth + Microsoft Graph | لاحقًا |
| إشعارات المنصة بالبريد | Resend | لاحقًا |
| بحث دلالي | Embeddings (نتحقق من دعم pgvector في InsForge وقتها) | لاحقًا |
| تحصيل الاشتراكات | Moyasar / Tap / PayTabs حسب بلد تسجيل النشاط؛ Stripe غير متاح لكيان سعودي | لاحقًا |

**مو مستخدمة عمدًا:** InsForge Realtime وSchedules وEdge Functions، وVercel Workflow وCron. وظائفها كلها عند Trigger.dev فوق.

## أين تعيش البيانات

- **الوظائف والشركات مشتركة بين المستخدمين:** صف واحد لكل وظيفة (فريد بالمصدر + المعرّف الخارجي)، وجدول ربط للمستخدم. لا تكرّر الوظيفة لكل مستخدم.
- **النصوص الطويلة (وصف الوظيفة، الصفحات المجلوبة) تبقى في القاعدة.** Postgres يضغط القيم الكبيرة تلقائيًا، فما نحتاج نخرجها لمكان ثاني.
- **الملفات في Storage، وبياناتها في جدول:** CV، cover letters، المستندات المولّدة، لقطات أدلة التقديم. الجدول فيه المالك والاسم والحجم والنوع والمسار.
- **الملفات ما تمر عبر دوال Vercel:** حد جسم الطلب في Vercel 4.5MB، والنقل يستهلك حصتنا. المتصفح يرفع مباشرة لـInsForge Storage برابط موقّع، ومهام Trigger.dev تقرأ وتكتب بعميل الخادم.

## تصميم التقديم — قواعد لا تُكسر

1. **جهّز كل شي قبل فتح المتصفح:** إجابات الحقول، نسخة CV، cover letter. دقائق المتصفح أغلى من دقائق Trigger.dev.
2. **جلسة Steel:** حدّد `timeout` (أقصاه 15 دقيقة في الخطة المجانية) و`inactivityTimeout`، وسكّرها بـ`sessions.release` في `finally` دائمًا. الجلسة المعلّقة تنحسب لين تنتهي مهلتها.
3. **تدخل بشري (كابتشا ما انحلت، OTP، سؤال ما نعرف جوابه):** المهمة تكتب `needs_user` في metadata التشغيل، والواجهة تعرض البث الحي التفاعلي للمالك فقط، والمهمة تنتظر **داخل نفس الجلسة** بحلقة تحقق. لا تستخدم `wait.for` أو `wait.forToken` والاتصال بالمتصفح مفتوح: الانتظار يسوي checkpoint للعملية، وما نضمن يرجع الاتصال المفتوح بعده. لو لازم انتظار طويل ⇒ سكّر الجلسة، انتظر، ثم افتح جلسة جديدة واملأ من الصفر.
4. **رابط البث (`debugUrl`) بدون توثيق عند Steel:** أي أحد معه الرابط يشوف الجلسة ويتحكم فيها. يوصل لمالك الطلب فقط عبر route موثّق، ولا ينحفظ في القاعدة ولا في السجلات.
5. **الكابتشا والحماية من البوتات:** لو المستخدم فعّل حل الكابتشا في حسابه عند Steel (إيداع $10 لمرة وحدة)، نشغّل `solveCaptcha` و`stealthConfig`. والبروكسي (`useProxy`) بس للمواقع الي تحجبنا، لأنه $10 لكل GB على حساب المستخدم. لو ما فعّلها أو فشل الحل ⇒ ننتقل للتدخل البشري (القاعدة 3). ما فيه مزود يضمن إن الموقع ما يحجب.
6. **النجاح = دليل** محفوظ في Storage (صفحة تأكيد، رقم طلب، أو بريد تأكيد). الضغط على زر «إرسال» مو نجاح.
7. **الإرسال بدون إعادة محاولة تلقائية.** سجّل `submit_attempted` في القاعدة قبل الضغط؛ لو انعاد التشغيل والحالة مسجّلة ⇒ تحقّق من الدليل بدل ما ترسل مرة ثانية.
8. **النموذج ما عنده أداة إرسال.** أدواته مثل `searchCompanies` و`searchOfficialJobs` و`prepareApplication`. الإرسال يبدأ بتأكيد المستخدم من الواجهة.
9. نتيجة البحث تنحفظ بمعرّف ومصدر وتاريخ، والشات يرجع للسجلات بدل ما يعيد اختراعها من نص المحادثة.

## الأسرار

- **مفاتيح BYOK:** تُشفَّر في الخادم قبل الحفظ، مع `key_version` في كل صف للتدوير. الجدول بدون أي صلاحية قراءة للواجهة؛ الواجهة تشوف اسم المزود وآخر 4 أحرف فقط. المفتاح ما يروح للواجهة ولا للنموذج ولا للسجلات. **RLS مو تشفير.**
- **Trigger.dev يحفظ مدخلات ومخرجات كل تشغيل ويعرضها في لوحته** ⇒ لا تمرّر مفتاحًا مفكوكًا ولا محتوى CV ولا توكن. مرّر معرّفات، وفك التشفير داخل المهمة الي تستخدمه.
- **`createAdminClient` يتجاوز RLS وسياسات الملفات** ⇒ عبر `src/lib/insforge/admin.ts` بس، وفي كود الخادم بس: مهام Trigger.dev، ومسارات Vercel الي تكتب الجداول المشتركة (`companies`، `jobs`) أو تقرأ المفتاح المشفّر. ودائمًا بفلتر `user_id` صريح على جداول المستخدم. بقية الكود يستخدم عميل الجلسة (`createServerClient` / `createBrowserClient`) عشان RLS يشتغل.
- **Google Places:** احفظ `place_id` فقط. البيانات الي نجمعها من موقع الشركة نفسه تنحفظ عادي.
- **Gemini المجاني** يستخدم البيانات لتحسين منتجات Google ⇒ مو افتراضي لبيانات CV، ونبّه المستخدم لو اختاره.
- الحصص المجانية للحساب عند المزود، مو للمفتاح: مفتاحين من نفس حساب Groq ما يضاعفون الحد.

## حدود الخطط المؤثرة على التصميم

| القيد | الأثر |
|---|---|
| Vercel Hobby للاستخدام الشخصي غير التجاري | المجاني يصلح ما دام ما نأخذ فلوس. قبل أول مستخدم يدفع: Vercel Pro ($20/شهر لكل مطوّر) |
| InsForge Free: يتوقف بعد أسبوع خمول؛ 1GB ملفات و5GB نقل (الملفات تنحسب منه) | قبل الإطلاق للعامة: InsForge Pro ($25/شهر، أو $20 بالسنوي): 8GB قاعدة، 100GB ملفات، 250GB نقل |
| Trigger.dev: $5 حوسبة شهريًا. Micro (0.25 vCPU / 0.25GB) بـ$0.0000169 للثانية + $0.000025 لكل تشغيل | المهام على Micro افتراضيًا؛ المتصفح بعيد عند Steel فالعميل خفيف. تشغيلات التطوير مجانية |
| Trigger.dev: 10 اتصالات realtime متزامنة | لو تعدّينا ⇒ الواجهة تستطلع حالة الطلب من القاعدة بدل الاشتراك |
| Steel Launch (لكل حساب مستخدم): $30 رصيد **مرة وحدة** صالح 90 يومًا، ثم $0.10 للساعة؛ 15 دقيقة للجلسة، 10 متزامنة، 60 طلب/دقيقة | قواعد التقديم فوق |
| Steel: حل الكابتشا ($3 لكل ألف) والبروكسي ($10 لكل GB) يتفعّلون بإيداع $10، والرصيد المجاني ما يغطيهم | القاعدة 5 |
| منطقة دوال Vercel | نفس منطقة مشروع InsForge (اضبطها في `vercel.json`) |

## متغيرات البيئة

قيمها في `.env.local` محليًا، وفي إعدادات Vercel وTrigger.dev حسب العمود. لا تنكتب في الكود ولا في الشات.

| المتغير | أين | ملاحظة |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Vercel (عام) | رابط التطبيق، لروابط الرجوع من OAuth |
| `NEXT_PUBLIC_INSFORGE_URL` | Vercel (عام) + Trigger.dev | يقرأه `@insforge/sdk/ssr` تلقائيًا |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | Vercel (عام) | يقرأه `@insforge/sdk/ssr` تلقائيًا |
| `INSFORGE_API_KEY` | Vercel + Trigger.dev | مفتاح admin لـ`createAdminClient`، خادم فقط |
| `BYOK_MASTER_KEY` | Vercel + Trigger.dev | 32 بايت base64 |
| `TRIGGER_PROJECT_REF` | محليًا + CI | معرّف المشروع (`proj_...`) يقرأه `trigger.config.ts` |
| `TRIGGER_SECRET_KEY` | Vercel | عشان التطبيق يشغّل المهام |

القيم كلها تُقرأ عبر `readEnv()` في `src/lib/env.ts` (تتحقق بـZod وقت الاستخدام، فالبناء يشتغل بدون أسرار). الأسماء في `.env.example`.

## الهيكل والأوامر

- `src/app/` الواجهة ومسارات API · `src/lib/` المنطق المشترك · `trigger/` مهام Trigger.dev · `migrations/` سكيمة InsForge (`<14 رقم>_<اسم>.sql`)
- أي تعديل على السكيمة: ملف migration جديد (لا تعدّل ملف انطبق)، وحدّث `src/lib/db/types.ts`، وأضف حالته في `migrations/schema.test.ts`
- `pnpm dev` · `pnpm check` (lint + typecheck + test) · `pnpm build` · `pnpm trigger:dev`
- تطبيق السكيمة: `npx @insforge/cli db migrations up --all` (بعد `link`)

## مصادر التحقق (2026-10-09)

- [InsForge pricing](https://insforge.dev/pricing) · [InsForge Storage](https://docs.insforge.dev/core-concepts/storage/overview) · README حزمة `@insforge/sdk` (قسم SSR / Next.js)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Trigger.dev pricing](https://trigger.dev/pricing) · [Trigger.dev Realtime](https://trigger.dev/docs/realtime/overview)
- [Steel pricing & limits](https://docs.steel.dev/overview/pricinglimits) · [Steel session lifecycle](https://docs.steel.dev/overview/sessions-api/session-lifecycle) · [Steel live sessions](https://docs.steel.dev/overview/guides/view-and-embed-live-sessions)
- [Browserbase pricing](https://www.browserbase.com/pricing) (للمقارنة: المجاني بدون حل كابتشا ولا stealth؛ يبدآن من Developer بـ$20/شهر)
- بقية المزودين: تقرير المقارنة الأصلي (2026-09-29) الي بنى عليه أحمد هذا الستاك.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
