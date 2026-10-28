import fs from 'node:fs';
import postcss from 'postcss';

const root = postcss.parse(fs.readFileSync('tmp/tailwind-migration/landing.before.css', 'utf8'));
const recipes = new Map();
const key = value => value === 'lr' ? 'page' : value.replace(/^lr-/, '').replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const context = {
  'lr-path-small': '[data-path-size=compact]',
  'lr-semester-small': '[data-semester-size=compact]',
  'lr-week-small': '[data-week-size=compact]',
  'lr-path-section': '[data-section=path]',
  'lr-plan-art': '[data-section=plan-art]',
  'lr-week-section': '[data-section=week]',
  'lr-section-copy': '[data-section-copy]',
  'lr-footer': '[data-section=footer]',
};
const colors = new Map([
  ['#fdfcf9','paper'], ['#f0efeb','warm-ash'], ['#24231f','ink'],
  ['#646159','muted'], ['#dcd9d1','hairline'], ['#d75c34','persimmon'], ['#816729','brass'],
]);
const simple = {
  'display:flex':'flex', 'display:grid':'grid', 'display:block':'block', 'display:inline-flex':'inline-flex', 'display:inline-block':'inline-block', 'display:none':'hidden',
  'position:relative':'relative', 'position:absolute':'absolute', 'position:fixed':'fixed', 'isolation:isolate':'isolate',
  'align-items:center':'items-center', 'align-items:start':'items-start', 'align-items:baseline':'items-baseline', 'justify-content:center':'justify-center', 'justify-content:space-between':'justify-between', 'justify-content:flex-end':'justify-end',
  'flex-direction:column':'flex-col', 'flex-direction:row':'flex-row', 'flex-wrap:wrap':'flex-wrap', 'flex-shrink:0':'shrink-0', 'flex:1':'flex-1',
  'width:100%':'w-full', 'min-width:0':'min-w-0', 'height:1px':'h-px', 'margin-inline:auto':'mx-auto',
  'font-weight:400':'font-normal','font-weight:500':'font-medium', 'text-align:center':'text-center', 'text-align:left':'text-left','text-align:right':'text-right',
  'cursor:pointer':'cursor-pointer', 'white-space:nowrap':'whitespace-nowrap', 'overflow:hidden':'overflow-hidden','overflow:clip':'overflow-clip',
  'font-variant-numeric:tabular-nums':'tabular-nums','text-decoration:none':'no-underline','text-decoration:underline':'underline',
  'background:transparent':'bg-transparent','color:inherit':'text-inherit', 'color:white':'text-white','color:#fff':'text-white', 'background:white':'bg-white','background:#fff':'bg-white',
};
const valueEscape = value => value.replaceAll('_','\\_').replace(/\s+/g,'_');
function utility(prop, value) {
  if (prop.startsWith('--lr-')) return null;
  if (prop === 'content' && value === '""') return "content-['']";
  value = value.replace(/var\(--lr-(paper|ash|ink|muted|line|orange|brass)\)/g, (_, role) => `var(--cr-color-${({ash:'warm-ash',line:'hairline',orange:'persimmon'})[role] ?? role})`);
  if (prop === 'font-family') return value.includes('Inter Tight') ? 'font-display' : 'font-body';
  if (prop === 'animation') {
    const name = value.match(/lr-([\w-]+)/)?.[1];
    return name ? `animate-${name}` : null;
  }
  // The user's latest request supersedes the old square-corner values.
  if (prop === 'border-radius' && value === '6px 0 0') return 'rounded-asymmetric';
  if (prop === 'border-radius' && value === '12px') return 'rounded-data';
  if (prop === 'font-size' && value === 'clamp(64px, 6.45vw, 88px)') return 'text-display';
  if (prop === 'font-size' && value === 'clamp(36px, 3.7vw, 49px)') return 'text-section';
  if (simple[`${prop}:${value}`]) return simple[`${prop}:${value}`];
  if (prop === 'color' || prop === 'background') {
    const role = colors.get(value) ?? value.match(/^var\(--cr-color-([\w-]+)\)$/)?.[1];
    if(role) return `${prop === 'color' ? 'text' : 'bg'}-${role}`;
  }
  const standard = {'padding':'p','padding-top':'pt','padding-bottom':'pb','padding-left':'pl','padding-right':'pr','padding-block':'py','padding-inline':'px','margin':'m','margin-top':'mt','margin-bottom':'mb','margin-left':'ml','margin-right':'mr','margin-block':'my','gap':'gap','width':'w','height':'h','min-height':'min-h','max-width':'max-w','min-width':'min-w','top':'top','right':'right','bottom':'bottom','left':'left','z-index':'z','font-size':'text','line-height':'leading','letter-spacing':'tracking','border-radius':'rounded','outline-offset':'outline-offset','text-underline-offset':'underline-offset'};
  if(standard[prop]) return `${standard[prop]}-[${valueEscape(value)}]`;
  return `[${prop}:${valueEscape(value)}]`;
}
root.walkRules(rule => {
  if(rule.parent.type==='atrule' && rule.parent.name==='keyframes') return;
  for (const original of rule.selectors) {
    if(original.includes('.lr-reveal.lr-in-view')) continue;
    let selector = original.trim();
    const matches = [...selector.matchAll(/\.lr(?:-[\w-]+)?/g)];
    const anchor = matches.at(-1);
    if(!anchor) throw new Error(selector);
    let name = anchor[0].slice(1);
    if(name==='lr-in-view') name='lr-reveal';
    let before = selector.slice(0,anchor.index).trim();
    let after = selector.slice(anchor.index+anchor[0].length);
    // Default ancestor is the landing root; no legacy marker is required.
    before = before.replace(/^\.lr(?:\s+|$)/, '');
    if(before) before = before.replace(/\.lr(?:-[\w-]+)?/g, token => {
      const mapped = context[token.slice(1)];
      if(!mapped) throw new Error('Unknown context '+token+' in '+selector);
      return mapped;
    });
    const relative = `${before ? before + (/[>+~]$/.test(before) ? '' : ' ') : ''}&${after}`;
    const normalized = relative.replace(/\s*([>+~])\s*/g,'$1').replace(/\s+/g,'_').replaceAll('"true"','true');
    let variant = relative === '&' ? '' : `[${name === 'lr' && !normalized.includes('::') ? `:where(${normalized})` : normalized}]:`;
    const media = rule.parent.type==='atrule' && rule.parent.name==='media' ? rule.parent.params : '';
    const match = media.match(/(min|max)-width:\s*(\d+)px/);
    const responsive = match ? `${match[1]}-[${match[2]}px]:` : '';
    if(!recipes.has(key(name))) recipes.set(key(name),[]);
    for(const declaration of rule.nodes) {
      if(declaration.type!=='decl') continue;
      const atom=utility(declaration.prop,declaration.value);
      const promoted = declaration.important && !variant ? '[&&]:' : '';
      if(atom) recipes.get(key(name)).push(`cr:${responsive}${variant}${promoted}${atom}`);
    }
  }
});
recipes.set('reveal',['cr:data-[in-view=true]:animate-section-reveal']);
recipes.set('planBand',[]);
// Control softening and compatibility reset stay explicit, rather than a new CSS selector.
recipes.get('button').push('cr:rounded-control');
recipes.get('search').push('cr:rounded-control');
recipes.set('programs', recipes.get('programs').filter(c => !c.endsWith(':[border:0]') && !c.includes('[border-bottom:') && !c.includes('[border-bottom-color:')).concat([
  'cr:[&_button]:border-0', 'cr:[&_button]:border-b', 'cr:[&_button]:border-solid', 'cr:[&_button]:border-transparent', 'cr:[&_button[aria-pressed=true]]:border-brass',
]));
// Remove zero-radius from the original button recipe; tailwind-merge handles overrides at composition sites.
recipes.set('button', recipes.get('button').filter(c=>c!=='cr:rounded-[0]'));
// Generic anchor reset uses :where so a styled CTA has normal utility precedence.
recipes.set('page',recipes.get('page').filter(c=>!c.startsWith('cr:[&_a]:')));
recipes.get('page').push('cr:[:where(&_a)]:text-inherit','cr:[:where(&_a)]:no-underline');
function formatRecipe(atoms) {
  const lines=[];
  for(const atom of new Set(atoms)) {
    if(!lines.length || lines.at(-1).length + atom.length > 110) lines.push(atom);
    else lines[lines.length-1]+=' '+atom;
  }
  return '`\n    '+lines.join('\n    ')+'\n  `';
}
const output = `/** Tailwind utility recipes for the landing composition.\n * Complete literal candidates keep source detection reliable. Named recipes are\n * Course Radar compositions, not generic shadcn/ui primitives. Arbitrary values\n * preserve the incumbent layout; shared roles use theme.css tokens.\n */\nexport const landingStyles = {\n${[...recipes].map(([name,atoms])=>`  ${name}: ${formatRecipe(atoms)},`).join('\n')}\n} as const;\n`;
fs.writeFileSync('src/landing.styles.ts',output);
let component=fs.readFileSync('tmp/tailwind-migration/Landing.before.tsx','utf8');
component=component.replace('import "./landing.css";','import { cn } from "@/lib/utils";\nimport { landingStyles as s } from "./landing.styles";\nimport "./theme.css";');
component=component.replace(/className="([\w -]+)"/g,(_,classes)=>`className={cn(${classes.split(/\s+/).map(name=>`s.${key(name)}`).join(', ')})}`);
component=component.replace('className={`lr-path ${compact ? "lr-path-small" : ""}`}','data-path-size={compact ? "compact" : "full"} className={cn(s.path, compact && s.pathSmall)}');
component=component.replace('className={`lr-semester ${compact ? "lr-semester-small" : ""}`}','data-semester-size={compact ? "compact" : "full"} className={cn(s.semester, compact && s.semesterSmall)}');
component=component.replace('className={`lr-week ${compact ? "lr-week-small" : ""}`}','data-week-size={compact ? "compact" : "full"} className={cn(s.week, compact && s.weekSmall)}');
component=component.replace('className={`lr-meeting lr-meeting-${index}`}','className={cn(s.meeting, [undefined, s.meeting1, s.meeting2][index])}');
component=component.replace('<div className={cn(s.page)} id="top"','<div data-course-theme className={cn(s.page)} id="top"');
component=component.replace('id="your-path" className=', 'id="your-path" data-section="path" className=');
component=component.replace('<div className={cn(s.planArt)}','<div data-section="plan-art" className={cn(s.planArt)}');
component=component.replace('id="your-week" className=', 'id="your-week" data-section="week" className=');
component=component.replaceAll('<div className={cn(s.sectionCopy)}', '<div data-section-copy className={cn(s.sectionCopy)}');
component=component.replace('<footer className=', '<footer data-section="footer" className=');
component=component.replace(/className=\{cn\(([^}]*s\.reveal)\)\}/g,'data-reveal className={cn($1)}');
component=component.replace('entry.target.classList.add("lr-in-view")','entry.target.setAttribute("data-in-view", "true")');
component=component.replace('querySelectorAll(".lr-reveal")','querySelectorAll("[data-reveal]")');
fs.writeFileSync('src/Landing.tsx',component);
console.log('Converted',recipes.size,'Tailwind recipes.');
