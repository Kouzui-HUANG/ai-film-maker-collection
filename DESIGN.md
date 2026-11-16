# Design: 台灣AI影視創作者圖鑑

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule. The tokens live in `src/styles/global.css` (`:root`), under the project's own names; `docs/dev/CONTRACT.md` §1 rule 7 and §2 hold the page conventions.

## System
- Genre: editorial
- Shape of the first page: kept (a newspaper front page: the lead film, then the latest creators, works, columns, events)
- Theme: brand (片基褐 film base, cyanotype indigo signal, Shippori Mincho)
- Axes: dark/roman-serif/cool · posture: Restrained

## Tokens
`src/styles/global.css` is the source of truth. The roles, mapped to the project's names:
```css
:root {
  --paper: oklch(20.8% 0.009 59);  --paper-alt: oklch(17.1% 0.007 56);  --paper-raised: oklch(24% 0.014 67);
  --ink: oklch(92.7% 0.014 78);  --ink-soft: oklch(80.8% 0.019 78);  --muted: oklch(66.2% 0.017 68);
  --rule: oklch(93.6% 0.014 78);  --rule-soft: oklch(33.6% 0.02 67);  --rule-strong: oklch(40.3% 0.025 67);
  --accent: oklch(74.2% 0.092 269);  --accent-text: var(--paper-raised);  --accent-ink: oklch(53.6% 0.122 269);
  --font-serif: 'Shippori Mincho', 'Noto Serif TC', …;  --font-sans: 'Noto Sans TC', …;  --font-mono: ui-monospace, …;
  --text-display: clamp(2.5rem, 3.4vw + 1.25rem, 4.5rem);      /* the front-page lead title */
  --text-display-s: clamp(2.25rem, 2.8vw + 1.25rem, 3.75rem);  /* every inner-page h1 */
  --text-section: clamp(1.75rem, 1.6vw + 1.25rem, 2.75rem);    /* every section h2 */
  --section-gap-s: clamp(64px, 6vw + 40px, 120px);  --section-gap: clamp(72px, 7vw + 48px, 144px);
}
```
Radius 0 everywhere, 1px rules, no shadows. Weights 400 / 700 / 800 only (`font-synthesis: none`). Spacing on a 4px grid. Durations `--dur-micro` 120ms, `--dur-short` 220ms, `--dur-long` 420ms on `--ease-out`.

## Chrome
- `/`: the nameplate (the site name large, the tagline under it), a double rule, the main nav, a hairline.
- Every other page: the running head (the site name left, the nav right, one line), a hairline. The ⋮ drawer shows under 861px only.

## Controls
- Primary: `.btn--accent`, indigo fill, `--accent-text` ink, radius 0, 44px tall; one a page at most.
- Secondary: `.btn`, a 1px `--ink-soft` outline on `--paper-raised`; tertiary `.btn--ghost`, a `--rule-strong` outline. Hover is one signal: the outline or fill steps lighter.

## Motion
- Character: still. Colour and outline steps only; no lifts, no image zoom on hover; under reduced motion everything ends at once.

## Exports
`src/styles/global.css` in this project. Tailwind, DTCG or shadcn blocks are added here on request.
