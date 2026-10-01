import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AppRouter from "./routes/AppRouter";
import "./styles/styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRouter App={App} />
    </BrowserRouter>
  </React.StrictMode>,
);
