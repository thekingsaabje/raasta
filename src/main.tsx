import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
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
