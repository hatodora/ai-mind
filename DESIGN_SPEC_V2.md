# Mindmap UI/UX Design Spec v2.0

**Project**: 思索 / Global Mindmap Platform  
**Version**: 2.0 (Redesign from Wajin → Global Modern)  
**Date**: 2026-07-08  
**Direction**: Dark Modern + Warm Typography + Friendly Accessibility

---

## 1. Design Philosophy

- **Primary Market**: Global (English-first), with Japanese support
- **Brand Feeling**: Notion × Figma (accessible, creative, not corporate)
- **Visual Principle**: Warm geometry + clear hierarchy + dark elegance
- **Interaction Model**: Friendly, tactile (hover feedback, micro-animations)
- **Avoidance**: Cold, sterile, "AI-generated" aesthetic

---

## 2. Color System (Draft Proposal)

### Primary Palette

| Name | Hex | RGB | Purpose |
|------|-----|-----|---------|
| **Dark BG** | `#1a1a1a` | 26, 26, 26 | Main background (very dark, neutral) |
| **Dark BG Alt** | `#2a2a2a` | 42, 42, 42 | Slightly lighter (cards, panels) |
| **Text Light** | `#f5f5f5` | 245, 245, 245 | Primary text (high contrast) |
| **Text Muted** | `#a0a0a0` | 160, 160, 160 | Secondary text, labels |

### Accent Colors (Bright, Energetic)

| Name | Hex | Purpose |
|------|-----|---------|
| **Purple** | `#a78bfa` | Primary action, highlights |
| **Cyan** | `#22d3ee` | Accent 2, alerts/info |
| **Amber** | `#fbbf24` | Warmth, AI suggestions, badges |
| **Teal** | `#14b8a6` | Adopt/accept state, success |

### Semantic Colors

| State | Color | Hex |
|-------|-------|-----|
| Error | Red | `#ef4444` |
| Warning | Orange | `#f97316` |
| Success | Teal | `#14b8a6` |
| Info | Cyan | `#22d3ee` |
| Disabled | Gray | `#4b5563` |

### Dark Mode Support

- **Background Layer 1** (Canvas): `#111111`
- **Background Layer 2** (Cards): `#1f1f1f`
- **Background Layer 3** (Panels): `#2a2a2a`
- **Border**: `#3a3a3a` (very subtle)
- **Shadows**: `rgba(0, 0, 0, 0.6)` (strong, to enhance depth)

---

## 3. Typography System

### Font Stack

```
Heading (H1–H3): Raleway 600/700 (sans-serif, warm, geometric)
  Fallback: Outfit, DM Sans, Inter
  
Body Text (16px+): Noto Sans JP 400/500 (accessible CJK support)
  Fallback: -apple-system, BlinkMacSystemFont, "Segoe UI"
  
Mono / Numbers: IBM Plex Mono or JetBrains Mono (tech-friendly)
  
Micro-labels: Raleway 500 10px uppercase, 0.24em letter-spacing
```

### Size Scale

| Role | Size | Weight | Line Height | Example |
|------|------|--------|-------------|---------|
| **H1** (Page title) | 40px | 700 | 1.2 | "What do you want to think about?" |
| **H2** (Section) | 24px | 600 | 1.3 | "AI Gauge" |
| **H3** (Subsection) | 18px | 600 | 1.35 | "My Thoughts" |
| **Body** (Standard) | 15px | 400 | 1.6 | Node labels, descriptions |
| **Small** (Secondary) | 13px | 400 | 1.5 | Help text, hints |
| **Micro** (Labels) | 10px | 500 | 1.2 | "THEME", "AI TURN" |

### Hierarchy

```
H1: 40/700 → H2: 24/600 → H3: 18/600 → Body: 15/400 → Small: 13/400 → Micro: 10/500
```

---

## 4. Component Design

### Buttons

**Primary Button** (CTA, affirmative)
- Background: `#a78bfa` (Purple)
- Text: `#1a1a1a` (Dark, for contrast)
- Padding: 16px 24px (vertical × horizontal)
- Border-radius: `12px` (softer, less "pill-y")
- Font: 15px, 600 weight
- Hover: `brightness(1.1)` + `translateY(-2px)` + shadow
- Active: `scale(0.98)`
- State: Disabled → `opacity-40`

**Secondary Button** (Alternative action)
- Background: `#2a2a2a` (Dark BG Alt)
- Border: 1px solid `#3a3a3a`
- Text: `#f5f5f5`
- Hover: `bg-[#3a3a3a]`

**Tertiary / Text Button**
- Background: Transparent
- Text: `#a78bfa` (Purple)
- Hover: Underline + `#f5f5f5`

**Icon Button** (Circle)
- Width/Height: 42px
- Border-radius: `50%` (full circle)
- Border: 1px solid `#3a3a3a`
- Background: `#2a2a2a` (on dark bg) or `#f5f5f5` (on light)
- Hover: Border → `#a78bfa` + `translateY(-2px)`

**Pill / Badge Button**
- Border-radius: `999px`
- Padding: 8px 16px
- Font-size: 13px
- States: Unselected (gray), Selected (purple/teal)

---

### Cards & Panels

**Card** (Soft container)
- Background: `#2a2a2a`
- Border-radius: `16px` (rounded, not harsh)
- Padding: 20px
- Box-shadow: `0 4px 16px rgba(0, 0, 0, 0.5)` (depth in dark bg)
- Border: None (or 1px `#3a3a3a` for subtle definition)

**Panel / Section Container**
- Background: `#1f1f1f` (slightly lighter than canvas)
- Border-radius: `20px`
- Padding: 24px
- Shadow: Stronger than card (`0 8px 32px rgba(0, 0, 0, 0.6)`)

**Mobile Sheet** (Bottom-sheet on mobile)
- Border-radius: `24px` (top corners only, mobile-native feel)
- Background: `#1f1f1f`
- Handle: Gray bar (h-1, w-10) at top for draggability cue

---

### Input Fields

**Text Input / Textarea**
- Background: `#2a2a2a`
- Border: 1px solid `#3a3a3a`
- Border-radius: `12px`
- Padding: 12px 16px
- Text: `#f5f5f5`
- Placeholder: `#a0a0a0`
- Focus: Ring `#a78bfa` (2px width, 0.25 opacity)
- Font: 15px, Noto Sans JP

---

### Badges & Labels

**Micro-Label** (Section header)
- Font: Raleway 10px 500, uppercase, `letter-spacing: 0.24em`
- Color: `#a0a0a0`
- Margin-bottom: 8px

**State Badge** (Turn indicator)
- Shape: Pill (border-radius: 999px)
- Padding: 6px 12px
- Font: 12px, Raleway 500
- User Turn: BG `#2a2a2a`, Border `#3a3a3a`, Text `#f5f5f5` + indicator dot `#fbbf24`
- AI Turn: BG `#2a2a2a`, Border `#3a3a3a`, Text `#22d3ee` + indicator dot `#22d3ee`

**Progress Badge** (AI Gauge)
- 5 dots, h-2.5 w-2.5 each
- Filled: `#a78bfa`
- Empty: `#3a3a3a`
- Gap between dots: 6px

---

## 5. Layout & Spacing

### Grid System

- **Base Unit**: 4px
- **Spacing Scale**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- **Common Gaps**: 
  - Between elements: 16px
  - Inside cards: 20px
  - Section separators: 24px

### Responsive Breakpoints

| Breakpoint | Width | Use Case |
|------------|-------|----------|
| **Mobile** | 320px–639px | phones |
| **Tablet** | 640px–1023px | landscape phones, small tablets |
| **Desktop** | 1024px+ | laptops, monitors |

### Layout Shifts

- **Mobile**: Full-width, stacked, bottom-sheet for panels
- **Tablet** (sm: 640px): Side-by-side, narrower sidebar
- **Desktop** (lg: 1024px): Standard sidebar + canvas layout

---

## 6. Motion & Animation

### Keyframes (Keep from v1, adapt colors)

```
floatUp: 0.5s ease-out (translateY -10px → 0, scale 0.985 → 1)
drawEdge: 0.9s ease-out (stroke animation on curves)
typing: 1.2s infinite (dot bounce for "thinking" indicator)
ringPulse: 1.6s infinite (pulsing ring on selected node)
adoptFlash: 0.9s ease-out (background fade for accepted suggestions)
```

### Hover & Interaction

- **Button Hover**: `translateY(-2px)` + `shadow` + color shift
- **Card Hover**: Subtle `scale(1.02)` + shadow enhancement
- **Input Focus**: Ring glow + text cursor
- **Stagger**: Child elements appear 60ms apart (for list items, etc.)

---

## 7. Components Redesign (70–80% Changes)

### Pages to Redesign

1. **Home Page** (`src/app/page.tsx`)
   - Logo: Circular badge, `60px`, border `#3a3a3a`
   - Heading: H1, Raleway 700 40px, center-aligned
   - CTA: Purple primary button, large (py-4, px-8)
   - Map List: Dark cards (`#2a2a2a`), with avatar badge (first: purple, others: teal)
   - Deletion UI: Hover reveal with warm-tinted background

2. **New Map Page** (`src/app/new/page.tsx`)
   - Back Button: Icon circle, `#2a2a2a`
   - Heading: H1, Raleway 700 40px
   - Input: Dark card styled input, focus ring purple
   - Examples: Pills with toggle state (selected: purple, unselected: dark)
   - CTA: Purple primary button

3. **Map Editor** (`src/app/map/[id]/page.tsx`)
   - Header (mobile): Dark BG, icon circle back button, theme name, toggle panel button
   - Sidebar (desktop): Narrower, dark BG, softer borders
   - Sheet (mobile): Rounded top, draggable handle

4. **Control Panel** (`src/components/mindmap/ControlPanel.tsx`) — **Largest Refactor**
   - Theme Display: Dark card, Micro-label, H2 in Raleway
   - Turn Badge: Pill with indicator dot (user: amber, AI: cyan)
   - AI Gauge: 5-dot progress, styled as micro-component
   - User Input Section: Card container, textarea (dark), buttons (primary + secondary)
   - Stall Detection: Dashed border container, contextual message + CTA
   - AI Suggestions: Each suggestion is dark card, with teal "+ Add" badge, hover effect
   - Buttons: Primary (purple), Secondary (dark), Tertiary (text)
   - Explanations / Errors: Dark cards with color-coded text (red for error, cyan for info)

5. **Custom Node** (`src/components/mindmap/CustomNode.tsx`)
   - Root: Purple BG (`#a78bfa`), white text, rounded `14px`
   - User: Dark card style (`#2a2a2a`), light text, subtle border
   - AI: Light purple-tinted BG (`#2a2a2a` base + purple tint), dashed border, purple text

---

## 8. Spacing & Sizing Reference

### Common Component Sizes

| Component | Width | Height | Padding |
|-----------|-------|--------|---------|
| Icon Button | 42px | 42px | — |
| Primary Button | 100% | 48px | — |
| Small Button | auto | 36px | 8px 16px |
| Card | 100% | auto | 20px |
| Input Field | 100% | 44px | 12px 16px |
| Micro-Label | auto | auto | — |

---

## 9. Dark Mode Considerations

- **Canvas**: `#111111` (darkest)
- **Cards/Panels**: `#1f1f1f` - `#2a2a2a` (layered depth)
- **Text**: `#f5f5f5` primary, `#a0a0a0` secondary
- **Accents**: Bright colors stay bright (purple, cyan, amber, teal) for contrast
- **Shadows**: Strong (0.6 opacity) to create depth against dark background

---

## 10. Accessibility Requirements

- **Contrast Ratios**: All text vs. background ≥ 4.5:1 (WCAG AA)
- **Font Sizes**: Minimum 13px for body text
- **Touch Targets**: Minimum 44px × 44px
- **Labels**: All interactive elements have descriptive labels (aria-label, etc.)
- **Color + Symbol**: Don't rely on color alone for state (use icons, borders, etc.)
- **Focus States**: Always visible, high-contrast

---

## 11. Next Steps (Implementation)

1. ✅ **Design Spec Approval** — Confirm color codes, font choices, component shapes
2. 📝 **Global CSS Refactor** — New color tokens, font stack, utility classes
3. 🎨 **Component Library** — Rebuild buttons, cards, inputs with new system
4. 🏠 **Page Redesigns** — Home, New Map, Map Editor shell
5. 🎛️ **Control Panel Rebuild** — Largest component, full visual overhaul
6. 📱 **Responsive Testing** — Mobile, tablet, desktop verification
7. 🧪 **QA & Polish** — Hover states, animations, edge cases
8. 🚀 **Production Deploy** — Gradual rollout or big-bang (TBD)

---

## Notes for Discussion

- **Font Choice**: Raleway is warm & geometric. Outfit is similar but slightly rounder. DM Sans is more "humanist." Preference?
- **Purple Shade**: `#a78bfa` (Amber-300 in Tailwind) is bright and friendly. Stronger options: `#9945ff`, `#7c3aed`?
- **Background Darkness**: `#1a1a1a` is very dark (pixel-perfect black 26/26/26). If too harsh, `#1f1f1f` or `#2a2a2a` might feel warmer?
- **Button Border-Radius**: `12px` proposed (rounded but not pill-like). Alternatives: `8px` (more geometric), `14px` (softer)?
- **Card Shadow**: Currently `0 4px 16px rgba(0, 0, 0, 0.5)`. Can increase to `0.6` or `0.7` for stronger depth?

---

**Awaiting your confirmation on the above before implementation begins.**
