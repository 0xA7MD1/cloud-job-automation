# Cloud Job Automation

بوت شات يبحث عن الشركات ووظائفها الرسمية، ويقدّم عليها **فعليًا** نيابةً عن المستخدم، ويحفظ نتائج البحث وسياقها. كل مستخدم يضيف مفاتيح مزوديه (BYOK).

## الستاك — مقفل (2026-10-09)

لا تستبدل طبقة ولا تضيف خدمة جديدة بدون موافقة أحمد.
«الأولى» = نبنيه في النسخة الأولى. «لاحقًا» = الاختيار محسوم، لكن لا تبنيه الحين.

| الطبقة | الاختيار | المرحلة |
|---|---|---|
| الإطار | Next.js 16 (App Router) + TypeScript strict. الواجهة والشات وواجهات API في تطبيق واحد، بدون Fastify/Express | الأولى |
| الاستضافة | Vercel، ننشر مباشرة من حسابنا (مو عبر InsForge Sites) | الأولى |
| قاعدة البيانات | InsForge Postgres + RLS على كل جدول فيه `user_id` | الأولى |
| التوثيق | InsForge Auth عبر `@insforge/sdk/ssr`: بريد + Google + Microsoft | الأولى |
| الملفات | InsForge Storage: bucket خاص + روابط تنزيل مؤقتة (CV، cover letters، أدلة التقديم) | الأولى |
| تحديثات حية | InsForge Realtime لحالة التقديم في الواجهة | الأولى |
| المهام الطويلة | Vercel Workflow (حزمة `workflow`) داخل نفس تطبيق Next.js | الأولى |
| الجدولة | InsForge Schedules تنادي route في Vercel يبدأ الـWorkflow | الأولى |
| الشات | AI SDK 7 (`ai`) + أدوات تطبيق واضحة | الأولى |
| مزود الذكاء | يختاره المستخدم بمفتاحه: Groq، OpenRouter، OpenAI، Anthropic، Google | الأولى |
| مفاتيح BYOK | تشفير AES-256-GCM في الخادم بمفتاح رئيسي في env | الأولى |
| بحث الشركات | Exa، وTavily بديل، بمفتاح المستخدم | الأولى |
| الوظائف الرسمية | واجهات Greenhouse / Lever / Ashby العامة + جلب صفحة careers مباشرة | الأولى |
| المتصفح السحابي | Browserbase + `playwright-core` عبر CDP، بمفتاح المستخدم | الأولى |
| تعبئة النماذج | محوّلات Playwright لـGreenhouse / Lever / Ashby | الأولى |
| المستندات | `docx` للـWord، و`@react-pdf/renderer` للـPDF (العربي يُختبر قبل اعتماده: تشكيل الحروف واتجاهها) | الأولى |
| البريد للشركات | مسودة أو `mailto`، والمستخدم يرسل بنفسه | الأولى |
| واتساب / إنستغرام / X | رابط Click-to-Chat ومسودات؛ الإرسال يدوي دائمًا | الأولى |
| أدوات | pnpm، Tailwind + shadcn/ui، Zod 4، واجهة RTL | الأولى |
| نماذج تقديم غير معروفة | Stagehand فوق Playwright | لاحقًا |
| متصفح احتياطي | Steel | لاحقًا |
| صفحات صعبة القراءة | Firecrawl | لاحقًا |
| مصادر وظائف تكميلية | Hirebase، TheirStack | لاحقًا |
| شركات قريبة | Google Places (نحفظ `place_id` فقط) | لاحقًا |
| إرسال البريد باسم المستخدم | Gmail OAuth + Microsoft Graph | لاحقًا |
| بحث دلالي | Embeddings في نفس القاعدة (نتحقق من دعم pgvector في InsForge وقتها) | لاحقًا |
| تحصيل الاشتراكات | Moyasar / Tap / PayTabs حسب بلد تسجيل النشاط؛ Stripe غير متاح لكيان سعودي | لاحقًا |

### ليش Vercel Workflow بدل Trigger.dev

يعيش داخل نفس تطبيق Next.js ونفس النشر. فيه hooks توقف التقديم لين يجاوب المستخدم في الشات ثم تكمل، و`sleep` بدون استهلاك حوسبة، و50 ألف حدث شهريًا في Hobby. قيده الوحيد: **كل خطوة ≤ 300 ثانية في Hobby** (800 في Pro).

**مخرج الطوارئ:** لو أثبتت الاختبارات الحقيقية أن خطوة المتصفح ما تكفيها 5 دقائق ⇒ ننقل خطوة المتصفح وحدها إلى Trigger.dev (بلا مهلة)، أو نرقّي Vercel Pro. هذا قرار أحمد وقتها.

## تصميم التقديم — قواعد لا تُكسر

1. **جهّز كل شي قبل فتح المتصفح:** إجابات الحقول، نسخة CV، cover letter. المتصفح ما ينفتح إلا والشغل جاهز.
2. **خطوة المتصفح ≤ 4.5 دقيقة**، هامش تحت حد الـ300 ثانية.
3. **سؤال ما نعرف جوابه ⇒ لا ترسل.** سكّر الجلسة، اسأل المستخدم في الشات (hook)، وبعد جوابه افتح جلسة جديدة واملأ من الصفر. Browserbase المجاني ما فيه keepAlive، فالجلسة تموت لما ينقطع الاتصال؛ لا تصمّم على استئناف نفس الجلسة.
4. **كابتشا أو تحقق بشري ⇒ وقّف** وسلّم المستخدم رابط الوظيفة مع إجاباته الجاهزة ليكمل يدويًا. لا نتجاوز الكابتشا.
5. **النجاح = دليل** محفوظ في Storage (صفحة تأكيد، رقم طلب، أو بريد تأكيد). الضغط على زر «إرسال» مو نجاح.
6. **خطوة الإرسال بدون إعادة محاولة تلقائية.** سجّل `submit_attempted` في القاعدة قبل الضغط؛ لو انعادت الخطوة والحالة مسجّلة ⇒ تحقّق من الدليل بدل ما ترسل مرة ثانية.
7. **النموذج ما عنده أداة إرسال.** أدواته مثل `searchCompanies` و`searchOfficialJobs` و`prepareApplication`. الإرسال يبدأ بتأكيد المستخدم من الواجهة.
8. نتيجة البحث تنحفظ بمعرّف ومصدر وتاريخ، والشات يرجع للسجلات بدل ما يعيد اختراعها من نص المحادثة.

## الأسرار والبيانات

- **مفاتيح BYOK:** تُشفَّر في الخادم قبل الحفظ، مع `key_version` في كل صف للتدوير. الجدول بدون أي صلاحية قراءة للواجهة؛ الواجهة تشوف اسم المزود وآخر 4 أحرف فقط. المفتاح ما يروح للواجهة ولا للنموذج ولا للسجلات. **RLS مو تشفير.**
- **Workflow يحفظ مدخلات ومخرجات كل خطوة في سجل أحداثه** ⇒ لا تمرّر مفتاحًا مفكوكًا ولا محتوى CV ولا توكن كمدخل أو مخرج خطوة. مرّر معرّفات، وفك التشفير داخل الخطوة الي تستخدمه.
- **`createAdminClient` يتجاوز RLS** ⇒ فقط في كود الخادم (Workflow والجدولة)، ودائمًا بفلتر `user_id` صريح. بقية الكود يستخدم عميل الجلسة (`createServerClient`) عشان RLS يشتغل.
- **Google Places:** احفظ `place_id` فقط. البيانات الي نجمعها من موقع الشركة نفسه تنحفظ عادي.
- **Gemini المجاني** يستخدم البيانات لتحسين منتجات Google ⇒ مو افتراضي لبيانات CV، ونبّه المستخدم لو اختاره.
- الحصص المجانية للحساب عند المزود، مو للمفتاح: مفتاحين من نفس حساب Groq ما يضاعفون الحد.

## حدود الخطط المؤثرة على التصميم

| القيد | الأثر |
|---|---|
| Vercel Hobby للاستخدام الشخصي غير التجاري | قبل أول مستخدم يدفع: Vercel Pro ($20/شهر لكل مطوّر) |
| Vercel Hobby: الدالة وخطوة Workflow ≤ 300 ثانية | قواعد التقديم فوق |
| Vercel Hobby: Cron مرة يوميًا وبدقة ±59 دقيقة | الجدولة من InsForge Schedules (أقل فاصل دقيقة) |
| Vercel Hobby: بيانات Workflow تنحفظ يوم واحد بعد انتهاء التشغيل | الحالة الدائمة في InsForge، مو في Workflow |
| InsForge Free: يتوقف بعد أسبوع خمول؛ 500MB قاعدة، 1GB ملفات، 5GB نقل | للتطوير فقط. الإنتاج: InsForge Pro ($25/شهر، أو $20 بالسنوي) |
| InsForge Schedules بدون إعادة محاولة | الـroute لازم idempotent ويتحقق من `CRON_SECRET` |
| Browserbase Free (لكل حساب مستخدم): ساعة شهريًا، 15 دقيقة للجلسة، 3 متزامنة، بدون keepAlive ولا حل كابتشا ولا stealth | قواعد التقديم فوق |
| موقع دوال Vercel | نفس منطقة مشروع InsForge (اضبطها في `vercel.json`) |

## متغيرات البيئة

قيمها في `.env.local` محليًا وفي إعدادات Vercel. لا تنكتب في الكود ولا في الشات.

| المتغير | النطاق | ملاحظة |
|---|---|---|
| `NEXT_PUBLIC_INSFORGE_URL` | عام | يقرأه `@insforge/sdk/ssr` تلقائيًا |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | عام | يقرأه `@insforge/sdk/ssr` تلقائيًا |
| `INSFORGE_API_KEY` | خادم فقط | مفتاح admin لـ`createAdminClient` |
| `BYOK_MASTER_KEY` | خادم فقط | 32 بايت base64 |
| `CRON_SECRET` | خادم + سر في InsForge | ترسله Schedules في الهيدر |

## مصادر التحقق (2026-10-09)

- [InsForge pricing](https://insforge.dev/pricing) · [InsForge Schedules](https://docs.insforge.dev/core-concepts/functions/schedules) · [InsForge Edge Functions](https://docs.insforge.dev/core-concepts/functions/overview) · README حزمة `@insforge/sdk` (قسم SSR / Next.js)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby) · [Vercel Workflow limits](https://vercel.com/docs/workflows/pricing) · [Vercel Workflow concepts](https://vercel.com/docs/workflows/concepts) · [Vercel Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Browserbase pricing](https://www.browserbase.com/pricing) · [Browserbase keepAlive](https://docs.browserbase.com/platform/browser/long-sessions/keep-alive)
- بقية المزودين: تقرير المقارنة الأصلي (2026-09-29) الي بنى عليه أحمد هذا الستاك.
