export function requirementName(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function universityRequirement(value: string) {
  const input = requirementName(value);
  if (/^(?:us|american institutions)$/.test(input)) {
    return { candidates: ["US1", "US2", "US3"] } as const;
  }
  const us = /^(?:us|american institutions(?: us)?)\s*([123])$/.exec(input);
  const ge = /^(?:ge(?: area)?|general education(?: area)?|area|nhóm ge) ([1-6][abc]?|[a-f][1-4]?)$/.exec(input);
  const ud = /^(?:ud(?: ge)?|upper division ge(?: area)?|upper division general education(?: area)?)(?: (2 5|[2345]))?$/.exec(input);
  let attributes: string[];
  let label: string;
  if (ge) {
    label = "GE " + ge[1].toUpperCase();
    attributes = [label];
  } else if (us) {
    attributes = [label = "US" + us[1]];
  } else if (/^(?:us\s*1 (?:us\s*2 )?(?:us\s*)?3)$/.test(input)) {
    attributes = ["US1", "US2", "US3"];
    label = "US1–3";
  } else if (ud) {
    attributes = ud[1] ? ["UD " + ud[1].replace(" ", "/")] : ["UD 2", "UD 2/5", "UD 3", "UD 4", "UD 5"];
    label = ud[1] ? attributes[0] : "Upper-division GE";
  } else if (/^(?:wid|writing in the disciplines)$/.test(input)) {
    attributes = [label = "WID"];
  } else if (/^(?:gwar|graduation writing assessment requirement)$/.test(input)) {
    attributes = [label = "GWAR"];
  } else if (/^(?:pe|physed|physical education)$/.test(input)) {
    attributes = [label = "PE"];
  } else {
    return null;
  }
  return { key: requirementName(label).replace(/ /g, "-"), label, attributes };
}

export type SourceSection = {
  title: string;
  text: string;
  units?: number;
  choice?: boolean;
  courses?: { code: string; title: string; units?: number }[];
};

export function choiceRule(title: string, description: string, units?: number) {
  const match = /^(?:complete|choose|select|take)\s+(one|two|three|four|five|six|\d+)\s+(?:courses?(?:\s+from)?|of)\b/i.exec(title)
    ?? /^(?:complete|choose|select|take)\s+(one|two|three|four|five|six|\d+)\s+courses?\b/i.exec(description.trim());
  const words = ["one", "two", "three", "four", "five", "six"];
  const count = match ? Number(match[1]) || words.indexOf(match[1].toLowerCase()) + 1 : null;
  const text = description || title;
  const manualReview = /\b(?:approv(?:al|ed)|permission|consent|advisor|petition|substitut)/i.test(text);
  return { text, count, units: units && units > 0 ? units : null, manualReview };
}
