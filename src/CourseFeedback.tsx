import { useCallback, useEffect, useState } from "react";
import { apiEndpoint } from "./api";

type Item = { id: number; rating: number; comment: string; createdAt: string };
type Feedback = { count: number; average: number | null; items: Item[] };

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export function CourseFeedback({ courseCode }: { courseCode: string }) {
  const [data, setData] = useState<Feedback | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await fetch(apiEndpoint(`feedback/${encodeURIComponent(courseCode)}`), { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Feedback unavailable");
      setData(await response.json() as Feedback);
    } catch {
      setData(null);
      setLoadError(true);
    }
  }, [courseCode]);

  useEffect(() => { setMessage(""); void load(); }, [load]);

  async function submit() {
    setMessage("");
    if (comment.trim().length < 3) { setMessage("Please write at least a few words."); return; }
    setSaving(true);
    try {
      const response = await fetch(apiEndpoint("feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseCode, rating, comment }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? "Could not save feedback.");
      }
      setComment("");
      setMessage("Thanks! Your feedback was saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save feedback. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="course-feedback" aria-label="Student feedback">
      <h3>Student feedback{data && data.count > 0 && data.average !== null ? ` · ${data.average.toFixed(1)}/5 (${data.count})` : ""}</h3>
      <p><small>Shared by students. Not verified by SJSU.</small></p>
      {loadError && <p role="status">Feedback could not be loaded. <button type="button" onClick={() => void load()}>Retry</button></p>}
      {data && data.count === 0 && <p>No feedback yet. Be the first to share.</p>}
      {data && data.items.slice(0, 5).map(item => (
        <div key={item.id}><span aria-label={`${item.rating} out of 5`}>{stars(item.rating)}</span> <span>{item.comment}</span></div>
      ))}
      <div>
        <label>Rating <select value={rating} onChange={e => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label>
        <textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={500} placeholder="Share your experience with this course" aria-label="Your feedback" />
        <button type="button" disabled={saving} onClick={() => void submit()}>{saving ? "Saving…" : "Submit feedback"}</button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}