import fs from 'node:fs';
let s=fs.readFileSync('src/landing.styles.ts','utf8');
const replacements={
 'text-radar-coal':'text-radar-ink', 'bg-radar-coal':'bg-radar-ink/90',
 'bg-radar-apricot':'bg-radar-amber/10', 'text-radar-copy':'text-radar-ink/70',
 'text-radar-mist':'text-white/80', 'text-subdued':'text-radar-ink/65',
 'text-brass':'text-radar-rust', 'text-persimmon':'text-radar-rust',
 'bg-persimmon':'bg-radar-rust', 'bg-paper':'bg-radar-paper', 'bg-ink':'bg-radar-ink',
 'text-ink':'text-radar-ink', 'var(--cr-color-hairline)':'#292a3026',
 'var(--cr-color-ink)':'#292a30', 'var(--cr-color-persimmon)':'#b84b2b',
 '#3b3c42':'#ffffff0d', '#4c4a44':'#292a30', '#584a32':'#292a30', '#5b5750':'#292a30b3',
 '#773e25':'#292a30', '#777168':'#292a30b3', '#a54c2d':'#b84b2b', '#aa4525':'#b84b2b',
 '#b59b84':'#292a3059', '#b98657':'#b84b2b', '#d9d4ce':'#292a3026', '#ded8d1':'#292a3026',
 '#deddd9':'#ffffffcc', '#e0ddd4':'#292a3026', '#e5cbbb':'#b84b2b33', '#e5e3dc':'#292a3014',
 '#e8e5de':'#292a3020', '#ece5d7':'#f3bf6733', '#ece6d9':'#f3bf6740', '#f4dfd1':'#b84b2b1a',
 '#f5f3ee':'#f7f6f2', '#f6f4f0':'#f7f6f2', '#f9eee7':'#f3bf6726',
};
for(const [from,to] of Object.entries(replacements)) s=s.replaceAll(from,to);
s=s.replace('cr:[&_h1]:text-[76px] cr:[&_h1]:leading-[1.04] cr:[&_h1]:tracking-[-.04em]',
 'cr:[&_h1]:font-editorial cr:[&_h1]:text-[76px] cr:[&_h1]:leading-[1.05] cr:[&_h1]:tracking-[-.025em]');
s=s.replace('cr:max-[1100px]:[&_h1]:text-[65px]','cr:max-[1100px]:[&_h1]:text-[66px]');
s=s.replace('cr:[&>p]:max-w-[390px] cr:[&>p]:text-[16px] cr:[&>p]:leading-[1.75]',
 'cr:[&>p]:max-w-[410px] cr:[&>p]:text-[18px] cr:[&>p]:leading-[1.65]');
s=s.replace('cr:[&>p]:mt-[29px]','cr:[&>p]:mt-[28px]');
s=s.replaceAll('cr:[&_h2_em]:text-[1.18em]','cr:[&_h2_em]:text-[1em]');
s=s.replaceAll('cr:[&_h2_em]:text-[1.2em]','cr:[&_h2_em]:text-[1em]');
s=s.replaceAll('cr:[&_h2_em]:text-[1.25em]','cr:[&_h2_em]:text-[1em]');
s=s.replace('cr:text-[clamp(42px,4.6vw,62px)]','cr:text-[clamp(38px,4vw,54px)]');
s=s.replace('heroSerif: `cr:block cr:font-editorial cr:font-normal cr:text-[1.17em] cr:tracking-[-.025em] cr:leading-[.98]`',
 'heroSerif: `cr:block cr:font-editorial cr:font-normal cr:text-[1em] cr:tracking-[-.025em] cr:leading-[1.05]`');
s=s.replace('heroItalic: `cr:font-editorial cr:font-normal cr:text-[1.28em] cr:tracking-[-.035em] cr:text-radar-rust cr:leading-[.92]`',
 'heroItalic: `cr:font-editorial cr:font-normal cr:text-[1em] cr:tracking-[-.025em] cr:text-radar-rust cr:leading-[1.05]`');
fs.writeFileSync('src/landing.styles.ts',s);
let theme=fs.readFileSync('src/theme.css','utf8');
theme=theme.replace(/  --color-radar-(coal|apricot|copy|mist):[^;]+;\r?\n/g,'');
fs.writeFileSync('src/theme.css',theme);
console.log('Landing palette: paper, charcoal, rust, amber, white. Headline: uniform 76px / 66px / 53px.');
