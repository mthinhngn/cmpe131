/** Keep conditional catalog references visible without making every alternative mandatory. */
export function courseDependencies(text: string | null | undefined, codes: string[], ids: Map<string, string>) {
  const references = [...new Set(codes.flatMap(code => ids.has(code) ? [ids.get(code)!] : []))];
  const condition = (text ?? "").replace(/\bor\s+(?:better|higher|above)\b/gi, "");
  const conditional = /\bor\b|\beither\b|consent|permission|placement|eligib/i.test(condition);
  return { required: conditional ? [] : references, conditional: conditional ? references : [] };
}
