import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../axiosinstance";
import "./Login.css";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { getEncodedPublicKey } from "../utils/crypto";
import { logError } from "../utils/logger";

export default function RegisterUser() {
  const [formData, setFormData] = useState({
    username: "",
    usersurname: "", // Добавили фамилию как в мобайле
    email: "",
    password: "",
  });

  const { executeRecaptcha } = useGoogleReCaptcha();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Для глазика
  const navigate = useNavigate();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!executeRecaptcha) {
      alert("Капча еще не загрузилась, подождите секунду");
      return;
    }
    setLoading(true);
    try {
      const token = await executeRecaptcha("register");
      const public_key = getEncodedPublicKey();
      const normalizedData = {
        ...formData,
        public_key,
        email: formData.email.trim().toLowerCase(),
        captchaToken: token,
        manufacturer: "browser",
      };

      await api.post("/auth/register", normalizedData);
      alert(`Регистрация успешна! Проверьте почту ${normalizedData.email}`);
      navigate("/login");
    } catch (err: any) {
      logError("Ошибка регистрации", "WEB_RegisterUser", err);
      alert(err.response?.data?.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card">
      <h2 className="login-card__title">Регистрация</h2>
      <form className="login-card__form" onSubmit={handleSubmit}>
        <input name="username" className="login-card__input" placeholder="Имя" onChange={handleChange} required />
        <input
          name="usersurname"
          className="login-card__input"
          placeholder="Фамилия"
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          className="login-card__input"
          placeholder="Email"
          onChange={handleChange}
          required
        />

        {/* Пароль с глазиком как в логине */}
        <div className="password-wrapper" style={{ position: "relative", width: "100%" }}>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            className="login-card__input"
            placeholder="Пароль"
            onChange={handleChange}
            required
            style={{ width: "100%", boxSizing: "border-box" }}
          />
          <span
            onClick={() => setShowPassword(!showPassword)}
            style={{ position: "absolute", right: "10px", top: "10px", cursor: "pointer" }}
          >
            {showPassword ? "🙈" : "👁️"}
          </span>
        </div>

        <button type="submit" className="login-card__button" disabled={loading}>
          {loading ? "Регистрация..." : "Создать аккаунт"}
        </button>
      </form>
      <div className="login-card__footer">
        <Link to="/login" className="login-card__link">
          Уже есть аккаунт? Войти
        </Link>
      </div>
    </div>
  );
}
