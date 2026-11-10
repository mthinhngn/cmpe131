import { startTransition, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import "./selection-menu.css";

export type SelectionOption = { slug: string; title: string; kind?: string };
const batchSize = 8;

// Custom behavior reuses Schedule's batches; upstream select/combobox requires uninstalled libraries.
export function SelectionMenu({ options, value, onChange, label, placeholder = "Choose an option", groups = {}, disabled = false, searchable = false, className = "" }: {
  options: SelectionOption[]; value: string; onChange: (value: string) => void; label: string;
  placeholder?: string; groups?: Record<string, string>; disabled?: boolean; searchable?: boolean; className?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => options.filter(p => p.title.toLocaleLowerCase().includes(deferredQuery.trim().toLocaleLowerCase())), [options, deferredQuery]);
  const [limit, setLimit] = useState(batchSize), [active, setActive] = useState(0);
  const selected = options.find(p => p.slug === value);
  const show = () => {
    const bounds = trigger.current!.getBoundingClientRect();
    const width = Math.max(bounds.width, 160);
    const height = Math.min(options.length * 48 + (searchable ? 90 : 8), searchable ? 386 : 330);
    const above = bounds.bottom + height > window.innerHeight && bounds.top > height;
    setPosition({ left: Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)), top: above ? bounds.top - 6 : bounds.bottom + 6, width, transform: above ? "translateY(-100%)" : undefined });
    setQuery(""); setOpen(true);
  };
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus(); };
  const choose = (index: number) => { if (filtered[index]) { onChange(filtered[index].slug); close(true); } };
  const append = () => startTransition(() => setLimit(n => Math.min(n + batchSize, filtered.length)));
  const navigate = (event: KeyboardEvent, fromSearch = false) => {
    if (event.key === "Escape") { event.preventDefault(); close(true); return; }
    if (event.key === "Enter" || (!fromSearch && event.key === " ")) { event.preventDefault(); if (query === deferredQuery) choose(active); return; }
    const next = event.key === "ArrowDown" ? active + 1 : event.key === "ArrowUp" ? active - 1 : !fromSearch && event.key === "Home" ? 0 : !fromSearch && event.key === "End" ? filtered.length - 1 : event.key === "PageDown" ? active + batchSize : event.key === "PageUp" ? active - batchSize : null;
    if (next === null || !filtered.length) return;
    event.preventDefault(); const index = Math.max(0, Math.min(next, filtered.length - 1));
    setLimit(n => Math.max(n, index + 1)); setActive(index);
  };
  useEffect(() => {
    const index = searchable ? 0 : Math.max(0, filtered.findIndex(option => option.slug === value));
    setLimit(Math.max(batchSize, index + 1)); setActive(index);
    if (list.current) list.current.scrollTop = 0;
  }, [filtered, open, searchable, value]);
  useEffect(() => {
    if (!open) return;
    popup.current?.showPopover();
    (searchable ? search.current : list.current)?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(); };
    const scroll = (event: Event) => { if (!root.current?.contains(event.target as Node)) close(); };
    const resize = () => close();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", resize); };
  }, [open, searchable]);
  useEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active, open]);
  return <div ref={root} className={`ui-selection-menu ${className}`} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <button ref={trigger} type="button" className="ui-selection-trigger" disabled={disabled} aria-label={label} aria-describedby={`${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => open ? close() : show()} onKeyDown={event => { if (["ArrowDown", "ArrowUp"].includes(event.key) || searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== " ") { event.preventDefault(); show(); if (event.key.length === 1) setQuery(event.key); } }}>
      <span id={`${id}-value`}>{selected?.title ?? placeholder}</span><ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && <div ref={popup} popover="manual" className="ui-selection-popup" style={position}>
      {searchable && <div className="ui-selection-search"><input ref={search} type="text" role="combobox" aria-label={`Search ${label.toLocaleLowerCase()}`} aria-autocomplete="list" aria-expanded="true" aria-controls={id} aria-activedescendant={filtered[active] ? `${id}-${active}` : undefined} placeholder="Type to search…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => navigate(event, true)} /></div>}
      <div id={id} ref={list} className="ui-selection-options" role="listbox" tabIndex={searchable ? -1 : 0} aria-label={`${label} options`} aria-busy={query !== deferredQuery} aria-activedescendant={filtered[active] ? `${id}-${active}` : undefined}
        onScroll={event => { const e = event.currentTarget; if (e.scrollTop > 0 && e.scrollHeight - e.scrollTop - e.clientHeight < 100) append(); }}
        onWheel={event => { const e = event.currentTarget; if (event.deltaY > 0 && e.scrollHeight <= e.clientHeight + 1) append(); }} onKeyDown={event => navigate(event)}>
        {filtered.slice(0, limit).map((option, index) => <div key={option.slug} role="presentation">
          {option.kind && groups[option.kind] && filtered[index - 1]?.kind !== option.kind && <div className="ui-selection-group" role="presentation">{groups[option.kind]}</div>}
          <div id={`${id}-${index}`} role="option" aria-selected={value === option.slug} className={`ui-selection-option${active === index ? " is-active" : ""}`} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
            <span>{option.title}</span>{value === option.slug && <Check size={15} aria-hidden="true" />}
          </div>
        </div>)}
        {!filtered.length && <p className="ui-selection-empty">No matches. Try another search.</p>}
      </div>
      {searchable && <p className="ui-selection-count" role="status">{Math.min(limit, filtered.length)} of {filtered.length} results{limit < filtered.length ? " · Scroll for more" : ""}</p>}
    </div>}
  </div>;
}
