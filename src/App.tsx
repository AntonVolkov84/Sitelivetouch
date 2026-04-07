import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useUser } from "./context/UserContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import RegisterUser from "./pages/RegisterUser";
import RegisterSeller from "./pages/RegisterSeller";
import Chat from "./pages/Chat";
import { ProtectedRoute } from "./components/ProtectedRoute";
import CallPage from "./pages/CallPage";
import LogoNew from "./assets/newiconbdsite.png";
import NotFound from "./pages/NotFound";
import NearbyShopsList from "./components/NearbyShopsList";

const APK_URL = "https://livetouch.chat/downloads/app-release.apk";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, loading } = useUser();
  const getNavLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    ...navLinkStyle,
    color: isActive ? "#b71c1c" : "#555",
    backgroundColor: isActive ? "rgba(183, 28, 28, 0.08)" : "transparent",
    padding: "6px 12px",
    borderRadius: "8px",
    transition: "all 0.2s ease",
  });
  const isFullWidthPage =
    location.pathname === "/chat" ||
    location.pathname === "/nearby" ||
    (location.pathname === "/register-seller" && user?.role === "seller");

  const handleLogout = () => {
    setUser(null);
    navigate("/login");
  };
  if (loading) return <div>Загрузка приложения...</div>;
  return (
    <>
      <div
        style={{
          width: "100%",
          padding: "5px 0",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "10px",
          backgroundColor: "#f9f9f9",
          borderBottom: "1px solid #eee",
        }}
      >
        <img
          src={LogoNew}
          alt="ЛТ логотип"
          style={{
            height: "32px",
            width: "auto",
            display: "block",
          }}
        />
        <span
          style={{
            fontSize: "22px",
            fontWeight: "800",
            letterSpacing: "0.5px",
            color: "#333",
          }}
        >
          ЛТ
        </span>
      </div>
      <nav
        style={{
          padding: "0.1rem 2rem",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          gap: "20px",
          backgroundColor: "white",
        }}
      >
        <a
          href={APK_URL}
          download="LT_App.apk"
          style={{
            ...navLinkStyle,
            color: "#10545F",
            fontWeight: "800",
            border: "1px solid #10545F",
            padding: "4px 10px",
            borderRadius: "20px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <span style={{ fontSize: "16px" }}>📱</span> Скачать для Android
        </a>
        <NavLink to="/nearby" style={getNavLinkStyle}>
          Рядом
        </NavLink>
        <NavLink to="/" style={getNavLinkStyle}>
          Домашняя
        </NavLink>
        <NavLink to="/chat" style={getNavLinkStyle}>
          Чат
        </NavLink>
        {user && (
          <NavLink to="/register-seller" style={getNavLinkStyle}>
            Продавцам
          </NavLink>
        )}

        <div style={{ display: "flex", alignItems: "center" }}>
          {user ? (
            <button onClick={handleLogout} style={logoutButtonStyle}>
              Выйти ({user.username})
            </button>
          ) : (
            <NavLink to="/login" style={getNavLinkStyle}>
              Войти
            </NavLink>
          )}
        </div>
      </nav>

      <main
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: isFullWidthPage ? "flex-start" : "center",
          paddingTop: isFullWidthPage ? "0" : "5px",
          height: isFullWidthPage ? "100vh" : "auto",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: isFullWidthPage ? "100%" : "600px",
            height: isFullWidthPage ? "100%" : "auto",
          }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/nearby" element={<NearbyShopsList />} />
            <Route path="/login" element={user ? <Navigate to="/chat" /> : <Login />} />
            <Route path="/register-user" element={<RegisterUser />} />
            <Route path="/register-seller" element={<RegisterSeller />} />
            <Route path="/call/:chatId" element={<CallPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/chat" element={<Chat />} />
            </Route>

            <Route path="*" element={<NotFound />} />
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
};

const logoutButtonStyle = {
  ...navLinkStyle,
  border: "none",
  background: "none",
  cursor: "pointer",
  padding: 0,
  font: "inherit",
};

export default App;
