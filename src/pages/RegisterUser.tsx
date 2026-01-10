import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../axiosinstance";
import "./Login.css";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { getEncodedPublicKey } from "../utils/crypto";
import { logError } from "../utils/logger";
import { sanitizeInput, validateEmail } from "../utils/validation";
import { useModal } from "../context/ModalContext";

export default function RegisterUser() {
  const [formData, setFormData] = useState({
    username: "",
    usersurname: "",
    email: "",
    password: "",
  });

  const { executeRecaptcha } = useGoogleReCaptcha();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { showAlert } = useModal();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanEmail = sanitizeInput(formData.email.trim().toLowerCase());
    const cleanPassword = formData.password.trim();
    const cleanName = sanitizeInput(formData.username);
    const cleanSurname = sanitizeInput(formData.usersurname);
    if (!cleanEmail || !cleanPassword) {
      showAlert("Заполните поля", "Пожалуйста, заполните все поля");
      return;
    }
    if (!validateEmail(cleanEmail)) {
      showAlert("Неверный Email", "Введите корректный адрес электронной почты");
      return;
    }
    if (!executeRecaptcha) {
      showAlert("Защита", "Капча еще не загрузилась, подождите секунду");
      return;
    }
    setLoading(true);
    try {
      const token = await executeRecaptcha("register");
      const public_key = getEncodedPublicKey();
      const normalizedData = {
        public_key,
        email: cleanEmail,
        password: cleanPassword,
        username: cleanName,
        usersurname: cleanSurname,
        captchaToken: token,
        manufacturer: "browser",
      };
      await api.post("/auth/register", normalizedData);
      showAlert(
        "Регистрация успешна!",
        `Мы отправили письмо на почту ${normalizedData.email}. Пожалуйста, подтвердите её для активации аккаунта.`
      );
      navigate("/login");
    } catch (err: any) {
      logError("Ошибка регистрации", "WEB_RegisterUser", err);
      showAlert("Ошибка", err.response?.data?.message || "Не удалось создать аккаунт");
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
