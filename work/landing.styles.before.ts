/** Tailwind v4 recipes for the editorial Course Radar landing page. */
export const landingStyles = {
  page: `
    cr:bg-radar-paper cr:text-radar-ink cr:font-body cr:text-[16px] cr:leading-[1.55] cr:[overflow-x:clip]
    cr:[:where(&_*)]:[box-sizing:border-box] cr:[&_*::before]:[box-sizing:border-box]
    cr:[&_*::after]:[box-sizing:border-box] cr:[:where(&>main)]:max-w-[none]
    cr:[:where(&>main)]:m-[0] cr:[:where(&>main)]:p-[0]
    cr:[:where(&_h1)]:m-[0] cr:[:where(&_h1)]:font-display cr:[:where(&_h1)]:font-normal
    cr:[:where(&_h1)]:tracking-[-.03em] cr:[:where(&_h2)]:m-[0] cr:[:where(&_h2)]:font-display
    cr:[:where(&_h2)]:font-normal cr:[:where(&_h2)]:tracking-[-.025em]
    cr:[:where(&_h3)]:m-[0] cr:[:where(&_h3)]:font-display cr:[:where(&_h3)]:font-normal
    cr:[:where(&_p)]:m-[0] cr:[:where(&_a)]:text-inherit cr:[:where(&_a)]:no-underline
    cr:[:where(&_button)]:[font:inherit] cr:[:where(&_input)]:[font:inherit] cr:[:where(&_button)]:cursor-pointer
    cr:[:where(&_a)]:[-webkit-tap-highlight-color:transparent] cr:[:where(&_button)]:[-webkit-tap-highlight-color:transparent]
    cr:[:where(&_:focus-visible)]:[outline:2px_solid_#171717] cr:[:where(&_:focus-visible)]:outline-offset-[4px]
    cr:[&_::selection]:bg-radar-ash cr:[&_::selection]:text-radar-ink cr:[&_input]:[caret-color:#171717]
    cr:[:where(&_h2)]:text-section cr:[:where(&_h2)]:leading-[1.04]
    cr:max-[800px]:[:where(&_h2)]:text-[36px] cr:max-[480px]:[:where(&_h2)]:text-[32px]
  `,
  wrap: `
    cr:w-[min(1600px,_calc(100%_-_clamp(64px,_6.9vw,_160px)))] cr:mx-auto
    cr:max-[800px]:w-[calc(100%_-_40px)] cr:max-[480px]:w-[calc(100%_-_32px)]
  `,
  skip: `
    cr:fixed cr:top-[-80px] cr:left-[20px] cr:z-[30] cr:bg-radar-ink cr:text-white cr:p-[12px_20px]
    cr:[&:focus]:top-[12px]
  `,
  header: `
    cr:min-h-[88px] cr:flex cr:justify-between cr:items-center cr:gap-[20px]
    cr:[&_nav]:flex cr:[&_nav]:items-center cr:[&_nav]:gap-[2px] cr:[&_nav]:p-[5px]
    cr:[&_nav]:bg-radar-ash cr:[&_nav]:[border:1px_solid_#e1dbd0] cr:[&_nav]:rounded-full
    cr:[&_nav_a]:p-[10px_14px] cr:[&_nav_a]:text-[13px] cr:[&_nav_a]:whitespace-nowrap cr:[&_nav_a]:rounded-full
    cr:[&_nav_a]:[transition:background_160ms_ease,color_160ms_ease]
    cr:[&_nav_a:hover]:bg-radar-surface cr:[&_nav_a:hover]:text-radar-ink
    cr:max-[1100px]:gap-[12px] cr:max-[1100px]:[&_nav_a]:p-[9px_10px]
    cr:max-[800px]:flex-wrap cr:max-[800px]:py-[16px] cr:max-[800px]:[&_nav]:order-3
    cr:max-[800px]:[&_nav]:w-full cr:max-[800px]:[&_nav_a]:flex-1 cr:max-[800px]:[&_nav_a]:text-center
  `,
  brand: `
    cr:inline-flex cr:gap-[9px] cr:items-center cr:font-display cr:font-normal cr:text-[25px]
    cr:tracking-[-.025em] cr:whitespace-nowrap cr:[[data-section=footer]_&]:text-[22px]
    cr:max-[480px]:text-[22px]
  `,
  brandDot: `cr:text-radar-ember cr:ml-[-7px]`,
  button: `
    cr:inline-flex cr:items-center cr:justify-center cr:gap-[16px] cr:bg-radar-ink cr:text-white
    cr:p-[14px_20px] cr:border cr:border-solid cr:border-radar-ink cr:text-[14px] cr:leading-[1.25]
    cr:min-h-[48px] cr:rounded-[12px] cr:[transition:background_160ms_ease,transform_160ms_var(--cr-ease-editorial)]
    cr:hover:bg-radar-steel cr:active:scale-[.99] cr:[&_svg]:[transition:transform_160ms_ease]
    cr:[@media(hover:hover)_and_(pointer:fine)]:[&:hover_svg]:translate-x-[3px]
    cr:max-[480px]:p-[13px_15px]
  `,
  buttonOutline: `
    cr:bg-transparent cr:text-radar-ink cr:border-radar-ink cr:hover:bg-radar-ash cr:hover:text-radar-ink
  `,
  headerCta: `cr:p-[12px_16px] cr:max-[800px]:text-[13px] cr:max-[800px]:min-h-[42px] cr:max-[800px]:p-[10px_12px]`,
  hero: `
    cr:grid cr:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)] cr:gap-[clamp(40px,4vw,72px)]
    cr:items-center cr:pt-[24px] cr:pb-[56px] cr:min-h-[526px]
    cr:[&_h1]:text-[clamp(58px,5vw,78px)] cr:[&_h1]:leading-[.96]
    cr:max-[1100px]:gap-[32px] cr:max-[1100px]:[&_h1]:text-[clamp(52px,5.8vw,66px)]
    cr:max-[800px]:grid-cols-1 cr:max-[800px]:pt-[32px] cr:max-[800px]:gap-[34px]
    cr:max-[800px]:pb-[42px] cr:max-[480px]:[&_h1]:text-[46px]
  `,
  heroCopy: `
    cr:w-full cr:max-w-[560px] cr:justify-self-center
    cr:[&>p]:max-w-[62ch] cr:[&>p]:text-[17px] cr:[&>p]:leading-[1.55]
    cr:[&>p]:text-radar-steel cr:[&>p]:mt-[22px] cr:max-[800px]:[&>p]:max-w-[58ch]
    cr:max-[480px]:[&>p]:text-[16px]
  `,
  heroAccent: `cr:not-italic cr:font-normal cr:text-radar-ink cr:underline cr:decoration-radar-ember cr:decoration-2 cr:underline-offset-[7px]`,
  actions: `
    cr:flex cr:gap-[12px] cr:mt-[28px] cr:flex-wrap cr:items-center
    cr:max-[1100px]:gap-[10px] cr:max-[800px]:flex-row cr:max-[480px]:gap-[8px]
  `,
  heroArt: `
    cr:relative cr:w-full cr:max-w-[650px] cr:justify-self-center cr:min-h-[470px] cr:isolate cr:[&::before]:content-[''] cr:[&::before]:absolute
    cr:[&::before]:bg-radar-fog cr:[&::before]:w-[90%] cr:[&::before]:h-[83%] cr:[&::before]:left-[5%]
    cr:[&::before]:top-[8%] cr:[&::before]:rounded-[18px] cr:[&::before]:z-[-1]
    cr:max-[1100px]:min-h-[460px] cr:max-[800px]:w-[min(680px,100%)] cr:max-[800px]:min-h-[570px]
    cr:max-[800px]:mx-auto cr:max-[480px]:min-h-[490px]
  `,
  heroPath: `
    cr:absolute cr:top-[8px] cr:left-[2%] cr:w-[96%] cr:z-[1] cr:[&&]:animate-path-arrive
    cr:max-[480px]:w-full
  `,
  heroSemester: `
    cr:absolute cr:top-[210px] cr:left-0 cr:w-[50%] cr:z-[3] cr:pr-[22px]
    cr:[&&]:animate-plan-arrive cr:max-[480px]:top-[178px] cr:max-[480px]:w-[56%] cr:max-[480px]:pr-[14px]
  `,
  heroWeek: `
    cr:absolute cr:top-[224px] cr:right-0 cr:w-[54%] cr:z-[2] cr:[&&]:animate-week-arrive
    cr:max-[480px]:top-[254px] cr:max-[480px]:right-0 cr:max-[480px]:w-[70%]
  `,
  previewLabel: `
    cr:flex cr:gap-[9px] cr:items-center cr:text-[14px] cr:font-medium cr:leading-[1.3]
    cr:[&>span]:ml-[auto] cr:[&>span]:text-[12px] cr:[&>span]:font-normal cr:[&>span]:text-radar-steel
    cr:[[data-semester-size=compact]_&]:text-[12px] cr:[[data-semester-size=compact]_&>span]:text-[12px]
    cr:[[data-week-size=compact]_&]:text-[12px] cr:[[data-week-size=compact]_&>span]:text-[12px]
    cr:[[data-section=path]_&]:text-radar-ink
    cr:max-[480px]:text-[12px] cr:max-[480px]:[&>span]:text-[10px]
  `,
  path: `
    cr:bg-radar-surface cr:[border:1px_solid_#dededb] cr:rounded-[18px] cr:p-[22px] cr:tabular-nums
    cr:[[data-section=path]>&]:bg-radar-surface cr:[[data-section=path]>&]:[border:1px_solid_#dededb]
    cr:[[data-section=path]>&]:text-radar-ink cr:[[data-section=path]>&]:p-[28px_32px]
    cr:max-[800px]:[[data-section=path]>&]:p-[22px]
  `,
  semester: `
    cr:bg-radar-surface cr:[border:1px_solid_#dededb] cr:rounded-[18px] cr:p-[22px] cr:tabular-nums
    cr:max-[480px]:[[data-section=plan-art]>&]:p-[18px]
  `,
  week: `
    cr:bg-radar-surface cr:[border:1px_solid_#dededb] cr:rounded-[18px] cr:p-[22px] cr:tabular-nums
    cr:[[data-section=week]>&]:[background:#ffffff] cr:[[data-section=week]>&]:[border:1px_solid_#dededb]
    cr:max-[800px]:[[data-section=week]>&]:w-full cr:max-[480px]:[[data-section=week]>&]:p-[18px_14px]
  `,
  pathNodes: `
    cr:relative cr:grid cr:[grid-template-columns:repeat(3,minmax(0,1fr))] cr:gap-[20px]
    cr:min-h-[236px] cr:m-[28px_auto_20px] cr:max-w-[980px] cr:isolate
    cr:[[data-path-size=compact]_&]:min-h-[166px] cr:[[data-path-size=compact]_&]:gap-[13px]
    cr:[[data-path-size=compact]_&]:my-[18px]
  `,
  pathStep: `
    cr:relative cr:z-[1] cr:min-w-0 cr:bg-radar-fog cr:[border:1px_solid_#dededb]
    cr:rounded-[14px] cr:p-[15px_14px] cr:text-radar-ink
    cr:[&>span]:block cr:[&>span]:text-[11px] cr:[&>span]:text-radar-steel
    cr:[&_strong]:block cr:[&_strong]:text-[18px] cr:[&_strong]:font-medium cr:[&_strong]:mt-[8px]
    cr:[&_p]:text-radar-steel cr:[&_p]:text-[12px] cr:[&_p]:leading-[1.35] cr:[&_p]:mt-[4px]
    cr:[[data-path-size=compact]_&]:p-[10px_10px_9px]
    cr:[[data-path-size=compact]_&_strong]:text-[15px] cr:[[data-path-size=compact]_&_strong]:mt-[5px]
    cr:[[data-path-size=compact]_&>span]:text-[10px] cr:[[data-path-size=compact]_&_p]:text-[10px]
    cr:[[data-section=path]_&]:bg-radar-surface
  `,
  pathTarget: `cr:bg-radar-paper cr:[border-color:#e44a2e]`,
  pathColumn: `
    cr:relative cr:z-[1] cr:flex cr:min-w-0 cr:flex-col cr:justify-evenly cr:gap-[12px]
    cr:[[data-path-size=compact]_&]:gap-[8px]
  `,
  pathEdges: `cr:absolute cr:inset-0 cr:z-0 cr:h-full cr:w-full cr:overflow-visible cr:pointer-events-none`,
  pathLine: `cr:fill-none cr:stroke-radar-ember cr:[stroke-width:1.5] cr:[stroke-linecap:round] cr:[stroke-linejoin:round]`,
  pathArrow: `cr:fill-radar-ember`,
  connector: `
    cr:flex cr:justify-end cr:items-center cr:w-[56px] cr:shrink-0 cr:text-radar-ember cr:relative
    cr:[&::before]:content-[''] cr:[&::before]:h-px cr:[&::before]:w-[calc(100%_-_14px)]
    cr:[&::before]:bg-radar-ember cr:[&::before]:absolute cr:[&::before]:left-0
    cr:[[data-path-size=compact]_&]:w-[27px] cr:max-[800px]:w-[35px]
    cr:max-[480px]:[[data-section=path]_&]:h-[32px] cr:max-[480px]:[[data-section=path]_&]:w-[32px]
    cr:max-[480px]:[[data-section=path]_&]:[transform:rotate(90deg)]
    cr:[[data-hero]_&]:before:origin-left cr:[[data-hero]_&]:before:animate-connection
  `,
  pathNote: `
    cr:flex cr:items-center cr:gap-[8px] cr:text-[12px] cr:text-radar-steel
    cr:[&_i]:inline-block cr:[&_i]:w-[7px] cr:[&_i]:h-[7px] cr:[&_i]:rounded-full cr:[&_i]:bg-radar-ember
    cr:[&>span]:ml-[auto] cr:[[data-path-size=compact]_&]:hidden
    cr:max-[480px]:flex-wrap cr:max-[480px]:[&>span]:ml-[14px]
  `,
  pathSmall: `cr:p-[18px] cr:max-[480px]:p-[14px]`,
  semesterTotal: `
    cr:m-[18px_0_12px] cr:flex cr:justify-between cr:items-baseline cr:[&_strong]:text-[29px]
    cr:[&_strong]:font-normal cr:[&_strong]:tracking-[-.02em] cr:[&_small]:text-[12px] cr:[&_small]:tracking-[0]
    cr:[&>span]:text-[12px] cr:[&>span]:text-radar-steel cr:[[data-semester-size=compact]_&]:mt-[10px]
    cr:[[data-semester-size=compact]_&_strong]:text-[23px] cr:[[data-semester-size=compact]_&_small]:text-[11px]
    cr:[[data-semester-size=compact]_&>span]:hidden cr:max-[480px]:flex-wrap cr:max-[480px]:gap-[5px]
  `,
  course: `
    cr:flex cr:gap-[12px] cr:items-center cr:p-[16px_0] cr:[border-bottom:1px_solid_#e1dbd0]
    cr:[&>span]:min-w-0 cr:[&>span]:flex-1 cr:[&_strong]:block cr:[&_strong]:text-[14px]
    cr:[&_strong]:font-medium cr:[&>span>span]:block cr:[&>span>span]:text-[12px]
    cr:[&>span>span]:text-radar-steel cr:[&>span>span]:mt-[3px] cr:[&>small]:text-[12px]
    cr:[&>small]:whitespace-nowrap cr:[&>small]:text-radar-steel
    cr:[[data-semester-size=compact]_&]:p-[9px_0] cr:[[data-semester-size=compact]_&]:gap-[5px]
    cr:[[data-semester-size=compact]_&_strong]:text-[12px] cr:[[data-semester-size=compact]_&>span>span]:text-[11px]
    cr:[[data-semester-size=compact]_&>span>span]:leading-[1.35] cr:[[data-semester-size=compact]_&>small]:text-[11px]
    cr:[[data-semester-size=compact]_&>svg]:hidden cr:max-[480px]:[&>span>span]:text-[11px]
  `,
  previewFoot: `
    cr:text-radar-steel cr:text-[12px] cr:[&&]:mt-[14px]
    cr:[[data-semester-size=compact]_&]:hidden cr:[[data-week-size=compact]_&]:hidden
  `,
  semesterSmall: `cr:p-[16px]`,
  calendar: `
    cr:grid cr:[grid-template-columns:42px_repeat(5,minmax(0,1fr))] cr:mt-[20px]
    cr:[[data-week-size=compact]_&]:[grid-template-columns:26px_repeat(5,minmax(0,1fr))]
    cr:[[data-week-size=compact]_&]:mt-[12px] cr:max-[480px]:[grid-template-columns:32px_repeat(5,minmax(0,1fr))]
  `,
  day: `
    cr:[&>span]:block cr:[&>span]:text-center cr:[&>span]:text-[12px] cr:[&>span]:pb-[8px]
    cr:[[data-week-size=compact]_&>span]:text-[10px]
  `,
  dayTrack: `
    cr:relative cr:h-[270px] cr:[border-left:1px_solid_#e1dbd0]
    cr:[background:repeating-linear-gradient(to_bottom,_#e1dbd0_0,_#e1dbd0_1px,_transparent_1px,_transparent_20%)]
    cr:[[data-week-size=compact]_&]:h-[200px] cr:max-[480px]:[[data-week-size=compact]_&]:h-[140px]
  `,
  hours: `
    cr:flex cr:flex-col cr:pt-[22px] cr:text-[10px] cr:text-radar-steel cr:[&_span]:h-[20%]
    cr:[[data-week-size=compact]_&]:text-[8px] cr:[[data-week-size=compact]_&]:pt-[18px]
  `,
  meeting: `
    cr:absolute cr:z-[1] cr:p-[5px_4px] cr:rounded-[8px] cr:bg-radar-ash cr:text-radar-ink
    cr:overflow-hidden cr:min-h-[18px] cr:min-w-0 cr:[&_strong]:block cr:[&_strong]:text-[10px]
    cr:[&_strong]:leading-[1.05] cr:[&_strong]:[overflow-wrap:anywhere] cr:[&_strong]:font-medium
    cr:[&>span]:block cr:[&>span]:text-[9px] cr:[&>span]:mt-[2px]
    cr:[[data-week-size=compact]_&]:p-[0_2px] cr:[[data-week-size=compact]_&_strong]:text-[8px]
    cr:[[data-week-size=compact]_&]:min-h-[0] cr:[[data-week-size=compact]_&>span]:text-[8px]
    cr:max-[480px]:p-[2px_1px] cr:max-[480px]:[&_strong]:text-[6px]
    cr:[[data-hero]_&]:animate-meeting
  `,
  meeting1: `cr:bg-radar-ember/15`,
  meeting2: `cr:bg-radar-fog`,
  weekSmall: `cr:p-[16px_14px]`,
  replay: `
    cr:absolute cr:right-0 cr:bottom-0 cr:flex cr:items-center cr:gap-[10px] cr:bg-radar-surface
    cr:border cr:border-solid cr:border-radar-mist cr:text-radar-ink cr:text-[13px]
    cr:min-h-[40px] cr:p-[8px_12px] cr:hover:bg-radar-ash
  `,
  scope: `
    cr:min-h-[88px] cr:grid cr:[grid-template-columns:1fr_2fr_auto] cr:items-center cr:gap-[24px]
    cr:border-t cr:border-solid cr:border-radar-mist cr:border-b cr:max-[1100px]:gap-[18px]
    cr:max-[800px]:grid-cols-1 cr:max-[800px]:gap-[14px] cr:max-[800px]:py-[22px]
  `,
  scopeLead: `cr:text-[15px] cr:font-medium cr:whitespace-nowrap cr:max-[800px]:text-[14px]`,
  programs: `
    cr:flex cr:gap-[30px] cr:min-w-0 cr:[&_button]:relative cr:[&_button]:inline-flex cr:[&_button]:items-center
    cr:[&_button]:gap-[8px] cr:[&_button]:border-0 cr:[&_button]:border-b-2 cr:[&_button]:border-transparent
    cr:[&_button]:appearance-none cr:[&_button]:bg-transparent cr:[&_button]:text-radar-ink
    cr:[&_button]:text-left cr:[&_button]:p-[8px_0] cr:[&_button]:font-display
    cr:[&_button]:text-[20px] cr:[&_button]:leading-[1.25] cr:[&_button]:font-normal
    cr:[&_button>svg]:text-radar-ember cr:[&_button[aria-pressed=true]]:border-radar-ink
    cr:max-[1100px]:gap-[18px] cr:max-[1100px]:[&_button]:text-[18px]
    cr:max-[800px]:flex-wrap cr:max-[800px]:gap-[16px]
  `,
  scopeCatalog: `cr:text-radar-steel cr:text-[15px] cr:whitespace-nowrap cr:max-[800px]:justify-self-start`,
  band: `cr:bg-radar-surface`,
  explore: `
    cr:grid cr:[grid-template-columns:.85fr_1.15fr] cr:items-center cr:gap-[clamp(42px,6vw,96px)]
    cr:py-[80px] cr:max-[1100px]:gap-[42px] cr:max-[800px]:[grid-template-columns:1fr]
    cr:max-[800px]:py-[60px] cr:max-[800px]:gap-[34px]
  `,
  sectionCopy: `
    cr:[&>p]:text-radar-steel cr:[&>p]:text-[16px] cr:[&>p]:leading-[1.55]
    cr:[&>p]:mt-[19px] cr:[&>p]:max-w-[62ch]
    cr:[&_h2_em]:not-italic cr:[&_h2_em]:font-normal cr:[&_h2_em]:text-radar-ink
    cr:[&_h2_em]:underline cr:[&_h2_em]:decoration-radar-ember cr:[&_h2_em]:decoration-2
    cr:[&_h2_em]:underline-offset-[6px]
    cr:max-[800px]:[&>p]:max-w-[64ch]
  `,
  sectionTop: `
    cr:grid cr:grid-cols-2 cr:gap-[72px] cr:items-start cr:mb-[32px]
    cr:[&>div>p]:text-radar-steel cr:[&>div>p]:text-[16px] cr:[&>div>p]:leading-[1.55]
    cr:[&>div>p]:max-w-[62ch] cr:[&_h2_em]:not-italic cr:[&_h2_em]:font-normal
    cr:[&_h2_em]:text-radar-ink cr:[&_h2_em]:underline cr:[&_h2_em]:decoration-radar-ember
    cr:[&_h2_em]:decoration-2 cr:[&_h2_em]:underline-offset-[6px] cr:max-[1100px]:gap-[40px]
    cr:max-[800px]:grid-cols-1 cr:max-[800px]:gap-[18px] cr:max-[800px]:mb-[26px]
  `,
  explorer: `
    cr:bg-radar-fog cr:border cr:border-solid cr:border-radar-mist cr:p-[28px_30px_22px]
    cr:rounded-[8px] cr:max-[480px]:p-[21px_18px]
  `,
  search: `
    cr:flex cr:items-center cr:gap-[12px] cr:p-[12px_14px] cr:border cr:border-solid cr:border-radar-mist
    cr:mt-[20px] cr:bg-radar-surface cr:[&_input]:border-0 cr:[&_input]:outline-none cr:[&_input]:bg-transparent
    cr:[&_input]:text-radar-ink cr:[&_input]:w-full cr:[&_input]:min-w-0 cr:[&_input]:p-[2px]
    cr:[&_input]:text-[14px] cr:[&_input::placeholder]:text-radar-steel cr:rounded-none
    cr:focus-within:border-radar-ink cr:focus-within:border-2
  `,
  searchResults: `cr:min-h-[228px]`,
  noResults: `cr:p-[28px_0] cr:text-radar-steel cr:text-[14px]`,
  explorerFoot: `
    cr:text-[12px] cr:text-radar-steel cr:flex cr:justify-between cr:items-center
    cr:gap-[15px] cr:mt-[20px]
  `,
  pathBand: `cr:bg-radar-ash`,
  pathSection: `cr:py-[76px] cr:text-radar-ink cr:max-[800px]:py-[58px] cr:[scroll-margin-top:24px]`,
  caption: `cr:text-radar-steel cr:mt-[16px] cr:text-[13px] cr:leading-[1.55]`,
  planBand: `cr:bg-radar-paper`,
  planLayout: `
    cr:grid cr:[grid-template-columns:1.05fr_.95fr] cr:gap-[clamp(48px,7vw,112px)]
    cr:items-center cr:py-[80px] cr:max-[1100px]:gap-[44px]
    cr:max-[800px]:[grid-template-columns:1fr] cr:max-[800px]:py-[58px] cr:max-[800px]:gap-[32px]
    cr:[scroll-margin-top:24px]
  `,
  planArt: `cr:relative cr:max-w-[760px] cr:max-[800px]:max-w-[620px]`,
  weekBand: `cr:bg-radar-fog`,
  weekSection: `
    cr:grid cr:[grid-template-columns:1fr_1.04fr] cr:gap-[clamp(42px,6vw,96px)]
    cr:items-center cr:py-[80px] cr:max-[1100px]:gap-[38px]
    cr:max-[800px]:[grid-template-columns:1fr] cr:max-[800px]:py-[58px]
    cr:max-[800px]:gap-[32px] cr:[scroll-margin-top:24px]
  `,
  assistantNote: `
    cr:flex cr:gap-[14px] cr:mt-[30px] cr:pt-[22px] cr:border-t cr:border-solid cr:border-radar-mist
    cr:[&>svg]:shrink-0 cr:[&>svg]:text-radar-ember cr:[&>svg]:mt-[3px]
    cr:[&_h3]:text-[21px] cr:[&_h3]:leading-[1.2] cr:[&_h3]:tracking-[-.02em]
    cr:[&_p]:text-[14px] cr:[&_p]:leading-[1.5] cr:[&_p]:text-radar-steel cr:[&_p]:mt-[8px]
  `,
  close: `
    cr:bg-radar-ivory cr:text-radar-ink cr:text-center cr:py-[68px_76px]
    cr:[&_h2]:text-[clamp(40px,4vw,52px)] cr:[&_h2]:leading-[1.04]
    cr:[&_h2_em]:not-italic cr:[&_h2_em]:font-normal cr:[&_h2_em]:text-radar-ink
    cr:[&_h2_em]:underline cr:[&_h2_em]:decoration-radar-ember cr:[&_h2_em]:decoration-2
    cr:[&_h2_em]:underline-offset-[6px]
    cr:[&_p]:text-[17px] cr:[&_p]:text-radar-steel cr:[&_p]:my-[20px_26px]
    cr:max-[480px]:py-[54px]
  `,
  footer: `
    cr:py-[34px] cr:flex cr:justify-between cr:items-start cr:gap-[30px]
    cr:[&_p]:text-[13px] cr:[&_p]:text-radar-steel cr:[&_p]:leading-[1.55] cr:[&_p]:mt-[9px]
    cr:[&>div:nth-child(2)]:max-w-[620px] cr:[&>div:nth-child(2)_p]:mt-0 cr:[&>div:nth-child(2)_p]:max-w-[70ch]
    cr:[&>div:nth-child(2)_span]:block cr:[&>div:nth-child(2)_span]:text-[13px] cr:[&>div:nth-child(2)_span]:mt-[9px]
    cr:[&>a]:text-[13px] cr:[&>a]:whitespace-nowrap
    cr:[&>a]:underline cr:[&>a]:underline-offset-[3px]
    cr:max-[800px]:flex-wrap cr:max-[800px]:gap-[20px]
    cr:max-[800px]:[&>div:nth-child(2)]:[order:3] cr:max-[800px]:[&>div:nth-child(2)]:w-full
    cr:max-[800px]:[&>div:nth-child(2)]:max-w-[none] cr:max-[800px]:[&>a]:ml-[auto]
  `,
} as const;
