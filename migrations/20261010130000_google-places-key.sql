-- مفتاح Google Places (BYOK): البحث عن شركات قريبة. نحفظ place_id بس من نتائجه (شروط Google)،
-- والباقي (الاسم، النطاق، الوظائف) نجمعه من موقع الشركة نفسه.

alter table public.provider_keys drop constraint provider_keys_provider_check;
alter table public.provider_keys add constraint provider_keys_provider_check check (
  provider in ('groq', 'openrouter', 'openai', 'anthropic', 'google', 'exa', 'tavily', 'steel', 'google_places')
);
