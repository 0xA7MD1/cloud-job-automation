"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { AnswerValue, FormField, StoredAnswers } from "@/lib/apply/form";
import { SOURCE_LABELS } from "@/lib/apply/labels";
import { saveAnswersAction } from "../actions";

const GROUPS = [
  { id: "basic", title: "بيانات التواصل", note: "من ملفك الشخصي." },
  { id: "question", title: "أسئلة الشركة", note: "راجع إجابات الذكاء قبل الإرسال." },
  {
    id: "demographic",
    title: "أسئلة الهوية الطوعية",
    note: "اختيارية عادةً. نختار «أفضّل عدم الإجابة» إلا لو غيّرت ذلك من ملفك.",
  },
] as const;

const LTR_TYPES = new Set(["email", "phone", "url", "number", "date"]);

interface Props {
  applicationId: string;
  fields: FormField[];
  answers: StoredAnswers;
  editable: boolean;
}

export function AnswersForm({ applicationId, fields, answers, editable }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, AnswerValue>>(() =>
    Object.fromEntries(
      fields
        .filter((f) => f.type !== "file")
        .map((f) => [f.key, answers[f.key]?.value ?? (f.type === "multiselect" ? [] : "")]),
    ),
  );
  const [dirty, setDirty] = useState(false);

  const set = (key: string, value: AnswerValue) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const save = () =>
    startTransition(async () => {
      const result = await saveAnswersAction(applicationId, values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("انحفظت الإجابات.");
      setDirty(false);
      router.refresh();
    });

  const visible = fields.filter((f) => f.type !== "file");
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map((group) => {
        const groupFields = visible.filter((f) => f.group === group.id);
        if (groupFields.length === 0) return null;
        return (
          <FieldSet key={group.id}>
            <FieldLegend>{group.title}</FieldLegend>
            <FieldDescription>{group.note}</FieldDescription>
            <FieldGroup className="gap-5">
              {groupFields.map((field) => (
                <AnswerField
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  meta={answers[field.key]}
                  disabled={!editable || pending}
                  onChange={(v) => set(field.key, v)}
                />
              ))}
            </FieldGroup>
          </FieldSet>
        );
      })}
      {editable && (
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending || !dirty}>
            {pending ? "نحفظ..." : "احفظ الإجابات"}
          </Button>
          {dirty && <span className="text-sm text-muted-foreground">فيه تعديلات ما انحفظت.</span>}
        </div>
      )}
    </div>
  );
}

function AnswerField({
  field,
  value,
  meta,
  disabled,
  onChange,
}: {
  field: FormField;
  value: AnswerValue | undefined;
  meta: StoredAnswers[string] | undefined;
  disabled: boolean;
  onChange: (value: AnswerValue) => void;
}) {
  const id = `f-${field.key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const text = typeof value === "string" ? value : "";
  const empty = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

  let control: React.ReactNode;
  if (field.type === "textarea") {
    control = <Textarea id={id} dir="auto" rows={5} value={text} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  } else if (field.type === "select" || field.type === "boolean") {
    const options =
      field.type === "boolean"
        ? [
            { value: "true", label: "Yes / نعم" },
            { value: "false", label: "No / لا" },
          ]
        : (field.options ?? []);
    const current = field.type === "boolean" ? (typeof value === "boolean" ? String(value) : "") : text;
    control = (
      <NativeSelect
        id={id}
        dir="auto"
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(field.type === "boolean" ? e.target.value === "true" : e.target.value)}
      >
        <NativeSelectOption value="">اختر</NativeSelectOption>
        {options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  } else if (field.type === "multiselect") {
    const selected = new Set(Array.isArray(value) ? value : []);
    control = (
      <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-md border p-3" dir="auto">
        {(field.options ?? []).map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.has(o.value)}
              disabled={disabled}
              onCheckedChange={(checked) => {
                const next = new Set(selected);
                if (checked) next.add(o.value);
                else next.delete(o.value);
                onChange([...next]);
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  } else {
    control = (
      <Input
        id={id}
        dir={LTR_TYPES.has(field.type) ? "ltr" : "auto"}
        type={field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
        value={text}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Field>
      <div className="flex flex-wrap items-center gap-2">
        <FieldLabel htmlFor={id} dir="auto" className="leading-snug">
          {field.label || field.key}
          {field.required && <span className="text-destructive"> *</span>}
        </FieldLabel>
        {meta && <Badge variant="outline">{SOURCE_LABELS[meta.source]}</Badge>}
        {meta?.review && (
          <Badge variant="destructive">
            <AlertTriangleIcon data-icon="inline-start" aria-hidden />
            راجعها
          </Badge>
        )}
        {field.required && empty && <Badge variant="destructive">مطلوب</Badge>}
      </div>
      {field.description && (
        <FieldDescription dir="auto" className="line-clamp-3">
          {field.description}
        </FieldDescription>
      )}
      {control}
    </Field>
  );
}
