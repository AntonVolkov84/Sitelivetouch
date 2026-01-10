import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Chat } from "../types";
import { api } from "../../axiosinstance";
import { useWS } from "../context/WsContext";
import Message from "../components/Message";
import ProfileView from "../components/ProfileView";
import "./Chat.css";
import AddChatView from "../components/AddChatView";
import { useUser } from "../context/UserContext";
import { logError } from "../utils/logger";
import { useModal } from "../context/ModalContext";

export default function Chat() {
  const { user } = useUser();
  const [chats, setChats] = useState<Chat[]>([]);
  const [view, setView] = useState<"chats" | "profile" | "addChat">("chats");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const { showConfirm, showAlert } = useModal();

  const navigate = useNavigate();
  const { ws } = useWS() || {};

  const cleanInput = (text: string) => text.replace(/<\/?[^>]+(>|$)/g, "");

  const fetchData = async () => {
    try {
      const chatsRes = await api.get("/chats/getchats");
      setChats(chatsRes.data);
    } catch (err) {
      console.error("Data fetch error:", err);
      await logError("Ошибка при попытке входа", "WEB Chat: fetchData", err);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (["chat_created", "group_created", "add_participant"].includes(data.type)) {
          api.get("/chats/getchats").then((res) => setChats(res.data));
        }
        if (data.type === "chat_removed") {
          setChats((prev) => prev.filter((c) => c.chat_id !== data.chat_id));
          if (selectedChat?.chat_id === data.chat_id) setSelectedChat(null);
        }
      } catch (err: any) {
        console.error("WS error:", err);
        if (user) {
          await logError(user.email, "WEB Chat: handleMessage", err);
        }
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws, selectedChat]);

  const deleteChat = async (chatId: number) => {
    showConfirm(
      "Выход из чата",
      "Вы точно хотите покинуть этот чат?",
      async () => {
        try {
          await api.delete(`/chats/leave/${chatId}`);
          setChats((prev) => prev.filter((c) => c.chat_id !== chatId));
          if (selectedChat?.chat_id === chatId) setSelectedChat(null);
        } catch (err: any) {
          if (user) {
            await logError(user.email, "WEB Chat: deleteChat", err);
          }
          showAlert("Ошибка", "Не удалось удалить чат");
        }
      },
      "Покинуть"
    );
  };

  const filteredChats = chats.filter((chat) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (chat.type === "private" && chat.otherUser) {
      const u = chat.otherUser;
      return (
        u.username?.toLowerCase().includes(q) ||
        u.usersurname?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }
    return chat.name?.toLowerCase().includes(q);
  });

  if (loading) return <h2 className="loader">Загрузка...</h2>;

  return (
    <div className="chat-layout">
      <aside className="sidebar">
        {view === "profile" && <ProfileView onBack={() => setView("chats")} />}
        {view === "chats" && (
          <>
            <div className="sidebar-header">
              <div className="profile-circle" onClick={() => setView("profile")}>
                {user?.username?.[0]?.toUpperCase()}
              </div>
              <div className="search-wrapper">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Поиск..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(cleanInput(e.target.value))}
                />
                <span className="search-icon">🔍</span>
              </div>
            </div>

            <div className="chat-list">
              {filteredChats.map((item) => {
                const userInfo = item.type === "private" ? item.otherUser : null;
                return (
                  <div
                    key={item.chat_id}
                    className={`chat-item ${selectedChat?.chat_id === item.chat_id ? "active" : ""}`}
                    onClick={() => setSelectedChat(item)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      deleteChat(item.chat_id);
                    }}
                  >
                    <div className="avatar-container">
                      {userInfo?.avatar_url ? (
                        <img src={userInfo.avatar_url} className="avatar-img" alt="" />
                      ) : (
                        <div className="avatar-placeholder">
                          {(userInfo?.username?.[0] || item.name?.[0] || "G").toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="chat-info">
                      <div className="chat-name-row">
                        <span className="chat-name">
                          {userInfo ? `${userInfo.username} ${userInfo.usersurname}` : `Group: ${item.name}`}
                        </span>
                      </div>
                      <span className="chat-sub">{userInfo?.email || "Групповой чат"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="add-chat-fab" onClick={() => setView("addChat")}>
              +
            </button>
          </>
        )}
        {view === "addChat" && (
          <AddChatView
            onBack={() => setView("chats")}
            onSuccess={async (idFromApi) => {
              setView("chats");
              const finalId = String(idFromApi);
              try {
                const res = await api.get("/chats/getchats");
                const updatedChats = res.data;
                setChats(updatedChats);
                const found = updatedChats.find((c: Chat) => String(c.chat_id) === finalId);
                if (found) {
                  setSelectedChat(found);
                }
              } catch (err) {
                console.error("Error opening new chat:", err);
              }
            }}
          />
        )}
      </aside>
      <main className="main-content">
        {selectedChat ? (
          <div className="chat-active-window">
            <header className="chat-window-header">
              {selectedChat.type === "private"
                ? `${selectedChat.otherUser?.username} ${selectedChat.otherUser?.usersurname}`
                : selectedChat.name}
            </header>
            <div className="messages-container">{/* Здесь будет маппинг сообщений */}</div>
            <footer className="input-area">{/* Поле ввода */}</footer>
          </div>
        ) : (
          <div className="empty-chat">
            <h2>LiveTouch.chat</h2>
            <p>Выберите чат, чтобы начать общение</p>
          </div>
        )}
      </main>
    </div>
  );
}
