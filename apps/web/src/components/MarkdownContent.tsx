import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  return <div className={`text-[13px] leading-6 text-bloom-text-secondary ${className}`}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="mb-3 mt-6 font-serif text-2xl text-bloom-text first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-5 font-serif text-xl text-bloom-text first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-4 text-[15px] font-semibold text-bloom-text first:mt-0">{children}</h3>,
        p: ({ children }) => <p className="my-3 whitespace-pre-wrap">{children}</p>,
        ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
        ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
        li: ({ children, className: itemClass }) => <li className={itemClass}>{children}</li>,
        blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-bloom-accent pl-4 italic text-bloom-text-tertiary">{children}</blockquote>,
        a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-bloom-accent underline decoration-bloom-border underline-offset-2">{children}</a>,
        pre: ({ children }) => <pre className="my-4 overflow-x-auto rounded-bloom-sm bg-bloom-bg p-4 text-[12px] leading-5 text-bloom-text">{children}</pre>,
        code: ({ children, className: codeClass }) => codeClass
          ? <code className={codeClass}>{children}</code>
          : <code className="rounded bg-bloom-bg px-1.5 py-0.5 text-[12px] text-bloom-text">{children}</code>,
        hr: () => <hr className="my-6 border-bloom-border" />,
        table: ({ children }) => <div className="my-4 overflow-x-auto"><table className="w-full border-collapse text-left">{children}</table></div>,
        th: ({ children }) => <th className="border border-bloom-border bg-bloom-bg px-3 py-2 font-medium text-bloom-text">{children}</th>,
        td: ({ children }) => <td className="border border-bloom-border px-3 py-2">{children}</td>,
      }}
    >{content}</ReactMarkdown>
  </div>;
}
