// Ported from apps/web/src/styles/design-system.css's :root / [data-theme="dark"] custom
// properties — the whole palette is ~8 values per mode, so this one small file replaces
// what would otherwise be a full design-system dependency (NativeWind/Tamagui/RN Paper
// all bring their own visual language you'd spend time overriding to match this instead).
// Dark-mode switching (AsyncStorage-backed, mirroring apps/web/src/lib/theme/ThemeContext.tsx)
// is deferred to a later phase — `colors` is light-mode only for now, kept as a separate
// export from `lightColors`/`darkColors` so wiring a theme context in later doesn't require
// touching every screen that already imports `colors`.

export const lightColors = {
  paper: "#F7F6F1",
  ink: "#1C2331",
  tag: "#FFD500",
  deal: "#D62828",
  green: "#20713F",
  line: "#D9D6CC",
  surface: "#FFFFFF",
  muted: "#555b66",
  faint: "#8a8f99",
};

export const darkColors = {
  paper: "#14181f",
  ink: "#EDEBE3",
  tag: "#FFD500",
  deal: "#FF6B6B",
  green: "#3DDC84",
  line: "#2b313c",
  surface: "#1e232c",
  muted: "#9aa1ad",
  faint: "#6e7580",
};

export const colors = lightColors;

// Matches the web app's "Barlow Condensed" brand display font (see
// apps/web/src/styles/design-system.css's .ppp-disp), loaded via
// @expo-google-fonts/barlow-condensed and gated behind useFonts in App.tsx.
export const displayFont = {
  bold: "BarlowCondensed_700Bold",
  extraBold: "BarlowCondensed_800ExtraBold",
};
