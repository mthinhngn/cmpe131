import fs from 'node:fs';
let styles=fs.readFileSync('src/landing.styles.ts','utf8');
function replace(name,value){
 const expression=new RegExp('  '+name+': `[\\s\\S]*?`,');
 if(!expression.test(styles)) throw new Error('Missing recipe '+name);
 styles=styles.replace(expression,`  ${name}: \`\n    ${value.trim()}\n  \`,`);
}
function append(name,value){
 const expression=new RegExp('(  '+name+': `)([\\s\\S]*?)(`,)');
 if(!expression.test(styles)) throw new Error('Missing recipe '+name);
 styles=styles.replace(expression,(_,a,b,c)=>a+b+'    '+value+'\n  '+c);
}
styles=styles.replace('cr:bg-paper cr:text-ink','cr:bg-radar-paper cr:text-radar-night');
styles=styles.replace('cr:[&_::selection]:[background:#e9c9b7]','cr:[&_::selection]:bg-radar-lime');
styles=styles.replace('cr:[:where(&_:focus-visible)]:[outline:2px_solid_var(--cr-color-brass)]','cr:[:where(&_:focus-visible)]:[outline:2px_solid_#779e48]');
replace('header',`cr:min-h-[104px] cr:flex cr:justify-between cr:items-center cr:gap-[20px]
 cr:[&_nav]:flex cr:[&_nav]:items-center cr:[&_nav]:gap-[5px] cr:[&_nav]:p-[6px] cr:[&_nav]:bg-radar-sage
 cr:[&_nav]:rounded-full cr:[&_nav_a]:p-[9px_20px] cr:[&_nav_a]:text-[13px] cr:[&_nav_a]:rounded-full
 cr:[&_nav_a]:[transition:background_180ms_ease] cr:[&_nav_a:hover]:bg-white
 cr:max-[800px]:flex-wrap cr:max-[800px]:py-[22px] cr:max-[800px]:[&_nav]:order-3 cr:max-[800px]:[&_nav]:w-full
 cr:max-[800px]:[&_nav_a]:flex-1 cr:max-[800px]:[&_nav_a]:text-center`);
replace('brand',`cr:inline-flex cr:gap-[9px] cr:items-center cr:font-display cr:font-medium cr:text-[25px]
 cr:tracking-[-.035em] cr:whitespace-nowrap cr:[[data-section=footer]_&]:text-[22px] cr:max-[480px]:text-[22px]`);
replace('brandDot','cr:text-radar-forest cr:ml-[-7px]');
replace('button',`cr:inline-flex cr:items-center cr:justify-center cr:gap-[21px] cr:bg-radar-forest cr:text-white
 cr:p-[16px_23px] cr:border cr:border-solid cr:border-radar-forest cr:text-[13px] cr:leading-[1.25] cr:min-h-[50px]
 cr:rounded-control cr:[transition:background_180ms_ease,transform_160ms_var(--cr-ease-editorial)]
 cr:hover:bg-radar-night cr:active:scale-[.98] cr:[&_svg]:[transition:transform_180ms_ease]
 cr:[@media(hover:hover)_and_(pointer:fine)]:[&:hover_svg]:translate-x-[3px]
 cr:max-[480px]:p-[14px_16px] cr:max-[480px]:text-[12px] cr:max-[480px]:gap-[15px]`);
replace('buttonOutline','cr:bg-transparent cr:text-radar-forest cr:border-radar-forest cr:hover:bg-radar-sage');
replace('hero',`cr:grid cr:grid-cols-[.94fr_1.06fr] cr:gap-[38px] cr:items-center cr:pt-[40px] cr:pb-[78px]
 cr:min-h-[662px] cr:[&_h1]:text-[76px] cr:[&_h1]:leading-[1.04] cr:[&_h1]:tracking-[-.04em]
 cr:max-[1100px]:gap-[22px] cr:max-[1100px]:[&_h1]:text-[65px] cr:max-[800px]:grid-cols-1
 cr:max-[800px]:pt-[36px] cr:max-[800px]:gap-[60px] cr:max-[800px]:pb-[65px] cr:max-[480px]:[&_h1]:text-[53px]`);
replace('heroCopy',`cr:[&>p]:max-w-[390px] cr:[&>p]:text-[16px] cr:[&>p]:leading-[1.75] cr:[&>p]:text-radar-copy
 cr:[&>p]:mt-[29px] cr:max-[800px]:[&>p]:max-w-[450px] cr:max-[480px]:[&>p]:text-[15px]`);
replace('heroNote',`cr:flex cr:items-center cr:gap-[10px] cr:text-radar-copy cr:text-[11px] cr:mt-[23px]
 cr:[&>svg]:text-radar-forest`);
replace('heroArt',`cr:relative cr:min-h-[520px] cr:isolate cr:[&::before]:content-[''] cr:[&::before]:absolute
 cr:[&::before]:bg-radar-forest cr:[&::before]:w-[88%] cr:[&::before]:h-[82%] cr:[&::before]:left-[8%]
 cr:[&::before]:top-[11%] cr:[&::before]:rounded-[18px] cr:[&::before]:z-[-1]
 cr:max-[1100px]:scale-[.94] cr:max-[1100px]:origin-right cr:max-[800px]:scale-100 cr:max-[800px]:w-[min(590px,100%)]
 cr:max-[800px]:min-h-[520px] cr:max-[800px]:mx-auto cr:max-[480px]:min-h-[500px]`);
replace('heroPath',`cr:absolute cr:top-0 cr:left-0 cr:w-[91%] cr:z-[1] cr:[&&]:animate-path-arrive cr:max-[480px]:w-full`);
replace('heroSemester',`cr:absolute cr:top-[236px] cr:left-0 cr:w-[47%] cr:z-[3] cr:[&&]:animate-plan-arrive
 cr:max-[480px]:top-[190px] cr:max-[480px]:w-[62%] cr:max-[480px]:z-[2]`);
replace('heroWeek',`cr:absolute cr:top-[264px] cr:right-[-10px] cr:w-[57%] cr:z-[2] cr:[&&]:animate-week-arrive
 cr:max-[480px]:top-[303px] cr:max-[480px]:right-0 cr:max-[480px]:w-[73%] cr:max-[480px]:z-[3]`);
replace('replay',`cr:absolute cr:right-0 cr:bottom-[-45px] cr:flex cr:items-center cr:gap-[9px] cr:bg-transparent
 cr:border-0 cr:text-radar-forest cr:[&&]:text-[10px] cr:p-[8px] cr:hover:underline cr:underline-offset-[4px]
 cr:max-[480px]:bottom-[-31px]`);
replace('scope',`cr:flex cr:items-center cr:gap-[45px] cr:py-[30px_42px] cr:border-t cr:border-solid cr:border-[#ccd5c7]
 cr:[&>p]:text-[12px] cr:[&>p]:leading-[1.8] cr:[&>p>span]:block cr:[&>p>span]:text-radar-copy cr:[&>p>span]:text-[10px]
 cr:max-[1100px]:gap-[25px] cr:max-[800px]:flex-wrap cr:max-[800px]:gap-[24px] cr:max-[800px]:py-[28px_36px]
 cr:max-[800px]:[&>p:first-child]:w-[calc(100%_-_150px)]`);
replace('scopeCatalog','cr:text-radar-forest cr:[&&]:text-[18px] cr:whitespace-nowrap cr:max-[800px]:[&&]:ml-auto');
replace('band','cr:bg-white');
replace('explorer',`cr:bg-[#f3f5ef] cr:border cr:border-solid cr:border-[#d4ded2] cr:p-[29px_30px_22px]
 cr:rounded-data cr:max-[480px]:p-[22px_19px]`);
append('sectionCopy','cr:[&_h2_em]:font-editorial cr:[&_h2_em]:font-normal cr:[&_h2_em]:text-radar-forest cr:[&_h2_em]:text-[1.18em]');
replace('sectionTop',`cr:grid cr:grid-cols-2 cr:gap-[110px] cr:items-start cr:mb-[48px]
 cr:[&>div>p]:text-radar-mist cr:[&>div>p]:text-[16px] cr:[&>div>p]:leading-[1.75] cr:[&>div>p]:max-w-[410px]
 cr:[&_h2_em]:font-editorial cr:[&_h2_em]:font-normal cr:[&_h2_em]:text-radar-lime cr:[&_h2_em]:text-[1.2em]
 cr:max-[1100px]:gap-[60px] cr:max-[800px]:grid-cols-1 cr:max-[800px]:gap-[24px] cr:max-[800px]:mb-[30px]`);
replace('pathSection',`cr:py-[100px_85px] cr:text-white cr:max-[800px]:py-[65px]`);
replace('caption','cr:text-radar-mist cr:[&&]:mt-[20px] cr:text-[11px] cr:leading-[1.7]');
replace('textLink',`cr:inline-flex cr:items-center cr:gap-[25px] cr:text-[13px] cr:py-[5px]
 cr:border-b cr:border-solid cr:border-[#8aa779] cr:mt-[25px] cr:[&_svg]:[transition:transform_180ms_ease]
 cr:[@media(hover:hover)_and_(pointer:fine)]:[&:hover_svg]:translate-x-[3px]`);
append('path','cr:text-ink cr:[[data-section=path]>&]:bg-[#2a5046] cr:[[data-section=path]>&]:rounded-[16px]');
append('pathNote','cr:[[data-section=path]_&]:text-[#d1dfd6]');
append('connector','cr:[[data-hero]_&]:before:origin-left cr:[[data-hero]_&]:before:animate-connection cr:[[data-section=path]_&]:text-radar-lime cr:[[data-section=path]_&]:before:bg-radar-lime');
append('meeting','cr:[[data-hero]_&]:animate-meeting');
replace('nextSemester',`cr:absolute cr:w-[45%] cr:right-0 cr:bottom-0 cr:bg-radar-forest cr:text-white cr:p-[25px]
 cr:min-h-[180px] cr:z-[2] cr:rounded-data cr:[&>span]:text-[10px] cr:[&>span]:text-radar-lime
 cr:[&>p]:font-editorial cr:[&>p]:text-[28px] cr:[&>p]:leading-[1.1] cr:[&>p]:mt-[16px]
 cr:[&>a]:block cr:[&>a]:text-right cr:[&>a]:mt-[15px] cr:max-[480px]:min-h-[140px] cr:max-[480px]:w-[48%]
 cr:max-[480px]:p-[17px] cr:max-[480px]:[&>p]:text-[23px]`);
replace('close',`cr:bg-radar-lime cr:text-radar-night cr:text-center cr:py-[74px_85px]
 cr:[&_h2]:text-[clamp(42px,4.6vw,62px)] cr:[&_h2_em]:font-editorial cr:[&_h2_em]:font-normal cr:[&_h2_em]:text-[1.25em]
 cr:[&_p]:text-[14px] cr:[&_p]:text-radar-forest cr:[&_p]:my-[24px_28px] cr:max-[480px]:py-[60px]`);
replace('closeMark','cr:inline-flex cr:mb-[24px] cr:text-radar-forest');
append('footer','cr:text-radar-night');
// Keep the original product UI palette and fonts inside all three previews.
styles=styles.replace('cr:[&>a]:[background:#f9eee7]', 'cr:[&>a]:[background:#f9eee7]');
const extras=`
  heroSerif: \`cr:block cr:font-editorial cr:font-normal cr:text-[1.17em] cr:tracking-[-.025em] cr:leading-[.98]\`,
  heroItalic: \`cr:font-editorial cr:font-normal cr:text-[1.28em] cr:tracking-[-.035em] cr:text-radar-forest cr:leading-[.92]\`,
  storyRail: \`cr:flex cr:items-center cr:gap-[14px] cr:text-[10px] cr:tracking-[.1em] cr:uppercase cr:text-radar-copy cr:mb-[27px] cr:[&_i]:w-[20px] cr:[&_i]:h-px cr:[&_i]:bg-[#94a68f]\`,
  pathBand: \`cr:bg-radar-forest\`,
  planBand: \`cr:bg-radar-sage\`,
  weekBand: \`cr:bg-white\`,
`;
styles=styles.replace('} as const;',extras+'} as const;');
fs.writeFileSync('src/landing.styles.ts',styles);
let jsx=fs.readFileSync('src/Landing.tsx','utf8');
jsx=jsx.replace('<div className={cn(s.heroCopy)}><h1>See the path.<br />Plan what’s<br /><span>next.</span></h1>',
 '<div className={cn(s.heroCopy)}><div className={s.storyRail} aria-label="Path, plan, week"><span>Path</span><i aria-hidden="true" /><span>Plan</span><i aria-hidden="true" /><span>Week</span></div><h1><span className={s.heroSerif}>See the path.</span>Plan what’s<br /><em className={s.heroItalic}>next.</em></h1>');
jsx=jsx.replace('<span className={cn(s.heroNote)}>Made for', '<span className={cn(s.heroNote)}><GitBranch size={15} aria-hidden="true" />Made for');
jsx=jsx.replace('<div className={cn(s.heroArt)} key={replay}', '<div data-hero className={cn(s.heroArt)}');
jsx=jsx.replace('<div className={cn(s.heroPath)}>', '<div key={`path-${replay}`} className={cn(s.heroPath)}>');
jsx=jsx.replace('<div className={cn(s.heroSemester)}>', '<div key={`plan-${replay}`} className={cn(s.heroSemester)}>');
jsx=jsx.replace('<div className={cn(s.heroWeek)}>', '<div key={`week-${replay}`} className={cn(s.heroWeek)}>');
jsx=jsx.replace('Less searching.<br />More understanding.', 'Less searching.<br /><em>More understanding.</em>');
jsx=jsx.replace('Every next step<br />has a before.', 'Every next step<br /><em>has a before.</em>');
jsx=jsx.replace('A long-term view.<br />A plan that’s yours.', 'A long-term view.<br /><em>A plan that’s yours.</em>');
jsx=jsx.replace('Your next semester<br />starts with a clearer view.', 'Your next semester<br /><em>starts with a clearer view.</em>');
jsx=jsx.replace('<section id="your-path" data-section="path" data-reveal className={cn(s.pathSection, s.wrap, s.reveal)}>', '<section id="your-path" className={s.pathBand}><div data-section="path" data-reveal className={cn(s.pathSection, s.wrap, s.reveal)}>');
jsx=jsx.replace('all recorded relationships and course requirements.</p></section>', 'all recorded relationships and course requirements.</p></div></section>');
jsx=jsx.replace('<section className={cn(s.band)}><div data-reveal className={cn(s.wrap, s.planLayout, s.reveal)}>', '<section className={s.planBand}><div data-reveal className={cn(s.wrap, s.planLayout, s.reveal)}>');
jsx=jsx.replace('<section id="your-week" data-section="week" data-reveal className={cn(s.weekSection, s.wrap, s.reveal)}>', '<section id="your-week" className={s.weekBand}><div data-section="week" data-reveal className={cn(s.weekSection, s.wrap, s.reveal)}>');
jsx=jsx.replace('<WeekPreview catalog={catalog} /></section>', '<WeekPreview catalog={catalog} /></div></section>');
fs.writeFileSync('src/Landing.tsx',jsx);
console.log('Updated landing art direction; retained three data-driven preview components.');
