import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import RegisterUser from "./pages/RegisterUser";
import RegisterSeller from "./pages/RegisterSeller";
import Chat from "./pages/Chat";

function App() {
  const navigate = useNavigate();
  const location = useLocation(); // Следим за сменой страниц
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem("accessToken"));

  // Синхронизируем состояние авторизации при переходах
  useEffect(() => {
    setIsAuth(!!localStorage.getItem("accessToken"));
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setIsAuth(false);
    console.log("Пользователь разлогинен");
    navigate("/login");
  };

  return (
    <>
      <nav
        style={{
          padding: "0.8rem 2rem",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "20px", // Равномерный отступ между всеми элементами
          backgroundColor: "white",
        }}
      >
        <Link to="/" style={navLinkStyle}>
          Home
        </Link>
        <Link to="/chat" style={navLinkStyle}>
          Чат
        </Link>

        <div style={{ display: "flex", alignItems: "center" }}>
          {isAuth ? (
            <button
              onClick={handleLogout}
              style={{
                ...navLinkStyle,
                color: "#ff4d4d", // Красный текст для выхода
                border: "none",
                background: "none",
                cursor: "pointer",
                padding: 0,
                font: "inherit", // Чтобы шрифт был как у ссылок
              }}
            >
              Выйти
            </button>
          ) : (
            <Link to="/login" style={navLinkStyle}>
              Войти
            </Link>
          )}
        </div>
      </nav>

      <main
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "40px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "600px" }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register-user" element={<RegisterUser />} />
            <Route path="/register-seller" element={<RegisterSeller />} />
            <Route path="/chat" element={<Chat />} />
          </Routes>
        </div>
      </main>
    </>
  );
}
const navLinkStyle = {
  textDecoration: "none",
  color: "#333",
  fontWeight: 500,
  fontSize: "14px",
  transition: "color 0.2s",
};
export default App;
