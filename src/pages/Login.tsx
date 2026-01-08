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
  const navigate = useNavigate();
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
        <input
          type="password"
          name="password"
          className="login-card__input"
          placeholder="Пароль"
          value={formData.password}
          onChange={handleChange}
          required
        />
        <button type="submit" className="login-card__button">
          Войти
        </button>
      </form>

      <div className="login-card__footer">
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
