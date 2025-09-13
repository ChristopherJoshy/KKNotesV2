import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize React application with error handling
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);

// Render application
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
