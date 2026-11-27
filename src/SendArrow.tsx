/* Send arrow drawn for the 34px send button: a short stem and a wide, flat head on the 24px grid with
   round joins (matching the lucide set used elsewhere in the chat), nudged up half a pixel so it sits
   optically centred in the circle. Shared by the chat composer and the planner command bar. */
type Props = { size?: number; className?: string };

export function SendArrow({ size = 18, className }: Props) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ translate: "0 -0.5px" }}>
    <path d="M12 18.25V6.5" />
    <path d="M6.25 11.75 12 6l5.75 5.75" />
  </svg>;
}
