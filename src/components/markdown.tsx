import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const components: Components = {
  p: ({ children }) => (
    <p dir="auto" className="leading-7 [&:not(:first-child)]:mt-3">
      {children}
    </p>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium underline underline-offset-4">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="my-3 ms-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 ms-5 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li dir="auto">{children}</li>,
  h1: ({ children }) => <h3 className="mt-4 mb-2 font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-4 mb-2 font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 mb-1 font-semibold">{children}</h4>,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{children}</code>,
  pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-3 text-sm" dir="ltr">{children}</pre>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b p-2 text-start font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b p-2 align-top">{children}</td>,
  img: () => null,
};

/** Markdown من الذكاء. الصور ممنوعة (ما نحمّل روابط خارجية)، والروابط تفتح بتبويب جديد. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-sm break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
}
