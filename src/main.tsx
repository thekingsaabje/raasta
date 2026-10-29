import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
// Self-hosted, open-licence fonts (OFL): no third-party font requests.
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/figtree";
import "./styles.css";
import { App } from "./App";
import { RouterProvider } from "./lib/router";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/ui";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <RouterProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </RouterProvider>
    </MotionConfig>
  </StrictMode>,
);
