import { ArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import snapshot from "./data/professor-profiles.json";

type Profile = { id: number; name: string; match: string };
const profiles: Record<string, Profile> = snapshot.profiles;

export function ProfessorReviewLink({ name }: { name: string }) {
  const profile = Object.hasOwn(profiles, name) ? profiles[name] : undefined;
  if (!profile) return <span className="professor-profile-unmatched">No matched review profile</span>;
  return <a href={`https://www.ratemyprofessors.com/professor/${profile.id}`} target="_blank" rel="noopener noreferrer" title={`${profile.name} · San Jose State University${profile.match === "similar" ? " (similar name)" : ""}`} aria-label={`View ${profile.name} on Rate My Professors (opens in a new tab)`}>Rate My Professors <ArrowSquareOut size={13} aria-hidden="true" /></a>;
}
