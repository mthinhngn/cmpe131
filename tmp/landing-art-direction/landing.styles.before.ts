/** Tailwind utility recipes for the landing composition.
 * Complete literal candidates keep source detection reliable. Named recipes are
 * Course Radar compositions, not generic shadcn/ui primitives. Arbitrary values
 * preserve the incumbent layout; shared roles use theme.css tokens.
 */
export const landingStyles = {
  page: `
    cr:bg-paper cr:text-ink cr:font-body cr:text-[15px] cr:leading-[1.55] cr:overflow-clip
    cr:[:where(&_*)]:[box-sizing:border-box] cr:[&_*::before]:[box-sizing:border-box]
    cr:[&_*::after]:[box-sizing:border-box] cr:[:where(&>main)]:max-w-[none] cr:[:where(&>main)]:m-[0]
    cr:[:where(&>main)]:p-[0] cr:[:where(&_h1)]:m-[0] cr:[:where(&_h2)]:m-[0] cr:[:where(&_h3)]:m-[0]
    cr:[:where(&_p)]:m-[0] cr:[:where(&_h1)]:font-display cr:[:where(&_h1)]:font-normal
    cr:[:where(&_h1)]:tracking-[-.035em] cr:[:where(&_h2)]:font-display cr:[:where(&_h2)]:font-normal
    cr:[:where(&_h2)]:tracking-[-.035em] cr:[:where(&_h3)]:font-display cr:[:where(&_h3)]:font-normal
    cr:[:where(&_h3)]:tracking-[-.035em] cr:[:where(&_a)]:text-inherit cr:[:where(&_a)]:no-underline
    cr:[:where(&_button)]:[font:inherit] cr:[:where(&_input)]:[font:inherit] cr:[:where(&_button)]:cursor-pointer
    cr:[:where(&_a)]:[-webkit-tap-highlight-color:transparent]
    cr:[:where(&_button)]:[-webkit-tap-highlight-color:transparent]
    cr:[:where(&_input)]:[-webkit-tap-highlight-color:transparent]
    cr:[:where(&_:focus-visible)]:[outline:2px_solid_var(--cr-color-brass)]
    cr:[:where(&_:focus-visible)]:outline-offset-[5px] cr:[&_::selection]:[background:#e9c9b7]
    cr:[&_::selection]:text-ink cr:[:where(&_h2)]:text-section cr:[:where(&_h2)]:leading-[1.08]
    cr:max-[800px]:[:where(&_h2)]:text-[42px] cr:max-[480px]:[:where(&_h2)]:text-[36px]
  `,
  wrap: `
    cr:w-[min(1200px,_calc(100%_-_96px))] cr:mx-auto cr:max-[1100px]:w-[calc(100%_-_64px)]
    cr:max-[800px]:w-[calc(100%_-_40px)]
  `,
  skip: `
    cr:fixed cr:top-[-80px] cr:left-[20px] cr:z-[30] cr:bg-ink cr:[&&]:text-white cr:p-[12px_20px]
    cr:[&:focus]:top-[12px]
  `,
  header: `
    cr:min-h-[120px] cr:flex cr:justify-between cr:items-center cr:gap-[20px] cr:[&_nav]:flex
    cr:[&_nav]:items-center cr:[&_nav]:gap-[7px] cr:[&_nav]:p-[7px] cr:[&_nav]:bg-warm-ash
    cr:[&_nav]:rounded-[200px] cr:[&_nav_a]:p-[9px_20px] cr:[&_nav_a]:text-[14px] cr:[&_nav_a]:rounded-[200px]
    cr:[&_nav_a]:[transition:background_180ms] cr:[&_nav_a:hover]:[background:#e5e2da]
    cr:max-[1100px]:[&_nav_a]:px-[14px] cr:max-[800px]:min-h-[95px] cr:max-[800px]:flex-wrap
    cr:max-[800px]:gap-[16px] cr:max-[800px]:py-[22px] cr:max-[800px]:[&_nav]:[order:3]
    cr:max-[800px]:[&_nav]:w-full cr:max-[800px]:[&_nav]:justify-center cr:max-[800px]:[&_nav_a]:flex-1
    cr:max-[800px]:[&_nav_a]:text-center
  `,
  brand: `
    cr:inline-flex cr:gap-[9px] cr:items-center cr:font-display cr:text-[25px] cr:tracking-[-.035em]
    cr:whitespace-nowrap cr:[[data-section=footer]_&]:text-[22px] cr:max-[800px]:text-[23px]
  `,
  brandDot: `
    cr:text-persimmon cr:ml-[-7px]
  `,
  button: `
    cr:inline-flex cr:items-center cr:justify-center cr:gap-[21px] cr:bg-ink cr:text-white cr:p-[15px_23px]
    cr:[border:1px_solid_var(--cr-color-ink)] cr:text-[14px] cr:leading-[1.25] cr:min-h-[49px]
    cr:[transition:background_180ms,_transform_180ms] cr:[&:hover]:[background:#49463f]
    cr:[&:hover]:[transform:translateY(-2px)] cr:max-[480px]:p-[14px_16px] cr:max-[480px]:text-[12px]
    cr:max-[480px]:gap-[15px] cr:rounded-control
  `,
  buttonOutline: `
    cr:bg-transparent cr:text-ink cr:[&:hover]:[background:#eae7df]
  `,
  headerCta: `
    cr:p-[13px_19px] cr:max-[800px]:text-[12px] cr:max-[800px]:min-h-[42px] cr:max-[800px]:p-[10px_13px]
    cr:max-[800px]:gap-[10px]
  `,
  hero: `
    cr:grid cr:[grid-template-columns:.93fr_1.07fr] cr:gap-[30px] cr:items-center cr:min-h-[635px] cr:pt-[40px]
    cr:pb-[75px] cr:[&_h1]:text-display cr:[&_h1]:leading-[.99] cr:[&_h1]:tracking-[-.04em]
    cr:[&_h1_span]:[color:#8a775a] cr:min-[1500px]:min-h-[690px]
    cr:max-[1100px]:[grid-template-columns:.92fr_1.08fr] cr:max-[1100px]:gap-[15px]
    cr:max-[1100px]:[&_h1]:text-[70px] cr:max-[800px]:[grid-template-columns:1fr] cr:max-[800px]:pt-[38px]
    cr:max-[800px]:pb-[50px] cr:max-[800px]:gap-[50px] cr:max-[800px]:[&_h1]:text-[76px]
    cr:max-[480px]:[&_h1]:text-[67px]
  `,
  heroCopy: `
    cr:[&>p]:max-w-[390px] cr:[&>p]:text-[17px] cr:[&>p]:leading-[1.65] cr:[&>p]:[color:#59564f] cr:[&>p]:mt-[28px]
    cr:max-[800px]:[&>p]:max-w-[450px] cr:max-[480px]:[&>p]:text-[15px]
  `,
  actions: `
    cr:flex cr:gap-[12px] cr:mt-[31px] cr:flex-wrap cr:max-[1100px]:flex-col cr:max-[1100px]:items-start
    cr:max-[800px]:flex-row cr:max-[480px]:gap-[10px]
  `,
  heroNote: `
    cr:block cr:text-subdued cr:text-[12px] cr:mt-[22px]
  `,
  heroArt: `
    cr:relative cr:min-h-[520px] cr:isolate cr:[&::before]:content-[''] cr:[&::before]:absolute
    cr:[&::before]:[background:#eeebe3] cr:[&::before]:w-[87%] cr:[&::before]:h-[79%] cr:[&::before]:left-[7%]
    cr:[&::before]:top-[10%] cr:[&::before]:rounded-asymmetric cr:[&::before]:z-[-1]
    cr:max-[1100px]:[transform:scale(.93)] cr:max-[1100px]:[transform-origin:center_right]
    cr:max-[800px]:w-[min(590px,100%)] cr:max-[800px]:min-h-[485px] cr:max-[800px]:[transform:none]
    cr:max-[800px]:mx-auto cr:max-[480px]:min-h-[485px] cr:max-[480px]:[&::before]:h-[80%]
  `,
  heroPath: `
    cr:absolute cr:top-[0] cr:left-[0] cr:w-[88%] cr:z-[1] cr:[&&]:animate-path-arrive cr:max-[480px]:w-full
  `,
  heroSemester: `
    cr:absolute cr:top-[235px] cr:left-[0] cr:w-[46%] cr:z-[3] cr:[&&]:animate-plan-arrive
    cr:max-[800px]:top-[175px] cr:max-[480px]:w-[63%] cr:max-[480px]:top-[172px] cr:max-[480px]:z-[2]
  `,
  heroWeek: `
    cr:absolute cr:top-[260px] cr:right-[-7px] cr:w-[57%] cr:z-[2] cr:[&&]:animate-week-arrive
    cr:max-[800px]:top-[210px] cr:max-[800px]:right-[0] cr:max-[480px]:w-[70%] cr:max-[480px]:top-[290px]
    cr:max-[480px]:z-[3]
  `,
  previewLabel: `
    cr:flex cr:gap-[9px] cr:items-center cr:text-[14px] cr:font-medium cr:[&>span]:ml-[auto]
    cr:[&>span]:text-[10px] cr:[&>span]:font-normal cr:[&>span]:text-subdued
    cr:[[data-semester-size=compact]_&]:text-[12px] cr:[[data-semester-size=compact]_&>span]:text-[8px]
    cr:[[data-week-size=compact]_&]:text-[11px] cr:[[data-week-size=compact]_&>span]:text-[8px]
    cr:max-[480px]:text-[12px] cr:max-[480px]:[&>span]:text-[9px]
  `,
  path: `
    cr:bg-white cr:[border:1px_solid_var(--cr-color-hairline)] cr:rounded-data cr:p-[25px] cr:tabular-nums
    cr:[[data-section=path]>&]:[background:#f0eee7] cr:[[data-section=path]>&]:[border:0]
    cr:[[data-section=path]>&]:p-[34px_40px] cr:[[data-section=path]>&]:rounded-asymmetric
    cr:max-[800px]:[[data-section=path]>&]:p-[25px]
  `,
  semester: `
    cr:bg-white cr:[border:1px_solid_var(--cr-color-hairline)] cr:rounded-data cr:p-[25px] cr:tabular-nums
    cr:[[data-section=plan-art]>&]:relative cr:[[data-section=plan-art]>&]:z-[1]
    cr:max-[480px]:[[data-section=plan-art]>&]:p-[20px]
  `,
  week: `
    cr:bg-white cr:[border:1px_solid_var(--cr-color-hairline)] cr:rounded-data cr:p-[25px] cr:tabular-nums
    cr:[[data-section=week]>&]:[background:#f5f3ee] cr:[[data-section=week]>&]:[border:0]
    cr:[[data-section=week]>&]:rounded-asymmetric cr:[[data-section=week]>&]:p-[30px]
    cr:max-[800px]:[[data-section=week]>&]:w-full cr:max-[480px]:[[data-section=week]>&]:p-[22px_15px]
  `,
  pathNodes: `
    cr:flex cr:gap-[0] cr:m-[30px_0_24px] cr:[[data-path-size=compact]_&]:m-[19px_0_16px]
    cr:max-[480px]:[[data-section=path]_&]:flex-col cr:max-[480px]:[[data-section=path]_&]:gap-[0]
    cr:max-[480px]:[[data-section=path]_&]:my-[20px]
  `,
  pathStep: `
    cr:flex cr:items-center cr:flex-1 cr:min-w-0 cr:[&>a]:block cr:[&>a]:w-full cr:[&>a]:p-[23px]
    cr:[&>a]:[background:#f7f6f2] cr:[&>a]:[border:1px_solid_#e0ddd4] cr:[&>a]:rounded-asymmetric
    cr:[&>a]:[transition:background_180ms] cr:[&>a:hover]:[background:#ece6d9]
    cr:[&:last-child>a]:[background:#f9eee7] cr:[&:last-child>a]:[border-color:#e5cbbb] cr:[&>a>span]:text-subdued
    cr:[&>a>span]:text-[11px] cr:[&_strong]:block cr:[&_strong]:text-[21px] cr:[&_strong]:font-medium
    cr:[&_strong]:mt-[12px] cr:[&_p]:[color:#5b5750] cr:[&_p]:text-[13px] cr:[&_p]:min-h-[42px] cr:[&_p]:mt-[6px]
    cr:[[data-path-size=compact]_&>a]:p-[12px] cr:[[data-path-size=compact]_&_strong]:text-[15px]
    cr:[[data-path-size=compact]_&_strong]:mt-[6px] cr:[[data-path-size=compact]_&_p]:text-[10px]
    cr:[[data-path-size=compact]_&_p]:leading-[1.4] cr:[[data-path-size=compact]_&_p]:min-h-[42px]
    cr:[[data-path-size=compact]_&>a>span]:text-[9px] cr:[[data-section=path]_&>a]:bg-white
    cr:[[data-section=path]_&:last-child>a]:[background:#f9eee7] cr:max-[800px]:[&>a]:p-[15px]
    cr:max-[800px]:[&_strong]:text-[18px] cr:max-[800px]:[&_p]:text-[11px]
    cr:max-[480px]:[[data-path-size=compact]_&>a]:p-[8px]
    cr:max-[480px]:[[data-path-size=compact]_&_strong]:text-[12px]
    cr:max-[480px]:[[data-path-size=compact]_&_p]:text-[8px] cr:max-[480px]:[[data-section=path]_&]:flex-col
    cr:max-[480px]:[[data-section=path]_&]:w-full cr:max-[480px]:[[data-section=path]_&>a]:p-[15px_20px]
    cr:max-[480px]:[[data-section=path]_&_strong]:mt-[3px] cr:max-[480px]:[[data-section=path]_&_p]:min-h-[0]
    cr:max-[480px]:[[data-section=path]_&_p]:text-[12px]
  `,
  connector: `
    cr:flex cr:justify-end cr:items-center cr:w-[66px] cr:shrink-0 cr:text-persimmon cr:relative
    cr:[&::before]:content-[''] cr:[&::before]:h-px cr:[&::before]:w-[calc(100%_-_14px)]
    cr:[&::before]:bg-persimmon cr:[&::before]:absolute cr:[&::before]:left-[0]
    cr:[[data-path-size=compact]_&]:w-[27px] cr:max-[800px]:w-[35px]
    cr:max-[480px]:[[data-section=path]_&]:h-[32px] cr:max-[480px]:[[data-section=path]_&]:w-[32px]
    cr:max-[480px]:[[data-section=path]_&]:[transform:rotate(90deg)]
  `,
  pathNote: `
    cr:flex cr:items-center cr:gap-[8px] cr:text-[11px] cr:text-subdued cr:[&_i]:inline-block cr:[&_i]:w-[6px]
    cr:[&_i]:h-[6px] cr:[&_i]:rounded-[50%] cr:[&_i]:bg-persimmon cr:[&>span]:ml-[auto]
    cr:[[data-path-size=compact]_&]:text-[9px] cr:[[data-path-size=compact]_&>span]:hidden cr:max-[480px]:flex-wrap
    cr:max-[480px]:[&>span]:ml-[14px] cr:max-[480px]:[&>span]:text-[9px]
  `,
  pathSmall: `
    cr:p-[19px] cr:max-[480px]:p-[15px]
  `,
  semesterTotal: `
    cr:m-[20px_0_13px] cr:flex cr:justify-between cr:items-baseline cr:[&_strong]:text-[29px]
    cr:[&_strong]:font-normal cr:[&_strong]:tracking-[-.02em] cr:[&_small]:text-[11px] cr:[&_small]:tracking-[0]
    cr:[&>span]:text-[11px] cr:[&>span]:text-subdued cr:[[data-semester-size=compact]_&]:mt-[12px]
    cr:[[data-semester-size=compact]_&_strong]:text-[24px] cr:[[data-semester-size=compact]_&_small]:text-[8px]
    cr:[[data-semester-size=compact]_&>span]:hidden cr:max-[480px]:flex-wrap cr:max-[480px]:gap-[5px]
  `,
  course: `
    cr:flex cr:gap-[13px] cr:items-center cr:p-[18px_0] cr:[border-bottom:1px_solid_#e8e5de] cr:[&>span]:min-w-0
    cr:[&>span]:flex-1 cr:[&_strong]:block cr:[&_strong]:text-[14px] cr:[&_strong]:font-medium
    cr:[&>span>span]:block cr:[&>span>span]:text-[12px] cr:[&>span>span]:text-subdued cr:[&>span>span]:mt-[4px]
    cr:[&>small]:text-[11px] cr:[&>small]:whitespace-nowrap cr:[&>small]:text-subdued
    cr:[&:hover_strong]:[color:#aa4525] cr:[&:hover_strong]:underline cr:[&:hover_strong]:underline-offset-[4px]
    cr:[[data-semester-size=compact]_&]:p-[10px_0] cr:[[data-semester-size=compact]_&]:gap-[5px]
    cr:[[data-semester-size=compact]_&_strong]:text-[11px] cr:[[data-semester-size=compact]_&>span>span]:text-[9px]
    cr:[[data-semester-size=compact]_&>span>span]:leading-[1.4]
    cr:[[data-semester-size=compact]_&>small]:text-[9px] cr:[[data-semester-size=compact]_&>svg]:hidden
    cr:max-[480px]:[&>span>span]:text-[11px]
  `,
  previewFoot: `
    cr:text-subdued cr:text-[10px] cr:[&&]:mt-[17px] cr:[[data-semester-size=compact]_&]:text-[8px]
    cr:[[data-week-size=compact]_&]:text-[7px]
  `,
  semesterSmall: `
    cr:p-[18px]
  `,
  calendar: `
    cr:grid cr:[grid-template-columns:40px_repeat(5,minmax(0,1fr))] cr:mt-[25px]
    cr:[[data-week-size=compact]_&]:[grid-template-columns:25px_repeat(5,minmax(0,1fr))]
    cr:[[data-week-size=compact]_&]:mt-[15px] cr:max-[480px]:[grid-template-columns:31px_repeat(5,minmax(0,1fr))]
  `,
  day: `
    cr:[&>span]:block cr:[&>span]:text-center cr:[&>span]:text-[11px] cr:[&>span]:pb-[10px]
    cr:[[data-week-size=compact]_&>span]:text-[8px]
  `,
  dayTrack: `
    cr:relative cr:h-[290px] cr:[border-left:1px_solid_#e8e5de]
    cr:[background:repeating-linear-gradient(to_bottom,_#e8e5de_0,_#e8e5de_1px,_transparent_1px,_transparent_20%)]
    cr:[[data-week-size=compact]_&]:h-[165px] cr:max-[480px]:[[data-week-size=compact]_&]:h-[120px]
  `,
  hours: `
    cr:flex cr:flex-col cr:pt-[25px] cr:text-[9px] cr:text-subdued cr:[&_span]:h-[20%]
    cr:[[data-week-size=compact]_&]:text-[7px] cr:[[data-week-size=compact]_&]:pt-[22px]
  `,
  meeting: `
    cr:absolute cr:left-[3px] cr:right-[3px] cr:p-[7px_5px] cr:rounded-[3px] cr:[background:#ece5d7]
    cr:overflow-hidden cr:[color:#584a32] cr:min-h-[18px] cr:[&_strong]:block cr:[&_strong]:text-[9px]
    cr:[&_strong]:font-medium cr:[&>span]:block cr:[&>span]:text-[8px] cr:[&>span]:mt-[2px]
    cr:[[data-week-size=compact]_&]:left-[2px] cr:[[data-week-size=compact]_&]:right-[2px]
    cr:[[data-week-size=compact]_&]:p-[3px_2px] cr:[[data-week-size=compact]_&_strong]:text-[6px]
    cr:max-[480px]:p-[5px_2px] cr:max-[480px]:left-[2px] cr:max-[480px]:right-[2px]
    cr:max-[480px]:[&_strong]:text-[7px] cr:max-[480px]:[&>span]:text-[6px]
  `,
  meeting1: `
    cr:[background:#f4dfd1] cr:[color:#773e25]
  `,
  meeting2: `
    cr:[background:#e5e3dc] cr:[color:#4c4a44]
  `,
  weekSmall: `
    cr:p-[18px_15px]
  `,
  replay: `
    cr:absolute cr:right-[8px] cr:bottom-[-53px] cr:flex cr:items-center cr:gap-[10px] cr:bg-transparent
    cr:[border:0] cr:[color:#645c4e] cr:[&&]:text-[10px] cr:p-[8px] cr:[&:hover]:underline
    cr:[&:hover]:underline-offset-[4px] cr:max-[800px]:bottom-[-18px] cr:max-[480px]:bottom-[-24px]
  `,
  scope: `
    cr:flex cr:items-center cr:gap-[45px] cr:py-[41px_55px] cr:[&>p]:text-[13px] cr:[&>p]:leading-[1.7]
    cr:[&>p>span]:block cr:[&>p>span]:text-subdued cr:[&>p>span]:text-[11px] cr:max-[1100px]:gap-[25px]
    cr:max-[800px]:flex-wrap cr:max-[800px]:gap-[24px] cr:max-[800px]:py-[25px_44px]
    cr:max-[800px]:[&>p:first-child]:w-[calc(100%_-_150px)]
  `,
  programs: `
    cr:flex cr:gap-[38px] cr:flex-1 cr:[&_button]:relative cr:[&_button]:bg-transparent cr:[&_button]:text-ink
    cr:[&_button]:text-left cr:[&_button]:p-[8px_22px_8px_0] cr:[&_button]:font-display cr:[&_button]:text-[19px]
    cr:[&_button]:leading-[1.6] cr:[&_button>span]:block cr:[&_button>span]:text-subdued cr:[&_button>span]:font-body
    cr:[&_button>span]:text-[10px] cr:[&_button>svg]:absolute cr:[&_button>svg]:right-[0]
    cr:[&_button>svg]:bottom-[14px] cr:[&_button>svg]:text-brass cr:max-[1100px]:gap-[22px]
    cr:max-[1100px]:[&_button]:text-[16px] cr:max-[800px]:[order:3] cr:max-[800px]:[flex-basis:100%]
    cr:max-[800px]:gap-[30px] cr:max-[480px]:gap-[17px] cr:max-[480px]:[&_button]:text-[14px]
    cr:max-[480px]:[&_button]:flex-1 cr:max-[480px]:[&_button]:pr-[18px] cr:max-[480px]:[&_button>span]:text-[9px]
    cr:[&_button]:border-0 cr:[&_button]:border-b cr:[&_button]:border-solid cr:[&_button]:border-transparent
    cr:[&_button[aria-pressed=true]]:border-brass
  `,
  scopeCatalog: `
    cr:text-brass cr:[&&]:text-[18px] cr:whitespace-nowrap cr:max-[800px]:[&&]:ml-[auto]
  `,
  band: `
    cr:bg-warm-ash
  `,
  explore: `
    cr:grid cr:[grid-template-columns:.85fr_1.15fr] cr:items-center cr:gap-[100px] cr:py-[95px]
    cr:max-[1100px]:gap-[45px] cr:max-[800px]:[grid-template-columns:1fr] cr:max-[800px]:py-[65px]
    cr:max-[800px]:gap-[40px]
  `,
  sectionCopy: `
    cr:[&>p]:[color:#5b5750] cr:[&>p]:text-[16px] cr:[&>p]:leading-[1.75] cr:[&>p]:mt-[24px] cr:[&>p]:max-w-[410px]
    cr:max-[800px]:[&>p]:max-w-[550px] cr:max-[480px]:[&>p]:text-[14px]
  `,
  sectionTop: `
    cr:[&>div>p]:[color:#5b5750] cr:[&>div>p]:text-[16px] cr:[&>div>p]:leading-[1.75] cr:[&>div>p]:mt-[24px]
    cr:[&>div>p]:max-w-[410px] cr:grid cr:[grid-template-columns:1fr_1fr] cr:gap-[110px] cr:items-start
    cr:mb-[48px] cr:[&>div>p]:mt-[0] cr:max-[1100px]:gap-[60px] cr:max-[800px]:[grid-template-columns:1fr]
    cr:max-[800px]:gap-[24px] cr:max-[800px]:mb-[30px] cr:max-[800px]:[&>div>p]:max-w-[550px]
    cr:max-[480px]:[&>div>p]:text-[14px]
  `,
  textLink: `
    cr:inline-flex cr:items-center cr:gap-[25px] cr:text-[14px] cr:py-[4px]
    cr:[border-bottom:1px_solid_var(--cr-color-persimmon)] cr:mt-[25px]
    cr:[&:hover_svg]:[transform:translate(2px,-2px)] cr:[&_svg]:[transition:transform_180ms]
  `,
  explorer: `
    cr:bg-paper cr:p-[29px_30px_22px] cr:rounded-asymmetric cr:max-[480px]:p-[22px_19px]
  `,
  search: `
    cr:flex cr:items-center cr:gap-[12px] cr:p-[12px_14px] cr:[border:1px_solid_var(--cr-color-hairline)]
    cr:mt-[24px] cr:bg-white cr:[&_input]:[border:0] cr:[&_input]:bg-transparent cr:[&_input]:text-ink
    cr:[&_input]:w-full cr:[&_input]:min-w-0 cr:[&_input]:p-[2px] cr:[&_input]:text-[12px]
    cr:[&_input]:[caret-color:#a54c2d] cr:[&_input::placeholder]:[color:#777168] cr:rounded-control
  `,
  searchResults: `
    cr:min-h-[230px]
  `,
  noResults: `
    cr:p-[30px_0] cr:text-subdued
  `,
  explorerFoot: `
    cr:text-[10px] cr:text-subdued cr:flex cr:justify-between cr:items-center cr:gap-[15px] cr:mt-[24px]
  `,
  pathSection: `
    cr:py-[110px_95px] cr:max-[800px]:py-[65px]
  `,
  caption: `
    cr:text-subdued cr:[&&]:mt-[17px] cr:text-[11px]
  `,
  planLayout: `
    cr:grid cr:[grid-template-columns:1.12fr_.88fr] cr:gap-[100px] cr:items-center cr:py-[95px]
    cr:max-[1100px]:gap-[45px] cr:max-[800px]:[grid-template-columns:1fr] cr:max-[800px]:py-[65px]
    cr:max-[800px]:gap-[40px]
  `,
  planArt: `
    cr:relative cr:p-[0_65px_45px_0] cr:max-[800px]:[order:2] cr:max-[800px]:max-w-[580px] cr:max-[480px]:pr-[25px]
    cr:max-[480px]:pb-[70px]
  `,
  nextSemester: `
    cr:absolute cr:w-[45%] cr:right-[0] cr:bottom-[0] cr:[background:#e2ddcf] cr:p-[25px] cr:min-h-[180px] cr:z-[2]
    cr:rounded-asymmetric cr:[&>span]:text-[11px] cr:[&>span]:[color:#655943] cr:[&>p]:font-display
    cr:[&>p]:text-[22px] cr:[&>p]:leading-[1.2] cr:[&>p]:mt-[16px] cr:[&>a]:block cr:[&>a]:text-right
    cr:[&>a]:mt-[15px] cr:max-[480px]:min-h-[140px] cr:max-[480px]:w-[48%] cr:max-[480px]:p-[17px]
    cr:max-[480px]:[&>p]:text-[20px]
  `,
  smallNote: `
    cr:[[data-section-copy]>&]:text-[11px] cr:[[data-section-copy]>&]:mt-[27px]
  `,
  weekSection: `
    cr:grid cr:[grid-template-columns:1fr_1fr] cr:gap-[90px] cr:items-center cr:py-[115px]
    cr:max-[1100px]:gap-[45px] cr:max-[800px]:[grid-template-columns:1fr] cr:max-[800px]:py-[65px]
    cr:max-[800px]:gap-[40px]
  `,
  assistantNote: `
    cr:flex cr:gap-[15px] cr:mt-[45px] cr:pt-[26px] cr:[border-top:1px_solid_var(--cr-color-hairline)]
    cr:[&>svg]:shrink-0 cr:[&>svg]:text-brass cr:[&>svg]:mt-[3px] cr:[&_h3]:text-[19px] cr:[&_h3]:leading-[1.3]
    cr:[&_h3]:tracking-[-.02em] cr:[&_p]:text-[12px] cr:[&_p]:leading-[1.7] cr:[&_p]:text-subdued cr:[&_p]:mt-[10px]
    cr:[&_a]:inline-flex cr:[&_a]:gap-[10px] cr:[&_a]:items-center cr:[&_a]:text-[12px] cr:[&_a]:mt-[14px]
    cr:[&_a]:underline cr:[&_a]:underline-offset-[4px]
  `,
  close: `
    cr:[background:#eae6dc] cr:text-center cr:py-[76px_86px] cr:[&_h2]:text-[clamp(39px,_4.6vw,_60px)]
    cr:[&_p]:text-[14px] cr:[&_p]:[color:#5d564b] cr:[&_p]:my-[24px_28px] cr:max-[480px]:p-[60px_0]
    cr:max-[480px]:[&_h2]:text-[38px] cr:max-[480px]:[&_p]:text-[12px]
  `,
  closeMark: `
    cr:inline-flex cr:mb-[24px] cr:[color:#917958]
  `,
  footer: `
    cr:py-[45px] cr:flex cr:justify-between cr:items-start cr:gap-[35px] cr:[&_p]:text-[10px] cr:[&_p]:text-subdued
    cr:[&_p]:leading-[1.8] cr:[&_p]:mt-[10px] cr:[&>div:nth-child(2)]:max-w-[420px]
    cr:[&>div:nth-child(2)_p]:mt-[0] cr:[&>div:nth-child(2)_a]:inline-flex cr:[&>div:nth-child(2)_a]:gap-[8px]
    cr:[&>div:nth-child(2)_a]:items-center cr:[&>div:nth-child(2)_a]:text-[10px] cr:[&>div:nth-child(2)_a]:mt-[9px]
    cr:[&>a]:text-[11px] cr:[&>a]:whitespace-nowrap cr:max-[800px]:flex-wrap cr:max-[800px]:gap-[25px]
    cr:max-[800px]:[&>div:nth-child(2)]:[order:3] cr:max-[800px]:[&>div:nth-child(2)]:w-full
    cr:max-[800px]:[&>div:nth-child(2)]:max-w-[none] cr:max-[800px]:[&>a]:ml-[auto]
  `,
  reveal: `
    cr:data-[in-view=true]:animate-section-reveal
  `,
} as const;
