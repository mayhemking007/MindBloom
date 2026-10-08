import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "../../web/src/auth/AuthContext";
import { initializeTheme, ThemeProvider } from "../../web/src/theme/ThemeContext";
import "../../web/src/styles.css";
import { NotionBloomApp } from "./NotionBloomApp";

initializeTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotionBloomApp />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
