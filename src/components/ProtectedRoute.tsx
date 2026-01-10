import { Navigate, Outlet } from "react-router-dom";
import { useUser } from "../context/UserContext";

export const ProtectedRoute = () => {
  const { user, loading } = useUser();
  if (loading) return <div style={{ display: "flex", alignItems: "center" }}>Загрузка...</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};
