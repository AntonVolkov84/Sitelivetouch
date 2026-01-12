import { Routes, Route, Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useUser } from "./context/UserContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import RegisterUser from "./pages/RegisterUser";
import RegisterSeller from "./pages/RegisterSeller";
import Chat from "./pages/Chat";
import { ProtectedRoute } from "./components/ProtectedRoute";
import CallPage from "./pages/CallPage";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, loading } = useUser();

  const isChatPage = location.pathname === "/chat";

  const handleLogout = () => {
    setUser(null);
    navigate("/login");
  };
  if (loading) return <div>Загрузка приложения...</div>;
  return (
    <>
      <nav
        style={{
          padding: "0.8rem 2rem",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "20px",
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
          {user ? (
            <button onClick={handleLogout} style={logoutButtonStyle}>
              Выйти ({user.username})
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
          alignItems: isChatPage ? "flex-start" : "center",
          paddingTop: isChatPage ? "0" : "40px",
          height: isChatPage ? "100vh" : "auto",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: isChatPage ? "100%" : "600px",
            height: isChatPage ? "100%" : "auto",
          }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={user ? <Navigate to="/chat" /> : <Login />} />
            <Route path="/register-user" element={<RegisterUser />} />
            <Route path="/register-seller" element={<RegisterSeller />} />
            <Route path="/call/:chatId" element={<CallPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/chat" element={<Chat />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" />} />
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
  color: "#ff4d4d",
  border: "none",
  background: "none",
  cursor: "pointer",
  padding: 0,
  font: "inherit",
};

export default App;
