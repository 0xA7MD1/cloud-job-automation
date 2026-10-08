"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { CheckCircle2Icon, ExternalLinkIcon, RefreshCwIcon, StarIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROVIDER_INFO, readSettings } from "@/lib/byok/providers";
import type { Provider, ProviderKeyPublic } from "@/lib/db/types";
import { formatDateTime } from "@/lib/format";
import {
  deleteProviderKeyAction,
  reverifyProviderKeyAction,
  saveProviderKeyAction,
  setDefaultAiProviderAction,
  updateProviderSettingsAction,
  type KeyFormState,
} from "./actions";

const STATUS = {
  valid: { label: "يشتغل", variant: "default" },
  unverified: { label: "ما تأكدنا منه", variant: "secondary" },
  invalid: { label: "مرفوض", variant: "destructive" },
} as const;

export function ProviderCard({ provider, row }: { provider: Provider; row: ProviderKeyPublic | null }) {
  const info = PROVIDER_INFO[provider];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, save, saving] = useActionState<KeyFormState, FormData>(saveProviderKeyAction, {});
  const settings = readSettings(row?.settings);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);

  function run(action: () => Promise<KeyFormState>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {info.label}
          {settings.default && (
            <Badge variant="outline">
              <StarIcon aria-hidden />
              الافتراضي
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {row ? (
            <span className="flex flex-wrap items-center gap-2">
              <span dir="ltr" className="font-mono">
                ••••{row.last4}
              </span>
              <Badge variant={STATUS[row.status].variant}>{STATUS[row.status].label}</Badge>
              {row.verified_at && <span>آخر تحقق {formatDateTime(row.verified_at)}</span>}
            </span>
          ) : (
            "ما أضفت مفتاح."
          )}
        </CardDescription>
        <CardAction>
          <a
            href={info.keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            المفتاح من هنا
            <ExternalLinkIcon className="size-3.5" aria-hidden />
          </a>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {info.note && <p className="text-sm text-muted-foreground">{info.note}</p>}

        <form action={save} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <input type="hidden" name="provider" value={provider} />
          <Field data-invalid={!!state.error} className="flex-1">
            <FieldLabel htmlFor={`${provider}-key`} className="sr-only">
              مفتاح {info.label}
            </FieldLabel>
            <Input
              id={`${provider}-key`}
              name="apiKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              placeholder={row ? "مفتاح جديد يستبدل الحالي" : "الصق المفتاح هنا"}
              required
              aria-invalid={!!state.error}
            />
            <FieldError>{state.error}</FieldError>
          </Field>
          <Button type="submit" disabled={saving}>
            {saving ? "جاري التحقق…" : row ? "استبدال" : "حفظ"}
          </Button>
        </form>

        {row && info.kind === "ai" && (
          <ModelPicker provider={provider} current={settings.model} models={settings.models} />
        )}

        {row && provider === "steel" && (
          <div className="flex items-start gap-3">
            <Checkbox
              id="steel-captcha"
              checked={settings.captchaEnabled}
              disabled={pending}
              onCheckedChange={(checked) =>
                run(() => updateProviderSettingsAction("steel", { captchaEnabled: checked === true }))
              }
            />
            <div className="grid gap-1">
              <Label htmlFor="steel-captcha">فعّلت حل الكابتشا في حسابي عند Steel</Label>
              <p className="text-sm text-muted-foreground">
                بعد إيداع $10 مرة وحدة عندهم. بدونه نطلب منك تحل الكابتشا بنفسك وقت التقديم.
              </p>
            </div>
          </div>
        )}

        {row && (
          <div className="flex flex-wrap gap-2">
            {info.kind === "ai" && !settings.default && (
              <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setDefaultAiProviderAction(provider))}>
                <CheckCircle2Icon data-icon="inline-start" aria-hidden />
                اجعله الافتراضي للشات
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => reverifyProviderKeyAction(provider))}>
              <RefreshCwIcon data-icon="inline-start" aria-hidden />
              تحقق
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => run(() => deleteProviderKeyAction(provider), `تحذف مفتاح ${info.label}؟`)}
            >
              <Trash2Icon data-icon="inline-start" aria-hidden />
              حذف
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModelPicker({ provider, current, models }: { provider: Provider; current?: string; models?: string[] }) {
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(current ?? "");
  const [pending, startTransition] = useTransition();
  const changed = value.trim() !== (current ?? "") && value.trim().length > 0;

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await updateProviderSettingsAction(provider, { model: value.trim() });
          if (result.ok) toast.success("انحفظ النموذج.");
          else toast.error(result.error);
          router.refresh();
        });
      }}
    >
      <Field className="flex-1">
        <FieldLabel htmlFor={`${provider}-model`}>النموذج</FieldLabel>
        <Input
          id={`${provider}-model`}
          list={listId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          dir="ltr"
          spellCheck={false}
        />
        <datalist id={listId}>
          {models?.map((model) => <option key={model} value={model} />)}
        </datalist>
        <FieldDescription>
          {models?.length ? `${models.length} نموذج متاح لمفتاحك. اختر واحد يدعم الأدوات.` : "اكتب اسم النموذج كما عند المزود."}
        </FieldDescription>
      </Field>
      <Button type="submit" variant="outline" disabled={!changed || pending} className="sm:mb-7">
        حفظ النموذج
      </Button>
    </form>
  );
}
