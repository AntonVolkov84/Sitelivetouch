import { Link } from "react-router-dom";
import { useState, type ChangeEvent, type FormEvent } from "react";
import "./Login.css";
import { api } from "../../axiosinstance";
import { getEncodedPublicKey } from "../utils/crypto";
import { useNavigate } from "react-router-dom";
import { logError } from "../utils/logger";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  const handleForgotPassword = async () => {
    if (!formData.email) {
      alert("Введите email в поле выше, на него будет отправлено письмо для сброса пароля");
      return;
    }
    if (!formData.password) {
      alert("Введите в поле пароля ваш НОВЫЙ пароль. После подтверждения из письма он станет активным.");
      return;
    }
    const confirm = window.confirm(
      "На почту будет отправлено письмо. После клика по ссылке ваш новый пароль вступит в силу. Продолжить?"
    );
    if (confirm) {
      try {
        await api.post("/auth/forgot-password", {
          email: formData.email.toLowerCase().trim(),
          newPassword: formData.password,
        });
        alert("Письмо для подтверждения отправлено!");
        setFormData({ email: "", password: "" });
      } catch (err: any) {
        logError("Ошибка восстановления", "WEB Login_handleForgotPassword", err);
        alert(err.response?.data?.message || "Не удалось отправить письмо");
      }
    }
  };
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const pubKey = getEncodedPublicKey();
      const dataToSend = {
        ...formData,
        public_key: pubKey,
        expoToken: null,
      };
      const res = await api.post("/auth/login", dataToSend);
      const { accessToken, refreshToken, user } = res.data;
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify(user));
      navigate("/chat");
    } catch (err: any) {
      console.error("Ошибка входа", err);
      await logError("Ошибка при попытке входа", "Login page: handleSubmit_Login", err);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="login-card">
      <h2 className="login-card__title">Вход в LiveTouch</h2>

      <form className="login-card__form" onSubmit={handleSubmit}>
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
      </form>

      <div className="login-card__footer">
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
        <Link to="/register-seller" className="login-card__link">
          Регистрация для продавцов
        </Link>
      </div>
    </div>
  );
}
