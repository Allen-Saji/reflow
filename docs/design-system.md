# Interface design system

Reflow offers dark gold and light ivory/bronze themes with shared typography and layouts. Shared tokens and responsive components live in `src/web/style.css`; fonts are served from the application assets.

## Tokens

| Token         | Value                     | Use                                     |
| ------------- | ------------------------- | --------------------------------------- |
| Background    | `#0a0a0a`                 | Application canvas                      |
| Dot grid      | White at 8%, 32px spacing | Quiet background texture                |
| Base gold     | `#a78b71`                 | Accents, graph connectors               |
| Light gold    | `#c9b8a0`                 | Labels and default accents              |
| Hover gold    | `#e8d5b7`                 | Hover and gradient highlights           |
| Glass         | `rgba(255,255,255,0.03)`  | Cards and panels                        |
| Border        | `rgba(255,255,255,0.1)`   | Panel boundaries                        |
| Backdrop blur | `10px`                    | Glass surfaces                          |
| Radius        | 24px to 40px              | Cards, dialogs and network illustration |

Landing headings use Playfair Display Italic. The operational workspace uses upright Inter headings, short labels and plain descriptions for quick scanning. Dashboard body text is 14px on desktop and 16px on phones; metric labels and table details use 12-13px. UI labels, body text and tabular numbers use Inter, weights 300 through 700. Status badges include text as well as color. Supporting success/error colors remain muted so eligibility and failure states are distinguishable.

## Theme selection

A theme button is available in the landing navigation and workspace header. New visitors follow their operating system preference. An explicit light/dark choice is saved under `reflow-theme` in local storage, takes precedence over system changes and stays synchronized across tabs. If storage is blocked, the control works for the current visit.

The initial HTML sets the saved/system theme before the application stylesheet loads. Theme changes also update `color-scheme` and the browser's `theme-color`. Dialogs, source drawers, forms, tables, status colors, dot grids and lazy graph nodes use shared palette tokens. Graph arrows and the React Flow color mode update with the selected theme.

| Token           | Dark        | Light        |
| --------------- | ----------- | ------------ |
| Canvas          | `#0a0a0a`   | `#f5f2ec`    |
| Primary text    | `#eee9e2`   | `#25211d`    |
| Supporting text | `#a8a29a`   | `#655d54`    |
| Accent          | `#a78b71`   | `#8b623e`    |
| Accent text     | `#c9b8a0`   | `#755033`    |
| Card            | White at 3% | White at 70% |
| Dot grid        | White at 8% | Brown at 10% |

Primary buttons use separate fill/foreground tokens so the bronze text palette does not dictate button contrast. Theme switching keeps content stationary; interaction motion continues to respect reduced-motion preferences.

## Motion

- GSAP `power4.out` provides scoped, staggered entrance reveals. The landing sequence uses 28px movement; workspace content uses 14px.
- Interactive transitions use `cubic-bezier(0.4,0,0.2,1)`, generally 180-300ms. Buttons have a small hover lift and press response.
- The landing illustration has a short, finite connector animation. This is an illustration, not live investigation progress.
- Tab controls and case headers stay stationary when the selected panel changes. Arrow keys and Home/End move focus and selection through tabs.
- Dialogs enter with a short fade and displacement. The source drawer enters from its edge; keyboard focus is contained and restored on close.
- Tool events appear only after actual operations return. Verification styling reflects saved application state.
- `prefers-reduced-motion: reduce` disables CSS movement and prevents GSAP reveals. Preference changes revert any active GSAP styles.

The graph viewer loads on demand. Its loading/error states preserve a readable application surface; a visual-graph failure retains the recorded text path and a reload control.

## Responsive behavior

Desktop uses a floating navigation rail and multi-column cards. Phones use compact top navigation, stacked metrics and plans, scrollable data tables, and a textual relationship path. Forms and dialogs remain within the viewport. Primary mobile body copy is at least 16px, while labels and dense tabular metadata use smaller sizes.
