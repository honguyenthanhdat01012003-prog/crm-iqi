import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./styles/enterprise.css";
import { registerServiceWorker } from "./registerServiceWorker.js";

registerServiceWorker();

const rootEl = document.getElementById("root");
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

document.getElementById("boot-splash")?.remove();
