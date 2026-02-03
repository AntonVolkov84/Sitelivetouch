import React, { createContext, useContext, useState, useEffect } from "react";
import { type UserAuthData } from "../types";
import { api } from "../../axiosinstance";
import { logError } from "../utils/logger";
import axios from "axios";
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
      let token = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      if (!token && refreshToken) {
        try {
          console.log("Аксесс-токена нет, пробуем рефреш...");
          const res = await axios.post("https://api.livetouch.chat/auth/refresh", {
            token: refreshToken,
          });
          token = res.data.accessToken;
          if (token) localStorage.setItem("accessToken", token);
        } catch (e) {
          console.error("Первичный рефреш не удался");
          localStorage.clear();
          setLoading(false);
          return;
        }
      }
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get("/auth/me");
        setUser(res.data);
      } catch (err: any) {
        console.error("Auth init error:", err);
        console.log("DEBUG: Catch triggered with", err.response?.status);
        if (err.response?.status === 401 || err.response?.status === 403) {
          logError("Сессия истекла", "WEB_UserContext: initAuth", err);
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setUser(null);
        } else {
          logError("Ошибка сети при загрузке юзера", "WEB_UserContext: initAuth", err);
        }
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
