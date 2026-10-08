"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/lib/db/types";
import { STANDARD_QUESTIONS, WORKPLACE_OPTIONS, type Answers, type Preferences } from "@/lib/profile";
import { saveProfileAction, type ProfileFormState } from "./actions";

interface Props {
  profile: Partial<Profile>;
  answers: Answers;
  preferences: Preferences;
  cvFiles: { id: string; file_name: string }[];
}

const BASIC_FIELDS = [
  { name: "full_name", label: "الاسم الكامل (كما في السيرة)", autoComplete: "name" },
  { name: "phone", label: "الجوال (مع رمز الدولة)", autoComplete: "tel", ltr: true },
  { name: "city", label: "المدينة", autoComplete: "address-level2" },
  { name: "country", label: "الدولة", autoComplete: "country-name" },
  { name: "headline", label: "المسمى المهني", autoComplete: "organization-title" },
  { name: "years_experience", label: "سنوات الخبرة", inputMode: "numeric" as const, ltr: true },
] as const;

const LINK_FIELDS = [
  { name: "linkedin_url", label: "LinkedIn" },
  { name: "github_url", label: "GitHub" },
  { name: "portfolio_url", label: "موقعك / أعمالك" },
] as const;

export function ProfileForm({ profile, answers, preferences, cvFiles }: Props) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfileAction, {});
  const [custom, setCustom] = useState(answers.custom.length ? answers.custom : []);

  useEffect(() => {
    if (state.ok) toast.success("انحفظ ملفك.");
  }, [state.ok, state.savedAt]);

  const value = (name: keyof Profile) => {
    const v = profile[name];
    return v === null || v === undefined ? "" : String(v);
  };

  return (
    <form
      // onSubmit بدل action: React يصفّر الحقول بعد action، وهنا نبي القيم تبقى بعد الحفظ
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
      className="flex flex-col gap-10"
    >
      <FieldSet>
        <FieldLegend>بياناتك</FieldLegend>
        <FieldDescription>تتعبّى في نماذج التقديم كما هي، فاكتبها مثل ما تبيها تظهر.</FieldDescription>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {BASIC_FIELDS.map((field) => (
            <Field key={field.name}>
              <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                defaultValue={value(field.name)}
                autoComplete={"autoComplete" in field ? field.autoComplete : undefined}
                inputMode={"inputMode" in field ? field.inputMode : undefined}
                dir={"ltr" in field ? "ltr" : undefined}
              />
            </Field>
          ))}
          {LINK_FIELDS.map((field) => (
            <Field key={field.name}>
              <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
              <Input id={field.name} name={field.name} type="url" dir="ltr" defaultValue={value(field.name)} placeholder="https://" />
            </Field>
          ))}
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="summary">نبذة قصيرة</FieldLabel>
            <Textarea id="summary" name="summary" rows={4} maxLength={5000} defaultValue={value("summary")} />
            <FieldDescription>تُستخدم لكتابة خطابات التقديم.</FieldDescription>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="default_cv_file_id">السيرة الافتراضية</FieldLabel>
            <NativeSelect id="default_cv_file_id" name="default_cv_file_id" defaultValue={value("default_cv_file_id")}>
              <NativeSelectOption value="">{cvFiles.length ? "اختر سيرة" : "ارفع سيرة من «ملفاتي» أول"}</NativeSelectOption>
              {cvFiles.map((file) => (
                <NativeSelectOption key={file.id} value={file.id}>
                  {file.file_name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>الوظائف الي تدوّرها</FieldLegend>
        <FieldDescription>افصل بين العناصر بفاصلة.</FieldDescription>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="target_roles">المسميات</FieldLabel>
            <Input id="target_roles" name="target_roles" defaultValue={preferences.target_roles.join("، ")} placeholder="Frontend Engineer، مطور ويب" />
          </Field>
          <Field>
            <FieldLabel htmlFor="locations">المدن أو الدول</FieldLabel>
            <Input id="locations" name="locations" defaultValue={preferences.locations.join("، ")} placeholder="الرياض، دبي، Remote" />
          </Field>
          <Field>
            <FieldLabel htmlFor="workplace">نوع العمل</FieldLabel>
            <NativeSelect id="workplace" name="workplace" defaultValue={preferences.workplace}>
              {WORKPLACE_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="exclude_keywords">استبعد وظائف فيها</FieldLabel>
            <Input id="exclude_keywords" name="exclude_keywords" defaultValue={preferences.exclude_keywords.join("، ")} placeholder="Intern، Principal" />
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>بنك الإجابات</FieldLegend>
        <FieldDescription>
          أسئلة تتكرر في أغلب نماذج التقديم. نعبّيها منك مباشرة بدل ما نخمّن.
        </FieldDescription>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {STANDARD_QUESTIONS.map((question) => (
            <Field key={question.key}>
              <FieldLabel htmlFor={question.key}>{question.label}</FieldLabel>
              {question.type === "yesno" ? (
                <NativeSelect id={question.key} name={question.key} defaultValue={answers[question.key]}>
                  <NativeSelectOption value="">بدون إجابة</NativeSelectOption>
                  <NativeSelectOption value="yes">نعم</NativeSelectOption>
                  <NativeSelectOption value="no">لا</NativeSelectOption>
                </NativeSelect>
              ) : (
                <Input id={question.key} name={question.key} defaultValue={answers[question.key]} />
              )}
            </Field>
          ))}
        </FieldGroup>
        <div className="flex items-start gap-3">
          <Checkbox
            id="decline_voluntary_disclosures"
            name="decline_voluntary_disclosures"
            defaultChecked={answers.decline_voluntary_disclosures}
          />
          <div className="grid gap-1">
            <Label htmlFor="decline_voluntary_disclosures">أرفض الإجابة على أسئلة الهوية الطوعية</Label>
            <p className="text-sm text-muted-foreground">الجنس والعرق والإعاقة وغيرها: نختار «أفضّل عدم الإجابة».</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {custom.map((row, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                name="custom_question"
                aria-label={`سؤال ${i + 1}`}
                placeholder="السؤال"
                value={row.question}
                onChange={(e) => setCustom((rows) => rows.map((r, j) => (j === i ? { ...r, question: e.target.value } : r)))}
              />
              <Input
                name="custom_answer"
                aria-label={`جواب ${i + 1}`}
                placeholder="جوابك"
                value={row.answer}
                onChange={(e) => setCustom((rows) => rows.map((r, j) => (j === i ? { ...r, answer: e.target.value } : r)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="احذف السؤال"
                onClick={() => setCustom((rows) => rows.filter((_, j) => j !== i))}
              >
                <XIcon aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={custom.length >= 50}
            onClick={() => setCustom((rows) => [...rows, { question: "", answer: "" }])}
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            أضف سؤال
          </Button>
        </div>
      </FieldSet>

      <div className="flex flex-col gap-2">
        <FieldError>{state.error}</FieldError>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "جاري الحفظ…" : "احفظ"}
        </Button>
      </div>
    </form>
  );
}
