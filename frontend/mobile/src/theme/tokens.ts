// Mirrors frontend/web/tailwind.config.ts — same palette and reasoning
// (signal metaphor, amber accent used sparingly). See frontend/web/docs/DESIGN.md.
export const colors = {
  dusk950: "#0D0E14",
  dusk900: "#12131C",
  dusk800: "#1B1D29",
  dusk700: "#262838",
  dusk600: "#383B52",
  parchment100: "#F5F2EA",
  parchment300: "#D9D5C9",
  parchment500: "#8B8FA3",
  signal400: "#F2B25C",
  signal500: "#EDA23F",
  moss500: "#5B9A7F",
  rust400: "#D9714E",
};

export const radii = { beacon: 10, pill: 999 };
export const spacing = (n: number) => n * 4;
