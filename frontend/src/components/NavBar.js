// src/components/NavBar.js
import React from "react";
import { AppBar, Toolbar, Box, Typography } from "@mui/material";

export default function NavBar() {
  return (
    <AppBar position="sticky" elevation={4} sx={{ bgcolor: "#0D6EFD" }}>
      <Toolbar sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: { xs: 1, sm: 2 } }}>
        {/* Left spacer helps keep title centered */}
        <Box sx={{ width: 120, display: { xs: "none", sm: "block" } }} />

        {/* Center title */}
        <Typography
          variant="h6"
          component="div"
          sx={{
            fontWeight: 700,
            letterSpacing: 0.2,
            fontSize: { xs: "1rem", sm: "1.15rem", md: "1.25rem" },
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <span style={{ fontSize: 18 }}>🚀</span>
          <span style={{ fontWeight: 800, marginLeft: 6 }}>3 Day Forecast</span>
        </Typography>

        {/* Right: logo */}
        <Box sx={{ width: 120, display: "flex", justifyContent: "flex-end" }}>
          <img
            src="/coralcomp-logo.png" // use public/coralcomp-logo.png (or adjust to /images/coralcomp-logo.png)
            alt="CoralComp"
            style={{ height: 36, objectFit: "contain", borderRadius: 6, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
