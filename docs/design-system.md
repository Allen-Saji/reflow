# Interface design system

Reflow uses a dark editorial interface with restrained gold accents. Shared tokens and responsive components live in `src/web/style.css`; fonts are served from the application assets.

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

Headings use Playfair Display Italic. UI labels, body text and tabular numbers use Inter, weights 300 through 700. Status badges include text as well as color. Supporting success/error colors remain muted so eligibility and failure states are distinguishable.

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
