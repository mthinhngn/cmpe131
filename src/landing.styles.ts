/** Route-local Tailwind v4 recipes. No workspace or primitive overrides. */
export const landingStyles = {
  page: `cr:bg-radar-fog cr:text-radar-ink cr:font-body cr:text-[16px] cr:leading-[1.55]
    cr:[:where(&_*)]:box-border cr:[:where(&>main)]:max-w-none cr:[:where(&>main)]:m-0 cr:[:where(&>main)]:p-0
    cr:[:where(&_h1,&_h2,&_h3)]:font-display cr:[:where(&_h1,&_h2,&_h3)]:font-normal cr:[:where(&_h1,&_h2,&_h3)]:m-0
    cr:[:where(&_h1,&_h2,&_h3)]:tracking-[-.035em] cr:[:where(&_h2)]:text-section cr:[:where(&_h2)]:leading-[1.08]
    cr:[:where(&_p)]:m-0 cr:[:where(&_a)]:text-inherit cr:[:where(&_a)]:no-underline
    cr:[:where(&_input,&_button)]:[font:inherit] cr:[:where(&_button)]:cursor-pointer
    cr:[:where(&_:focus-visible)]:[outline:2px_solid_#171717] cr:[:where(&_:focus-visible)]:outline-offset-[5px]
    cr:[&_::selection]:bg-radar-ivory cr:[&_input]:caret-radar-ink cr:[&_section]:scroll-mt-[28px]`,
  wrap: `cr:w-[min(1600px,calc(100%_-_clamp(64px,6.9vw,160px)))] cr:mx-auto`,
  skip: `cr:fixed cr:top-[-80px] cr:left-[20px] cr:z-30 cr:bg-radar-ink cr:text-white cr:p-[12px_20px] cr:focus:top-[12px]`,
  header: `cr:h-[80px] cr:grid cr:grid-cols-[1fr_auto_1fr] cr:items-center cr:gap-[20px]
    cr:[&_nav]:flex cr:[&_nav]:items-center cr:[&_nav]:p-[5px] cr:[&_nav]:bg-radar-ash cr:[&_nav]:rounded-full
    cr:[&_nav_a]:p-[10px_14px] cr:[&_nav_a]:text-[14px] cr:[&_nav_a]:whitespace-nowrap cr:[&_nav_a]:rounded-full cr:[&_nav_a:hover]:bg-white`,
  brand: `cr:inline-flex cr:items-center cr:font-display cr:text-[25px] cr:tracking-[-.035em] cr:whitespace-nowrap cr:w-fit`,
  brandDot: `cr:text-radar-wine`,
  button: `cr:inline-flex cr:w-fit cr:items-center cr:justify-center cr:gap-[22px] cr:bg-radar-ink cr:!text-white cr:rounded-control cr:p-[15px_22px] cr:min-h-[50px] cr:text-[16px] cr:leading-[1.25] cr:border-0 cr:[&_svg]:shrink-0`,
  headerCta: `cr:justify-self-end cr:text-[14px] cr:min-h-[46px] cr:p-[12px_16px]`,
  hero: `cr:grid cr:grid-cols-2 cr:gap-0 cr:items-center cr:min-h-[650px] cr:h-[calc(100vh_-_130px)] cr:max-h-[700px]`,
  heroCopy: `cr:min-w-0 cr:w-full cr:pr-[40px] cr:pl-[clamp(0px,2vw,32px)] cr:[&_h1]:text-display cr:[&_h1]:leading-[1.04] cr:[&_h1]:tracking-[-.04em]
    cr:[&>p]:text-[18px] cr:[&>p]:text-radar-steel cr:[&>p]:max-w-[440px] cr:[&>p]:mt-[28px] cr:[&>a]:mt-[32px]`,
  heroAccent: `cr:not-italic cr:font-normal cr:underline cr:decoration-radar-wine cr:decoration-[3px] cr:underline-offset-[10px]`,
  heroArt: `cr:relative cr:w-[calc(100%_-_24px)] cr:justify-self-center cr:max-w-[700px] cr:h-[570px] cr:isolate`,
  heroSchedule: `cr:absolute cr:top-[12px] cr:left-[6%] cr:w-[91%] cr:z-1`,
  heroProgress: `cr:absolute cr:top-[300px] cr:left-0 cr:w-[46%] cr:bg-white cr:border cr:border-solid cr:border-radar-mist cr:rounded-[18px] cr:p-[20px] cr:z-2 cr:[&_h2]:!text-[18px] cr:[&_h2]:!leading-[1.3] cr:[&>p]:text-[15px] cr:[&>p]:text-radar-steel`,
  progressRing: `cr:relative cr:w-[132px] cr:h-[132px] cr:mx-auto cr:my-[8px] cr:[&_svg]:w-full cr:[&_svg]:h-full cr:[&_strong]:absolute cr:[&_strong]:inset-0 cr:[&_strong]:flex cr:[&_strong]:items-center cr:[&_strong]:justify-center cr:[&_strong]:font-display cr:[&_strong]:text-[38px] cr:[&_strong]:font-normal cr:[&_small]:text-[20px]`,
  progressToggle: `cr:mt-[12px] cr:p-[8px_10px] cr:w-full cr:bg-radar-fog cr:text-radar-ink cr:border-0 cr:rounded-control cr:text-[14px]`,
  heroPrerequisites: `cr:absolute cr:top-[336px] cr:right-0 cr:w-[49%] cr:bg-white cr:border cr:border-solid cr:border-radar-mist cr:rounded-[18px] cr:p-[20px] cr:z-3 cr:[&_h2]:!text-[18px] cr:[&_h2]:!leading-[1.3]`,
  miniPath: `cr:relative cr:h-[172px] cr:mt-[12px] cr:[&_svg]:absolute cr:[&_svg]:inset-0 cr:[&_svg]:w-full cr:[&_svg]:h-full cr:[&_span]:absolute cr:[&_span]:bg-radar-fog cr:[&_span]:border cr:[&_span]:border-solid cr:[&_span]:border-radar-mist cr:[&_span]:p-[8px_12px] cr:[&_span]:rounded-control cr:[&_span]:text-[15px] cr:[&_span]:font-medium cr:[&_span:nth-of-type(1)]:top-0 cr:[&_span:nth-of-type(1)]:left-0 cr:[&_span:nth-of-type(2)]:top-[66px] cr:[&_span:nth-of-type(2)]:left-[24%] cr:[&_span:nth-of-type(3)]:bottom-0 cr:[&_span:nth-of-type(3)]:right-0`,
  sectionTop: `cr:grid cr:grid-cols-2 cr:gap-[60px] cr:items-start cr:mb-[40px] cr:[&_p]:text-radar-steel cr:[&_p]:max-w-[58ch] cr:[&_p]:text-[18px]`,
  explore: `cr:py-[80px] cr:grid cr:grid-cols-[.72fr_1.28fr] cr:gap-[80px] cr:items-start cr:[&>div:first-child]:grid-cols-1 cr:[&>div:first-child]:gap-[28px] cr:[&>div:first-child]:mb-0`,
  scope: `cr:!text-[15px] cr:!mt-[16px]`,
  explorer: `cr:border-0 cr:border-t cr:border-solid cr:border-radar-ink cr:pt-[24px]`,
  explorerTools: `cr:flex cr:flex-col cr:items-start cr:gap-[16px] cr:[&>span]:text-radar-steel cr:[&>span]:text-[15px]`,
  search: `cr:flex cr:items-center cr:gap-[12px] cr:w-full cr:bg-white cr:border cr:border-solid cr:border-radar-steel cr:rounded-control cr:p-[14px_18px]
    cr:[&_input]:border-0 cr:[&_input]:outline-none cr:[&_input]:bg-transparent cr:[&_input]:text-radar-ink cr:[&_input]:w-full cr:[&_input]:min-w-0 cr:[&_input]:p-0 cr:[&_input::placeholder]:text-radar-steel cr:focus-within:outline-2 cr:focus-within:outline-offset-4 cr:focus-within:outline-radar-ink`,
  resultCount: `cr:text-[15px] cr:text-radar-steel cr:mt-[24px] cr:mb-[8px]`,
  searchResults: `cr:min-h-[300px]`,
  course: `cr:grid cr:grid-cols-[1fr_auto] cr:items-center cr:gap-[24px] cr:py-[20px] cr:border-0 cr:border-b cr:border-solid cr:border-radar-mist
    cr:[&>span]:grid cr:[&>span]:grid-cols-1 cr:[&>span]:items-baseline cr:[&>span]:gap-[4px]
    cr:[&_strong]:text-[18px] cr:[&_strong]:font-medium cr:[&>span>span]:text-[17px] cr:[&>small]:text-[16px] cr:[&>small]:text-radar-steel`,
  noResults: `cr:py-[40px] cr:text-radar-steel`,
  pathBand: `cr:bg-radar-fog`,
  pathSection: `cr:py-[80px]`,
  path: `cr:py-[16px]`,
  pathSmall: ``,
  previewLabel: `cr:flex cr:items-center cr:gap-[10px] cr:text-[16px] cr:[&>span]:ml-auto cr:[&>span]:text-radar-steel`,
  pathNodes: `cr:relative cr:grid cr:grid-cols-3 cr:gap-[90px] cr:min-h-[290px] cr:my-[32px] cr:isolate`,
  pathColumn: `cr:relative cr:z-1 cr:flex cr:flex-col cr:justify-center cr:gap-[24px] cr:min-w-0`,
  pathStep: `cr:bg-white cr:border cr:border-solid cr:border-radar-mist cr:rounded-[18px] cr:p-[24px] cr:min-w-0
    cr:[&>span]:text-[15px] cr:[&>span]:text-radar-steel cr:[&_strong]:block cr:[&_strong]:font-display cr:[&_strong]:font-normal cr:[&_strong]:text-[26px] cr:[&_strong]:mt-[8px]
    cr:[&_p]:text-[16px] cr:[&_p]:mt-[8px] cr:[&_p]:leading-[1.45]
    cr:data-[active=true]:outline-2 cr:data-[active=true]:outline-radar-ink cr:data-[active=true]:outline-offset-[4px] cr:data-[muted=true]:bg-transparent cr:data-[muted=true]:border-dashed cr:data-[muted=true]:text-radar-steel`,
  pathTarget: `cr:border-radar-steel`,
  pathEdges: `cr:absolute cr:inset-0 cr:w-full cr:h-full cr:overflow-visible cr:pointer-events-none`,
  pathLine: `cr:fill-none cr:stroke-radar-wine cr:[stroke-linecap:round]`,
  pathArrow: `cr:fill-radar-wine`,
  pathNote: `cr:flex cr:justify-between cr:gap-[24px] cr:text-[16px] cr:text-radar-steel cr:[&_i]:hidden`,
  caption: `cr:!mt-[24px] cr:text-[16px] cr:text-radar-steel cr:max-w-[90ch]`,
  planLayout: `cr:py-[80px]`,
  semester: `cr:grid cr:grid-cols-[230px_1fr] cr:gap-x-[60px] cr:border-0 cr:border-t cr:border-solid cr:border-radar-mist cr:pt-[28px]`,
  termControls: `cr:flex cr:flex-col cr:items-stretch cr:gap-[12px] cr:row-span-3 cr:mb-0 cr:[&_button]:bg-white cr:[&_button]:text-radar-ink cr:[&_button]:border cr:[&_button]:border-solid cr:[&_button]:border-radar-steel cr:[&_button]:rounded-control cr:[&_button]:p-[12px_24px] cr:[&_button[aria-pressed=true]]:bg-radar-wine cr:[&_button[aria-pressed=true]]:text-white`,
  semesterHeading: `cr:flex cr:justify-between cr:items-baseline cr:gap-[24px] cr:mb-[20px] cr:[&_h3]:text-[26px] cr:[&>span]:text-radar-steel`,
  semesterRows: `cr:px-0 cr:py-[8px]`,
  planRow: `cr:grid cr:grid-cols-[150px_1fr_180px] cr:gap-[24px] cr:items-center cr:py-[24px] cr:border-0 cr:border-b cr:border-solid cr:border-radar-mist cr:last:border-0 cr:[&_strong]:font-medium cr:[&_strong]:text-[18px] cr:[&>span:last-child]:text-radar-steel cr:[&>span:last-child]:text-right`,
  weekBand: `cr:bg-radar-fog`,
  weekSection: `cr:py-[80px]`,
  week: `cr:bg-white cr:rounded-[20px] cr:p-[32px] cr:tabular-nums`,
  weekSmall: `cr:p-[20px] cr:border cr:border-solid cr:border-radar-mist cr:[&_strong]:text-[13px] cr:[&>div:first-child]:text-[17px] cr:[&>div:first-child>span]:text-[14px] cr:[&_p]:hidden cr:[&>div:nth-child(2)]:grid-cols-[38px_repeat(5,minmax(0,1fr))] cr:[&>div:nth-child(2)]:mt-[20px] cr:[&>div:nth-child(2)>div:first-child]:text-[12px] cr:[&>div:nth-child(2)>div:first-child]:pt-[34px] cr:[&>div:nth-child(2)>div:first-child>span]:h-[38px] cr:[&>div:nth-child(2)>div>span]:text-[13px] cr:[&>div:nth-child(2)>div>span]:pb-[10px] cr:[&>div:nth-child(2)>div>div]:h-[190px] cr:[&_[title]]:p-[3px_2px] cr:[&_[title]_strong]:text-[12px] cr:[&_[title]]:rounded-[6px]`,
  calendar: `cr:grid cr:grid-cols-[64px_repeat(5,minmax(0,1fr))] cr:mt-[28px]`,
  day: `cr:min-w-0 cr:[&>span]:block cr:[&>span]:text-center cr:[&>span]:text-[16px] cr:[&>span]:pb-[16px]`,
  dayTrack: `cr:relative cr:h-[480px] cr:border-0 cr:border-l cr:border-solid cr:border-radar-mist`,
  hours: `cr:flex cr:flex-col cr:pt-[41px] cr:text-[15px] cr:text-radar-steel cr:[&_span]:h-[96px]`,
  meeting: `cr:absolute cr:z-1 cr:p-[5px_8px] cr:rounded-[12px] cr:bg-radar-ash cr:text-radar-ink cr:min-w-0 cr:overflow-hidden cr:[&_strong]:block cr:[&_strong]:text-[16px] cr:[&_strong]:leading-[1.3] cr:[&_strong]:font-medium cr:[&>span]:block cr:[&>span]:text-[14px] cr:[&>span]:mt-[4px]`,
  meeting1: `cr:bg-radar-ivory`,
  meeting2: `cr:bg-radar-fog cr:border cr:border-solid cr:border-radar-mist`,
  previewFoot: `cr:text-[16px] cr:text-radar-steel cr:!mt-[24px]`,
  assistantNote: `cr:grid cr:grid-cols-[40px_1fr_1.2fr] cr:gap-[28px] cr:items-start cr:mt-[56px] cr:pt-[36px] cr:border-0 cr:border-t cr:border-solid cr:border-radar-mist cr:scroll-mt-[32px] cr:[&_svg]:text-radar-ink cr:[&_h3]:text-[32px] cr:[&_h3]:leading-[1.1] cr:[&_p]:text-[18px] cr:[&_p]:text-radar-steel`,
  close: `cr:bg-white`,
  closeInner: `cr:flex cr:justify-between cr:items-center cr:gap-[40px] cr:py-[80px] cr:border-0 cr:border-b cr:border-solid cr:border-radar-mist`,
  footer: `cr:grid cr:grid-cols-[1fr_2fr_auto] cr:gap-[60px] cr:items-start cr:py-[40px] cr:[&_p]:text-[16px] cr:[&_p]:text-radar-steel cr:[&>a:last-child]:flex cr:[&>a:last-child]:items-center cr:[&>a:last-child]:gap-[12px]`,
} as const;
