import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../axiosinstance";
import "./Login.css";

export default function RegisterUser() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Стучимся в твой authRoutes.js -> /auth/register
      await api.post("/auth/register", formData);
      alert("Регистрация успешна! Проверьте почту для подтверждения.");
      navigate("/login");
    } catch (err: any) {
      alert(err.response?.data?.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card">
      <h2 className="login-card__title">Регистрация</h2>
      <form className="login-card__form" onSubmit={handleSubmit}>
        <input
          name="username"
          className="login-card__input"
          placeholder="Имя пользователя"
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
        <input
          type="password"
          name="password"
          className="login-card__input"
          placeholder="Пароль"
          onChange={handleChange}
          required
        />
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
