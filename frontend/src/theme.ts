import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#1B3A4B", contrastText: "#F7F4EE" },
    secondary: { main: "#B8612E" },
    background: { default: "#EFEBE3", paper: "#FFFCF8" },
    text: { primary: "#1C1915", secondary: "#5C564C" },
    divider: "#E3DCD0",
    success: { main: "#2F6B4F" },
    warning: { main: "#A16207" },
    error: { main: "#9F2D2D" },
    info: { main: "#1D4E89" },
  },
  typography: {
    fontFamily: '"Outfit", "Segoe UI", sans-serif',
    h3: { fontWeight: 600, letterSpacing: "-0.03em" },
    h4: { fontWeight: 600, letterSpacing: "-0.03em" },
    h5: { fontWeight: 600, letterSpacing: "-0.02em" },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, boxShadow: "none" },
        contained: { boxShadow: "none" },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none", border: "1px solid #E4DDD0" },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small", fullWidth: true },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
  },
});
