"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useState, useTransition, type ReactNode } from "react";
import { ListChecksIcon, SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { startBatchAction } from "../../applications/actions";

// «قدّم على المحدد»: تحديد وظائف كثيرة وتأكيد واحد (قاعدة 8). كل وظيفة تتجهّز، والي تكمل
// إجاباتها تنرسل لحالها، والي ينقصها جواب تنتظر في «ينتظر جوابك».

type Provider = "local" | "steel";

const PROVIDER_LABEL: Record<Provider, string> = { local: "Chrome على جهازك", steel: "Steel (سحابي)" };

interface Selection {
  eligible: string[];
  selected: Set<string>;
  toggle(jobId: string, on: boolean): void;
  setAll(on: boolean): void;
}

const SelectionContext = createContext<Selection | null>(null);

function useSelection(): Selection {
  const value = use(SelectionContext);
  if (!value) throw new Error("BulkApply components need <BulkApplyProvider>");
  return value;
}

export function BulkApplyProvider({ eligible, children }: { eligible: string[]; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const toggle = (jobId: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  const setAll = (on: boolean) => setSelected(on ? new Set(eligible) : new Set());
  return <SelectionContext value={{ eligible, selected, toggle, setAll }}>{children}</SelectionContext>;
}

export function JobCheckbox({ jobId, title }: { jobId: string; title: string }) {
  const { selected, toggle } = useSelection();
  return (
    <Checkbox
      checked={selected.has(jobId)}
      onCheckedChange={(checked) => toggle(jobId, checked === true)}
      aria-label={`حدّد: ${title}`}
      className="size-5"
    />
  );
}

export function SelectAllButton() {
  const { eligible, selected, setAll } = useSelection();
  if (eligible.length === 0) return null;
  const all = selected.size === eligible.length;
  return (
    <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
      <ListChecksIcon data-icon="inline-start" aria-hidden />
      {all ? "ألغِ التحديد" : `حدّد الكل (${eligible.length})`}
    </Button>
  );
}

interface BarProps {
  providers: Provider[];
  steelMissing: string | null;
  /** باقي التقديمات هذا الشهر */
  left: number | null;
  maxBatch: number;
}

export function BulkApplyBar({ providers, steelMissing, left, maxBatch }: BarProps) {
  const router = useRouter();
  const { selected, setAll } = useSelection();
  const [choice, setChoice] = useState<Provider | undefined>(providers[0]);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const provider = choice && providers.includes(choice) ? choice : providers[0];
  const count = selected.size;
  if (count === 0) return null;

  const tooMany = count > maxBatch;
  const overQuota = left !== null && count > left;
  const blocked = !provider ? (steelMissing ?? "ما فيه متصفح متاح.") : tooMany
    ? `الحد ${maxBatch} وظيفة بالدفعة الوحدة.`
    : overQuota
      ? `باقي لك ${left} تقديم هذا الشهر.`
      : null;

  const start = () =>
    startTransition(async () => {
      const result = await startBatchAction([...selected], provider);
      if (!result.ok) {
        toast.error(result.error);
        setConfirming(false);
        return;
      }
      const { preparing, submitting, waiting, skipped } = result.data;
      toast.success(
        [
          preparing && `${preparing} تتجهّز وتنرسل لحالها`,
          submitting && `${submitting} بدأ إرسالها`,
          waiting && `${waiting} تنتظر جوابك`,
          skipped && `${skipped} ما دخلت (انرسلت أو شغّالة)`,
        ]
          .filter(Boolean)
          .join(" · "),
      );
      setAll(false);
      setConfirming(false);
      router.push("/applications?tab=active");
    });

  return (
    <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-border bg-(--glass) p-4 shadow-(--card-shadow) backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">حدّدت {count} وظيفة</span>
        {providers.length > 1 && (
          <div role="radiogroup" aria-label="المتصفح" className="flex flex-wrap gap-2">
            {providers.map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                role="radio"
                aria-checked={provider === p}
                variant={provider === p ? "default" : "outline"}
                disabled={pending}
                onClick={() => setChoice(p)}
              >
                {PROVIDER_LABEL[p]}
              </Button>
            ))}
          </div>
        )}
        <div className="ms-auto flex gap-2">
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => setAll(false)} aria-label="ألغِ التحديد">
            <XIcon aria-hidden />
          </Button>
          {!confirming && (
            <Button size="sm" disabled={!!blocked || pending} onClick={() => setConfirming(true)}>
              <SendIcon data-icon="inline-start" aria-hidden />
              قدّم على المحدد
            </Button>
          )}
        </div>
      </div>
      {blocked && <p className="text-sm text-destructive">{blocked}</p>}
      {confirming && !blocked && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm">
            بنجهّز {count} طلب (الأسئلة، الإجابات، خطاب لكل وظيفة)، والي تكمل إجاباته نقدّم عليه باسمك مباشرة
            {provider === "local" ? " في Chrome على جهازك (لازم `pnpm trigger:dev` شغّال)" : " في متصفح Steel السحابي"}، ثلاث
            بنفس الوقت. الي ينقصه جوابك ينتظرك في «ينتظر جوابك» وينرسل أول ما تجاوب. ما نعيد أي إرسال تلقائيًا.
          </p>
          <div className="flex gap-2">
            <Button disabled={pending} onClick={start}>
              {pending ? "نبدأ..." : `أكّد وقدّم على ${count}`}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              تراجع
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
