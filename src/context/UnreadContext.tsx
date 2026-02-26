import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../../axiosinstance";
import { useUser } from "./UserContext";
import { logError } from "../utils/logger";

type UnreadContextType = {
  unreadChats: Set<number>;
  addUnread: (chatId: number) => void;
  removeUnread: (chatId: number) => void;
  clearAll: () => void;
  refreshUnread: () => Promise<void>;
};

const UnreadContext = createContext<UnreadContextType | null>(null);

export const UnreadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unreadChats, setUnreadChats] = useState<Set<number>>(new Set());
  const { user } = useUser();

  useEffect(() => {
    const unreadCount = unreadChats.size;
    const baseTitle = "ЛайвТач";
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [unreadChats]);

  const loadUnread = useCallback(async () => {
    try {
      const res = await api.get("/chats/unread");
      const ids: number[] = res.data.unread || [];
      setUnreadChats(new Set(ids));
    } catch (err: any) {
      console.log("Ошибка загрузки unread:", err);
      logError("Ошибка получения непрочитанных сообщений", "WEB_UnreadContext: loadUnread", err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadUnread();
    } else {
      setUnreadChats(new Set());
    }
  }, [user, loadUnread]);

  const addUnread = (chatId: number) => {
    setUnreadChats((prev) => new Set(prev).add(chatId));
  };

  const removeUnread = (chatId: number) => {
    setUnreadChats((prev) => {
      const ns = new Set(prev);
      ns.delete(chatId);
      return ns;
    });
  };

  const clearAll = () => setUnreadChats(new Set());

  return (
    <UnreadContext.Provider
      value={{
        unreadChats,
        addUnread,
        removeUnread,
        clearAll,
        refreshUnread: loadUnread,
      }}
    >
      {children}
    </UnreadContext.Provider>
  );
};

export const useUnread = () => {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error("useUnread must be used inside <UnreadProvider>");
  return ctx;
};
