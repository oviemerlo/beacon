# Design tokens

**Signal metaphor.** Beacon's whole mechanic is a signal reaching a radius —
the visual identity should feel like something being sent out into the dark,
not like a generic social app. Dusk-navy base (not the common cream/terracotta
AI-default) with one warm amber "signal" accent used sparingly: broadcast
distance markers, active tab state, the ping motif — never spread across
every button, so it stays meaningful when it appears.

## Palette
- `dusk-950` `#0D0E14` — page background
- `dusk-900` `#12131C` — card surfaces
- `dusk-700` `#262838` — borders, dividers
- `parchment-100` `#F5F2EA` — primary text
- `parchment-500` `#8B8FA3` — secondary text
- `signal-500` `#EDA23F` — the one accent: active states, distance/tag chips, CTAs
- `moss-500` `#5B9A7F` — success/positive (used sparingly, e.g. "message sent")
- `rust-400` `#D9714E` — errors only

## Type
- **Display** — Space Grotesk (headings): geometric, slightly technical, fits a
  "signal/broadcast" product without leaning sci-fi.
- **Body** — Inter: gets out of the way for actual reading (broadcast content,
  messages).
- **Mono** — IBM Plex Mono: reserved for anything measurement-like — distances,
  timestamps, tag counts — reinforcing that these are *data*, not prose.

## Signature element
`components/SignalPing.tsx` — a radiating ping. Used only where something is
actively broadcasting or being sent (new-broadcast marker, message-sending
state), not decoratively, so it keeps meaning rather than becoming wallpaper.

## Still templated on purpose
This is a barebone scaffold — layouts are intentionally plain (single-column,
card-based) so the interaction logic is easy to read and extend. Once real
screens are being finished for launch, revisit spacing/hierarchy with more
care per `/mnt/skills/public/frontend-design` before shipping.
