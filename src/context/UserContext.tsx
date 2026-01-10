import React, { createContext, useContext, useState, useEffect } from "react";
import { type UserAuthData } from "../types";
import { api } from "../../axiosinstance";
import { logError } from "../utils/logger";
interface UserContextValue {
  user: UserAuthData | null;
  setUser: (u: UserAuthData | null) => void;
  loading: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  setUser: () => {},
  loading: true,
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserAuthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get("/auth/me");
        setUser(res.data);
      } catch (err: any) {
        console.error("Auth init error:", err);
        logError("Ошибка получения юзера", "WEB_UserContext: initAuth", err);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const handleSetUser = (u: UserAuthData | null) => {
    setUser(u);
    if (!u) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
  };

  return <UserContext.Provider value={{ user, setUser: handleSetUser, loading }}>{children}</UserContext.Provider>;
};

export const useUser = () => useContext(UserContext);
