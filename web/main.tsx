import React from "react"
import ReactDOM from "react-dom/client"
import { I18nextProvider } from "react-i18next"

import App from "./App"
import webI18n from "./i18n"

import "./styles.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={webI18n}>
      <App />
    </I18nextProvider>
  </React.StrictMode>,
)
