import { ArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { useEffect, useState } from "react";
import snapshot from "../agent_service/data/professor-profiles.json";
import { agentFetch } from "./agent-client";

type Profile = { id: number; name: string; match: string };
const profiles: Record<string, Profile> = snapshot.profiles;
const unresolved: Record<string, string> = snapshot.unresolved;
type Ratings = { status: "ok" | "no_reviews" | "unavailable"; rating?: number | null; difficulty?: number | null; would_take_again_percent?: number | null };
const ratingsRequests = new Map<number, Promise<Ratings>>();

function readRatings(id: number) {
  const cached = ratingsRequests.get(id);
  if (cached) return cached;
  const result = agentFetch<Ratings>(`/professor-ratings/${id}`)
    .catch((): Ratings => ({ status: "unavailable" }))
    .finally(() => ratingsRequests.delete(id));
  ratingsRequests.set(id, result);
  return result;
}

function ProfessorMetrics({ id }: { id: number }) {
  const [ratings, setRatings] = useState<Ratings | null>(null);
  useEffect(() => {
    let active = true;
    void readRatings(id).then(value => { if (active) setRatings(value ?? { status: "unavailable" }); });
    return () => { active = false; };
  }, [id]);

  if (!ratings) return <span className="cx-professor-metrics">Loading ratings…</span>;
  const { status, rating, difficulty, would_take_again_percent: wouldTakeAgain } = ratings;
  const hasMetrics = status === "ok" && typeof rating === "number" && typeof difficulty === "number";
  return <span className="cx-professor-metrics">
    {hasMetrics ? <>
      <span>Rating <strong>{rating.toFixed(1)}/5</strong></span>
      <span>Difficulty <strong>{difficulty.toFixed(1)}/5</strong></span>
      {typeof wouldTakeAgain === "number" && <span>Would take again <strong>{Math.round(wouldTakeAgain)}%</strong></span>}
    </> : <span>{status === "no_reviews" ? "No reviews yet" : "Ratings unavailable"}</span>}
  </span>;
}

export function ProfessorReviewLink({ name, showRatings = false }: { name: string; showRatings?: boolean }) {
  const profile = Object.hasOwn(profiles, name) ? profiles[name] : undefined;
  if (!profile) return <span className="professor-profile-unmatched">{Object.hasOwn(unresolved, name) && unresolved[name] === "ambiguous" ? "Multiple matching review profiles" : "No matched review profile"}</span>;
  return <>
    <a href={`https://www.ratemyprofessors.com/professor/${profile.id}`} target="_blank" rel="noopener noreferrer" title={`${profile.name}, San Jose State University${profile.match === "similar" ? " (similar name)" : ""}`} aria-label={`View ${profile.name} on Rate My Professors (opens in a new tab)`}>Rate My Professors <ArrowSquareOut size={13} aria-hidden="true" /></a>
    {showRatings && <ProfessorMetrics id={profile.id} key={profile.id} />}
  </>;
}
