import Link from "next/link";
import { BriefcaseBusinessIcon, FileCheck2Icon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: SearchIcon,
    title: "يلقى الشركات",
    body: "قل له وش تبي، ويرجع لك شركات تناسبك مع مصدر كل نتيجة.",
  },
  {
    icon: BriefcaseBusinessIcon,
    title: "الوظائف الرسمية بس",
    body: "يقرأ صفحات التوظيف الرسمية للشركات، مو إعلانات منسوخة.",
  },
  {
    icon: FileCheck2Icon,
    title: "يقدّم عنك فعليًا",
    body: "يعبّي النموذج، وما يحسب الطلب ناجح إلا بدليل محفوظ.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-12 px-6 py-16">
      <section className="flex flex-col gap-5">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          مساعد يبحث ويقدّم على الوظائف عنك
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
          تضيف مفاتيحك، ترفع سيرتك، وتقول له وش تدوّر. هو يجهّز الطلب، وأنت
          توافق قبل أي إرسال.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">ابدأ مجانًا</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/sign-in">عندي حساب</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex flex-col gap-2">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
