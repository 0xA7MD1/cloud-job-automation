"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CopyIcon, DownloadIcon, MailIcon, MessageCircleIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { getDownloadUrl } from "../../files/actions";
import { reprepareAction, saveCoverLetterAction, selectCvAction } from "../actions";

export function DownloadButton({ fileId, label }: { fileId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await getDownloadUrl(fileId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          window.open(result.data, "_blank", "noopener,noreferrer");
        })
      }
    >
      <DownloadIcon data-icon="inline-start" aria-hidden />
      {label}
    </Button>
  );
}

export function CvPicker({
  applicationId,
  cvFiles,
  selected,
  editable,
}: {
  applicationId: string;
  cvFiles: { id: string; file_name: string }[];
  selected: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <NativeSelect
      aria-label="السيرة الذاتية لهذا الطلب"
      dir="auto"
      value={selected ?? ""}
      disabled={!editable || pending}
      onChange={(e) =>
        startTransition(async () => {
          const result = await selectCvAction(applicationId, e.target.value);
          if (!result.ok) toast.error(result.error);
          else toast.success("تغيّرت السيرة لهذا الطلب.");
          router.refresh();
        })
      }
    >
      {!selected && <NativeSelectOption value="">اختر سيرة</NativeSelectOption>}
      {cvFiles.map((f) => (
        <NativeSelectOption key={f.id} value={f.id}>
          {f.file_name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export function CoverLetterEditor({
  applicationId,
  initial,
  editable,
}: {
  applicationId: string;
  initial: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = text.trim() !== initial.trim();

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        dir="auto"
        rows={14}
        value={text}
        disabled={!editable || pending}
        onChange={(e) => setText(e.target.value)}
        aria-label="نص خطاب التقديم"
        className="leading-relaxed"
      />
      {editable && (
        <div className="flex items-center gap-3">
          <Button
            disabled={!dirty || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await saveCoverLetterAction(applicationId, text);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("انحفظ الخطاب. ملفات PDF وWord تتحدّث خلال ثواني.");
                router.refresh();
              })
            }
          >
            {pending ? "نحفظ..." : "احفظ الخطاب"}
          </Button>
          <span className="text-sm text-muted-foreground">{text.trim().split(/\s+/).filter(Boolean).length} كلمة</span>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("انسخ.");
        } catch {
          toast.error("ما قدرنا ننسخ.");
        }
      }}
    >
      <CopyIcon data-icon="inline-start" aria-hidden />
      {label}
    </Button>
  );
}

/** مسودات تواصل: الإرسال يدوي دائمًا (mailto / رابط واتساب) */
export function OutreachDrafts({ subject, email, message }: { subject: string; email: string; message: string }) {
  if (!email && !message) return null;
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(email)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`;
  return (
    <div className="flex flex-col gap-6">
      {email && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">بريد للمسؤول عن التوظيف</h3>
            <Button asChild variant="outline" size="sm">
              <a href={mailto}>
                <MailIcon data-icon="inline-start" aria-hidden />
                افتحه في بريدك
              </a>
            </Button>
            <CopyButton text={`${subject}\n\n${email}`} label="انسخ" />
          </div>
          <p className="text-sm font-medium" dir="auto">
            {subject}
          </p>
          <p className="whitespace-pre-line rounded-md bg-muted p-3 text-sm" dir="auto">
            {email}
          </p>
        </div>
      )}
      {message && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">رسالة قصيرة (واتساب / LinkedIn)</h3>
            <Button asChild variant="outline" size="sm">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircleIcon data-icon="inline-start" aria-hidden />
                واتساب
              </a>
            </Button>
            <CopyButton text={message} label="انسخ" />
          </div>
          <p className="whitespace-pre-line rounded-md bg-muted p-3 text-sm" dir="auto">
            {message}
          </p>
        </div>
      )}
    </div>
  );
}

export function ReprepareButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("نجيب الأسئلة ونكتب الإجابات والخطاب من جديد؟ إجاباتك الي عدّلتها بنفسك تبقى.")) return;
        startTransition(async () => {
          const result = await reprepareAction(applicationId);
          if (!result.ok) toast.error(result.error);
          router.refresh();
        });
      }}
    >
      <RefreshCwIcon data-icon="inline-start" aria-hidden />
      أعد التجهيز
    </Button>
  );
}
