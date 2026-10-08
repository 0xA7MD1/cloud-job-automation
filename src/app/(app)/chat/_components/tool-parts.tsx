"use client";

import { BuildingIcon, ExternalLinkIcon, HistoryIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChatUIMessage } from "@/lib/chat/types";

type Part = ChatUIMessage["parts"][number];

const ATS_LABEL: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workday: "Workday",
  other: "نظام آخر",
};

function Pending({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      {label}
    </p>
  );
}

function Failure({ text }: { text: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}

export function ToolPartView({ part, onAsk, busy }: { part: Part; onAsk: (text: string) => void; busy: boolean }) {
  switch (part.type) {
    case "tool-searchCompanies": {
      if (part.state === "input-streaming" || part.state === "input-available") {
        return <Pending label={`يبحث عن شركات: ${part.input?.query ?? ""}…`} />;
      }
      if (part.state === "output-error") return <Failure text="فشل البحث عن الشركات." />;
      if (part.state !== "output-available") return null;
      const output = part.output;
      if (!output.ok) return <Failure text={output.error} />;
      if (output.companies.length === 0) {
        return <p className="text-sm text-muted-foreground">ما لقيت شركات بهذا البحث.</p>;
      }
      return (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <SearchIcon className="size-3.5" aria-hidden />
            {output.companies.length} شركة · المصدر {output.provider === "tavily" ? "Tavily" : "Exa"} · انحفظ البحث
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {output.companies.map((company) => (
              <li key={company.companyId} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <BuildingIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate font-medium" dir="auto">
                      {company.name}
                    </span>
                  </div>
                  {company.ats !== "unknown" && <Badge variant="secondary">{ATS_LABEL[company.ats]}</Badge>}
                </div>
                <a
                  href={company.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  dir="ltr"
                >
                  {company.domain}
                  <ExternalLinkIcon className="size-3" aria-hidden />
                </a>
                {company.snippet && (
                  <p className="line-clamp-2 text-xs text-muted-foreground" dir="auto">
                    {company.snippet}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={busy}
                  onClick={() => onAsk(`اعرض الوظائف الرسمية في ${company.name} (${company.domain})`)}
                >
                  وظائفهم الرسمية
                </Button>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case "tool-listRecentSearches":
    case "tool-getSearchResults":
      return (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <HistoryIcon className="size-3.5" aria-hidden />
          {part.state === "output-available" ? "رجع للبحوث المحفوظة" : "يراجع البحوث المحفوظة…"}
        </p>
      );

    default:
      return null;
  }
}
