import { useId, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Source = { url: string; label: string; title: string };
const safe = (url: string | null) => !!url && /^https:\/\//i.test(url);
const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Source"; } };

/** Code-written chips carry their sources in the link title: `src u=…&l=…&t=…` (repeated). */
function sourcesFrom(href: string, title: string | undefined, text: string): Source[] | null {
  if (title?.startsWith("src ")) {
    const params = new URLSearchParams(title.slice(4));
    const urls = params.getAll("u"), labels = params.getAll("l"), titles = params.getAll("t");
    const sources = urls.map((url, i) => ({ url, label: labels[i] || host(url), title: titles[i] || "" })).filter(s => safe(s.url));
    return sources.length ? sources : null;
  }
  // Replies saved before chips used bare numbered links: show them as single-source chips.
  return /^\d+$/.test(text.trim()) ? [{ url: href, label: host(href), title: "" }] : null;
}

function SourceChip({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const [first, ...rest] = sources;
  const face = <><span className="cr-source-name">{first.label}</span>{rest.length > 0 && <span className="cr-source-more">+{rest.length}</span>}</>;
  if (!rest.length) {
    return <a className="cr-source-chip" href={first.url} target="_blank" rel="noopener noreferrer" title={first.title || first.label}>{face}</a>;
  }
  return <span className="cr-source" onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
    <button type="button" className="cr-source-chip" aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}
      aria-label={`${sources.length} sources: ${sources.map(s => s.label).join(", ")}`}>{face}</button>
    {open && <span className="cr-source-pop" id={id} role="list">
      {sources.map(s => <a key={s.url} role="listitem" href={s.url} target="_blank" rel="noopener noreferrer">
        <strong>{s.label}</strong>{s.title && <span>{s.title}</span>}<small>{host(s.url)}</small>
      </a>)}
    </span>}
  </span>;
}

function Link({ href, title, children }: { href?: string; title?: string; children?: ReactNode }) {
  if (!href) return <span>{children}</span>;
  const sources = sourcesFrom(href, title, typeof children === "string" ? children : Array.isArray(children) ? children.join("") : "");
  if (sources) return <SourceChip sources={sources}/>;
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

/** Rich replies and restored history share the same safe renderer. */
export function ChatReply({ text, failed, animate }: { text: string; failed: boolean; animate: boolean }) {
  return <div className={`cr-chat-reply${failed ? " cr-chat-failed" : ""}${animate ? " cr-chat-reply-fresh" : ""}`}>
    <Markdown remarkPlugins={[remarkGfm]} skipHtml
      allowedElements={["p", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "del", "ul", "ol", "li", "blockquote", "a", "table", "thead", "tbody", "tr", "th", "td", "hr", "br", "code", "pre"]}
      unwrapDisallowed
      urlTransform={url => safe(url) ? url : ""}
      components={{
        h1: ({ children }) => <h3>{children}</h3>,
        h2: ({ children }) => <h3>{children}</h3>,
        h3: ({ children }) => <h4>{children}</h4>,
        a: ({ href, title, children }) => <Link href={href} title={title}>{children}</Link>,
        table: ({ children }) => <div className="cr-chat-table-scroll" role="region" aria-label="Comparison table" tabIndex={0}><table>{children}</table></div>,
      }}>{text}</Markdown>
  </div>;
}
