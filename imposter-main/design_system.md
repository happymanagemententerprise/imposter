# Design System (`design_system.md`)

## Color Palette
| Role | Name | Hex |
|---|---|---|
| Primary Background | Deep Space Navy | `#0B1120` |
| Card/Container Surface | Slate Dark | `#1E293B` |
| Accent / Interactive | Vibrant Teal | `#14B8A6` |
| Hover State | Deep Teal | `#0D9488` |
| Text | Clean White | `#FFFFFF` |
| Muted Text | Slate Gray | `#94A3B8` |

```css
:root {
  --bg: #0B1120;
  --surface: #1E293B;
  --accent: #14B8A6;
  --accent-hover: #0D9488;
  --text: #FFFFFF;
  --text-muted: #94A3B8;
}
```

## Typography
- **Font Family:** `Inter`, `system-ui`, `-apple-system`, sans-serif
- **Headings:** Bold weights, high contrast, scaled up for TV visibility.
- **Body & Inputs:** Legible medium weight, optimized for quick mobile interaction.

## UI Components
- **Buttons:** Full-width rounded rectangles on mobile, prominent touch targets (minimum height 48px).
- **Inputs:** Clean text fields with subtle focus rings in Vibrant Teal.
- **TV Grid:** Scalable card grid designed to evenly distribute player clues dynamically as they are submitted.
