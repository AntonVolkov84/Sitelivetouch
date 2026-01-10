import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { UserProvider } from "./context/UserContext";
import { UnreadProvider } from "./context/UnreadContext";
import { WSProvider } from "./context/WsContext";
import { ModalProvider } from "./context/ModalContext.tsx";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <GoogleReCaptchaProvider reCaptchaKey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}>
      <UserProvider>
        <ModalProvider>
          <UnreadProvider>
            <WSProvider>
              <App />
            </WSProvider>
          </UnreadProvider>
        </ModalProvider>
      </UserProvider>
    </GoogleReCaptchaProvider>
  </BrowserRouter>
);
