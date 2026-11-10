import { useEffect, useRef, useState } from "react";
import "./typing-placeholder.css";

/** Visual-only text; the native input keeps its placeholder and accessible label. */
export function TypingPlaceholder({ text, loop, phrases }: { text: string; loop: boolean; phrases: string[] }) {
  const root = useRef<HTMLSpanElement>(null);
  const [index, setIndex] = useState(0);
  const displayed = loop ? phrases[index % phrases.length] : text;
  const count = phrases.length;
  useEffect(() => {
    if (!loop || !root.current) return;
    const line = root.current.firstElementChild!;
    const characters = Array.from(line.children);
    const typingTime = characters.length * 90;
    const duration = typingTime + 1800 + 450;
    const reset = (typingTime + 1800) / duration;
    const animations = characters.map((character, index) => {
      const reveal = ((index + 1) * 90) / duration;
      return character.animate([
        { opacity: 0, offset: 0 }, { opacity: 0, offset: reveal },
        { opacity: 1, offset: reveal }, { opacity: 1, offset: reset },
        { opacity: 0, offset: reset }, { opacity: 0, offset: 1 },
      ], { duration, fill: "both" });
    });
    // Keep the end of long prompts readable inside the compact bar as typing advances.
    const overflow = Math.max(0, line.scrollWidth - root.current.clientWidth);
    if (overflow) animations.push(line.animate([
      { transform: "translateX(0)", offset: 0 },
      { transform: "translateX(0)", offset: (typingTime / duration) * (root.current.clientWidth / line.scrollWidth) },
      { transform: `translateX(-${overflow}px)`, offset: typingTime / duration },
      { transform: `translateX(-${overflow}px)`, offset: 1 },
    ], { duration, fill: "both" }));
    let cancelled = false;
    void animations[0].finished.then(() => { if (!cancelled) setIndex(current => (current + 1) % count); }).catch(() => {});
    return () => { cancelled = true; animations.forEach(animation => animation.cancel()); };
  }, [displayed, loop, count, index]);
  return <span ref={root} className="cr-typing-placeholder" aria-hidden="true" data-loop={loop}>
    <span className="cr-typing-line">{Array.from(displayed).map((character, index) => <span key={index}>{character}</span>)}</span>
  </span>;
}
