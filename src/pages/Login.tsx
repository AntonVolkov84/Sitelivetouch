// import { Link } from "react-router-dom";
import { useState } from "react";
import "./Login.css";
import { api } from "../../axiosinstance";
import { useNavigate } from "react-router-dom";
import { logError } from "../utils/logger";
// import { sanitizeInput, validateEmail } from "../utils/validation";
import { useUser } from "../context/UserContext";
import { useModal } from "../context/ModalContext";
import { QRCodeSVG } from "qrcode.react";
import { generateTempKeyPair } from "../utils/encryption";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

export default function Login() {
  // const [formData, setFormData] = useState({
  //   email: "",
  //   password: "",
  // });
  // const [showPassword, setShowPassword] = useState(false);
  // const [loading, setLoading] = useState(false);
  const { setUser } = useUser();
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrValue, setQrValue] = useState("");

  const handleQrStart = async () => {
    const tempKeys = generateTempKeyPair();
    try {
      const res = await api.post("/auth/qr-session", {
        publicKey: tempKeys.publicKeyB64,
      });
      const { sessionId, qrString } = res.data;
      setQrValue(qrString || `lt:qr:${sessionId}`);
      setShowQrModal(true);
      startPolling(sessionId, tempKeys.secretKey);
    } catch (err: any) {
      await logError("Ошибка при попытке создани QR кодя", "WEB Login page: handleQrStart", err);
      showAlert("Ошибка", "Не удалось инициировать QR-вход");
    }
  };
  const startPolling = (sessionId: string, secretKey: Uint8Array) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/auth/qr-check/${sessionId}`);
        if (res.data.status === "completed") {
          clearInterval(interval);
          const { encryptedData, nonce, senderPubKey } = res.data;
          const decrypted = nacl.box.open(
            naclUtil.decodeBase64(encryptedData),
            naclUtil.decodeBase64(nonce),
            naclUtil.decodeBase64(senderPubKey),
            secretKey,
          );
          if (decrypted) {
            const keys = JSON.parse(naclUtil.encodeUTF8(decrypted));
            localStorage.setItem("@e2ee_public_key", keys.publicKey);
            localStorage.setItem("@e2ee_private_key", keys.privateKey);
            localStorage.setItem("accessToken", res.data.accessToken);
            localStorage.setItem("refreshToken", res.data.refreshToken);
            setUser(res.data.user);
            setShowQrModal(false);
            navigate("/chat");
          }
        }
      } catch (err: any) {
        await logError("Ошибка при попытке получения ответа от мобилки", "WEB Login page: startPolling", err);
        console.error("Polling error", err);
        if (err.response?.status === 410) clearInterval(interval);
      }
    }, 3000);
  };

  // const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
  //   const { name, value } = e.target;
  //   setFormData((prev) => ({
  //     ...prev,
  //     [name]: value,
  //   }));
  // };
  // const handleForgotPassword = async () => {
  //   if (!formData.email) {
  //     showAlert("Внимание", "Введите email в поле выше, на него будет отправлено письмо для сброса пароля");
  //     return;
  //   }
  //   if (!formData.password) {
  //     showAlert(
  //       "Внимание",
  //       "Введите в поле пароля ваш НОВЫЙ пароль. После подтверждения из письма он станет активным."
  //     );
  //     return;
  //   }
  //   showConfirm(
  //     "Восстановление пароля",
  //     "На почту будет отправлено письмо. После клика по ссылке ваш новый пароль вступит в силу. Продолжить?",
  //     async () => {
  //       try {
  //         await api.post("/auth/forgot-password", {
  //           email: formData.email.toLowerCase().trim(),
  //           newPassword: formData.password,
  //         });
  //         showAlert("Успех", "Письмо для подтверждения отправлено!");
  //         setFormData({ email: "", password: "" });
  //       } catch (err: any) {
  //         await logError("Ошибка восстановления", "WEB Login_handleForgotPassword", err);
  //         showAlert("Ошибка", err.response?.data?.message || "Не удалось отправить письмо");
  //       }
  //     },
  //     "Продолжить"
  //   );
  // };
  // const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  //   e.preventDefault();
  //   const cleanEmail = sanitizeInput(formData.email.trim().toLowerCase());
  //   const cleanPassword = formData.password.trim();
  //   if (!cleanEmail || !cleanPassword) {
  //     showAlert("Заполните поля", "Пожалуйста, заполните все поля");
  //     return;
  //   }
  //   if (!validateEmail(cleanEmail)) {
  //     showAlert("Неверный формат", "Введите корректный адрес электронной почты");
  //     return;
  //   }
  //   setLoading(true);
  //   try {
  //     const newKeys = generateTempKeyPair();
  //     const dataToSend = {
  //       email: cleanEmail,
  //       password: cleanPassword,
  //       public_key: newKeys.publicKeyB64,
  //       expoToken: null,
  //     };
  //     const res = await api.post("/auth/login", dataToSend);
  //     localStorage.setItem("@e2ee_public_key", newKeys.publicKeyB64);
  //     localStorage.setItem("@e2ee_private_key", naclUtil.encodeBase64(newKeys.secretKey));
  //     localStorage.setItem("accessToken", res.data.accessToken);
  //     localStorage.setItem("refreshToken", res.data.refreshToken);
  //     setUser(res.data.user);
  //     navigate("/chat");
  //   } catch (err: any) {
  //     console.error("Ошибка входа", err);
  //     showAlert("Ошибка входа", err.response?.data?.message || "Неверный логин или пароль");
  //     await logError("Ошибка при попытке входа", "WEB Login page: handleSubmit_Login", err);
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  return (
    <div className="login-card">
      <h2 className="login-card__title">Вход в ЛТ</h2>
      <button type="button" className="login-card__qr-button" onClick={handleQrStart}>
        <span style={{ marginRight: "8px" }}>📱</span>
        Войти по QR-коду
      </button>
      <div className="login-card__divider">
        <div className="login-card__divider-info">
          <span>
            Для правильной работы сквозного шифрования необходима регистрация через мобильное устройство и его
            синхронизация с WEB приложением через QR код. Кнопка для сканирования кода находится в меню профиля!
          </span>
        </div>
      </div>
      {/* <form className="login-card__form" onSubmit={handleSubmit}>
        <input
          type="email"
          name="email"
          className="login-card__input"
          placeholder="Электронная почта"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <div className="password-wrapper" style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            className="login-card__input"
            placeholder="Пароль"
            value={formData.password}
            onChange={handleChange}
            required
            style={{ width: "100%", boxSizing: "border-box" }}
          />
          <span
            onClick={() => setShowPassword(!showPassword)}
            style={{ position: "absolute", right: "10px", top: "10px", cursor: "pointer", color: "#666" }}
          >
            {showPassword ? "🙈" : "👁️"}
          </span>
        </div>
        <button type="submit" className="login-card__button" disabled={loading}>
          {loading ? "Загрузка..." : "Войти"}
        </button>
      </form> */}

      {/* <div className="login-card__footer">
        <span
          onClick={handleForgotPassword}
          className="login-card__link"
          style={{ cursor: "pointer", display: "block", marginBottom: "15px", color: "#007bff" }}
        >
          Восстановить пароль?
        </span>
        <Link to="/register-user" className="login-card__link">
          Зарегистрироваться как пользователь
        </Link>
        
      </div> */}
      {showQrModal && (
        <div
          className="qr-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="qr-modal"
            style={{
              background: "white",
              padding: "30px",
              borderRadius: "20px",
              textAlign: "center",
              maxWidth: "320px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ marginBottom: "10px", color: "#333" }}>Сканируйте код</h3>
            <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "20px" }}>
              Откройте меню профиля в приложении ЛТ и выберите «Подключить компьютер»
            </p>

            <div style={{ background: "white", padding: "10px", borderRadius: "10px" }}>
              {qrValue && <QRCodeSVG value={qrValue} size={256} />}
            </div>
            <button
              onClick={() => setShowQrModal(false)}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                border: "none",
                background: "#eee",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
