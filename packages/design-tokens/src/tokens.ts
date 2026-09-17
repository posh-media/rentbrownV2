/**
 * RentBrown V2 — Warm Institutional Fintech tokens (docs/DESIGN_DIRECTION.md).
 * Layer 1 primitives + Layer 2 semantic maps. Light ships at launch; the dark
 * map is pre-defined for later (RB-098). Components consume semantic tokens
 * only — never primitives directly.
 */

export const tokens = {
  primitives: {
    brand: {
      "900": "#3E2A23",
      "800": "#4A332B",
      "700": "#5D4037",
      "600": "#70524A",
      "500": "#8D6E63",
      "400": "#A98B7E",
      "300": "#C4A99B",
      "200": "#DCC8BD",
      "100": "#EFE4DC",
      "50": "#F7F1EA",
    },
    neutral: {
      canvas: "#FFFDF8",
      surface: "#FFFFFF",
      subtle: "#F7F1EA",
      border: "#E8DDD4",
      textPrimary: "#2D2624",
      textSecondary: "#6B5D55",
      textTertiary: "#9A8A7F",
      textInverse: "#FFFDF8",
    },
    success: { "700": "#2E7D32", "600": "#388E3C", "100": "#E3F1E4" },
    warning: { "700": "#B26A00", "100": "#FBEEDB" },
    error: { "700": "#B3261E", "100": "#F9E3E1" },
    gold: { "600": "#C9A227", "100": "#F7EFD4" },
    dark: {
      canvas: "#1A1411",
      surface: "#241C18",
      subtle: "#2E241F",
      border: "#3E322C",
      textPrimary: "#F5EDE6",
      textSecondary: "#C4B3A7",
      textTertiary: "#8A7A6E",
    },
  },
  themes: {
    light: {
      bg: {
        canvas: "neutral.canvas",
        surface: "neutral.surface",
        subtle: "neutral.subtle",
      },
      text: {
        primary: "neutral.textPrimary",
        secondary: "neutral.textSecondary",
        tertiary: "neutral.textTertiary",
        inverse: "neutral.textInverse",
      },
      border: { default: "neutral.border" },
      action: {
        primary: "brand.700",
        primaryHover: "brand.800",
        primaryText: "neutral.textInverse",
        secondary: "brand.100",
        secondaryText: "brand.700",
      },
      status: {
        success: { fg: "success.700", bg: "success.100" },
        warning: { fg: "warning.700", bg: "warning.100" },
        error: { fg: "error.700", bg: "error.100" },
        info: { fg: "brand.700", bg: "brand.100" },
        pending: { fg: "brand.500", bg: "brand.50" },
      },
      accent: { gold: "gold.600", goldBg: "gold.100" },
    },
    dark: {
      bg: { canvas: "dark.canvas", surface: "dark.surface", subtle: "dark.subtle" },
      text: {
        primary: "dark.textPrimary",
        secondary: "dark.textSecondary",
        tertiary: "dark.textTertiary",
        inverse: "neutral.textPrimary",
      },
      border: { default: "dark.border" },
      action: {
        primary: "brand.300",
        primaryHover: "brand.200",
        primaryText: "brand.900",
        secondary: "brand.800",
        secondaryText: "brand.100",
      },
      status: {
        success: { fg: "success.600", bg: "dark.subtle" },
        warning: { fg: "warning.700", bg: "dark.subtle" },
        error: { fg: "error.700", bg: "dark.subtle" },
        info: { fg: "brand.300", bg: "dark.subtle" },
        pending: { fg: "brand.300", bg: "dark.subtle" },
      },
      accent: { gold: "gold.600", goldBg: "dark.subtle" },
    },
  },
  typography: {
    fontFamily: {
      ui: "Plus Jakarta Sans",
      marketingDisplay: "Fraunces",
      mono: "ui-monospace",
    },
    scale: {
      display: { size: 32, lineHeight: 40, weight: 700 },
      h1: { size: 26, lineHeight: 34, weight: 700 },
      h2: { size: 22, lineHeight: 30, weight: 600 },
      h3: { size: 18, lineHeight: 26, weight: 600 },
      body: { size: 16, lineHeight: 24, weight: 400 },
      bodySm: { size: 14, lineHeight: 21, weight: 400 },
      caption: { size: 12, lineHeight: 17, weight: 500 },
      figureLg: { size: 34, lineHeight: 40, weight: 700, variant: "tabular-nums" },
      figureMd: { size: 22, lineHeight: 28, weight: 700, variant: "tabular-nums" },
    },
  },
  spacing: {
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "5": 20,
    "6": 24,
    "8": 32,
    "10": 40,
    "12": 48,
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 },
  elevation: {
    none: "none",
    sheet: "0 8px 24px rgba(62,42,35,0.12)",
    modal: "0 16px 48px rgba(62,42,35,0.16)",
  },
  breakpoints: { sm: 480, md: 768, lg: 1024, xl: 1280 },
} as const;

export type Tokens = typeof tokens;
