import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Chat, type DecryptedMessage } from "../types";
import { api } from "../../axiosinstance";
import { useWS } from "../context/WsContext";
import { useModal } from "../context/ModalContext";
import Message from "../components/Message";
import ProfileView from "../components/ProfileView";
import "./Chat.css";
import AddChatView from "../components/AddChatView";
import { useUser } from "../context/UserContext";
import { logError } from "../utils/logger";
import { useUnread } from "../context/UnreadContext";
import { getStoredKeyPair, decryptMessage, encryptMessage } from "../utils/encryption";
import { decodeBase64 } from "tweetnacl-util";

export default function Chat() {
  const { user } = useUser();
  const [chats, setChats] = useState<Chat[]>([]);
  const [view, setView] = useState<"chats" | "profile" | "addChat">("chats");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const { showConfirm, showAlert } = useModal();
  const { unreadChats, removeUnread } = useUnread();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<DecryptedMessage | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msg: DecryptedMessage } | null>(null);
  const [viewedProfileId, setViewedProfileId] = useState<number | null>(null);
  const navigate = useNavigate();
  const { ws } = useWS() || {};
  const cleanInput = (text: string) => text.replace(/<\/?[^>]+(>|$)/g, "");

  const markAsRead = async () => {
    if (!selectedChat?.chat_id) return;
    removeUnread(selectedChat.chat_id);
    try {
      await api.delete(`/chats/unread/${selectedChat.chat_id}`);
    } catch (err: any) {
      if (user) {
        logError(user.email, "Web Chat: markAsRead", err.response?.data || err.message);
      }
      console.log("markAsRead error", err);
    }
  };
  useEffect(() => {
    if (selectedChat?.chat_id) {
      markAsRead();
    }
    return () => {
      if (selectedChat?.chat_id) {
        markAsRead();
      }
    };
  }, [selectedChat?.chat_id]);
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);
  const handleContextMenu = (e: React.MouseEvent, msg: DecryptedMessage) => {
    e.preventDefault();
    if (Number(msg.sender_id) !== Number(user?.id)) return;
    const menuWidth = 150;
    const menuHeight = 100;
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuWidth > window.innerWidth) {
      x -= menuWidth;
    }
    if (y + menuHeight > window.innerHeight) {
      y -= menuHeight;
    }
    setContextMenu({ x, y, msg });
  };
  const addParticipant = async (email: string) => {
    if (!selectedChat) return;
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) return alert("Введите email");
      const { chat_id, name: groupName, type: chat_type, created_at } = selectedChat;
      await api.post(`/chats/addparticipant`, {
        email: cleanEmail,
        chat_id,
        groupName,
        created_at,
        chat_type,
      });
      showAlert("Успех", `Пользователь ${cleanEmail} добавлен`);
    } catch (err: any) {
      alert("Не удалось добавить пользователя");
    }
  };
  const getParticipantPublicKey = async (
    chat_id: number,
    participant_id: number | undefined
  ): Promise<string | null> => {
    if (!participant_id) return null;
    try {
      const res = await api.get(`/chats/${chat_id}/participants`);
      const participant = res.data.find((p: any) => Number(p.id) === Number(participant_id));
      return participant?.public_key || null;
    } catch (err) {
      console.error("getParticipantPublicKey error:", err);
      return null;
    }
  };
  const handleUpdateMessage = async () => {
    try {
      if (!selectedChat || !editMode || !selectedMessage) return;
      if (!inputText.trim()) return alert("Пустой текст");
      const keyPair = getStoredKeyPair();
      if (!keyPair) {
        return showAlert("Ошибка", "Ключи шифрования не найдены");
      }
      const { privateKey } = keyPair;
      const { chat_id, type: chat_type } = selectedChat;
      // ==== PRIVATE CHAT ====
      let rawKey: string | null | undefined = selectedChat.otherUser?.public_key;
      if (!rawKey) {
        const otherUserId = selectedChat.otherUser?.id;
        if (otherUserId) {
          rawKey = await getParticipantPublicKey(chat_id, otherUserId);
        }
      }
      if (!rawKey) return showAlert("Ошибка", "Не удалось получить ключ");
      if (chat_type === "private" && selectedChat) {
        const theirPublicKeyUint8 = decodeBase64(rawKey);
        const { ciphertext, nonce } = encryptMessage(inputText, theirPublicKeyUint8, privateKey);
        await api.put(`/chats/message/${selectedMessage.id}`, {
          ciphertext,
          nonce,
        });
      }
      // ==== GROUP CHAT ====
      else if (chat_type === "group") {
        const { data: participants } = await api.get(`/chats/${chat_id}/participants`);
        const encryptedPerUser = participants.map((u: any) => {
          const userPub = decodeBase64(u.public_key);
          const { ciphertext, nonce } = encryptMessage(inputText, userPub, privateKey);
          return { recipient_id: u.id, ciphertext, nonce };
        });
        await api.put(`/chats/message/${selectedMessage.id}`, {
          messages: encryptedPerUser,
        });
      }
      setInputText("");
      setEditMode(false);
      setSelectedMessage(null);
    } catch (err: any) {
      console.error("handleUpdateMessage error:", err);
    }
  };
  const handleDelete = async (id: number | string) => {
    showConfirm(
      "Удаление",
      "Удалить сообщение?",
      async () => {
        try {
          await api.delete(`/chats/message/${id}`);
          setSelectedMessage(null);
        } catch (err: any) {
          console.error("Delete error:", err);
          alert("Не удалось удалить сообщение.");
        }
      },
      "Продолжить"
    );
  };
  useEffect(() => {
    const container = document.querySelector(".messages-container");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    if (!selectedChat || !user) return;

    try {
      const keyPair = getStoredKeyPair();
      if (!keyPair) {
        console.error("Ключи не найдены");
        return;
      }
      const { data } = await api.get(`/chats/${selectedChat.chat_id}`);

      const rawMessages = data as any[];
      let decrypted: any[] = [];
      // ==== ПРИВАТНЫЙ ЧАТ ====
      if (selectedChat.type === "private" && selectedChat.otherUser) {
        const companionPubKey = selectedChat.otherUser.public_key;
        if (!companionPubKey) {
          console.error("Публичный ключ собеседника не найден в selectedChat");
        }

        decrypted = rawMessages.map((msg) => {
          if (!msg.ciphertext || !msg.nonce) return msg;
          try {
            let pubKeyString: string;
            if (Number(msg.sender_id) === Number(user.id)) {
              pubKeyString = companionPubKey;
            } else {
              pubKeyString = msg.sender_public_key || companionPubKey;
            }

            if (!pubKeyString) throw new Error("Нет ключа для декодирования");

            const text = decryptMessage(msg.ciphertext, msg.nonce, keyPair.privateKey, decodeBase64(pubKeyString));
            return { ...msg, text };
          } catch (err) {
            console.error(`Ошибка расшифровки сообщения ${msg.id}:`, err);
            return { ...msg, text: "[Ошибка расшифровки]" };
          }
        });
      }

      // ==== ГРУППОВОЙ ЧАТ ====
      else if (selectedChat.type === "group") {
        decrypted = rawMessages.map((m) => {
          let target = m;
          if (Array.isArray(m.messages)) {
            target = m.messages.find((sub: any) => Number(sub.user_id) === Number(user.id));
          }

          if (!target || !target.ciphertext) return { ...m, text: "[Сообщение недоступно]" };

          try {
            const senderPub = target.sender_public_key;
            if (!senderPub) return { ...target, text: "[Ключ отправителя не найден]" };
            const text = decryptMessage(target.ciphertext, target.nonce, keyPair.privateKey, decodeBase64(senderPub));
            return { ...target, text };
          } catch (err) {
            return { ...target, text: "[Ошибка]" };
          }
        });
      }
      setMessages(decrypted.filter((m) => m !== null));
    } catch (err) {
      console.error("Load messages error:", err);
    }
  };

  useEffect(() => {
    setMessages([]);
    if (selectedChat) loadMessages();
  }, [selectedChat]);

  const handleSendWeb = async (msg?: string) => {
    try {
      const textToSend = msg ?? inputText;
      if (!textToSend.trim()) return;
      if (/[<>]/.test(textToSend)) {
        console.error("Недопустимые символы");
        return;
      }
      if (editMode && selectedMessage) {
        if (Number(selectedMessage.sender_id) === Number(user?.id)) {
          await handleUpdateMessage();
          return;
        } else {
          setEditMode(false);
          setSelectedMessage(null);
          return;
        }
      }

      if (!selectedChat) return;
      const { chat_id, type: chat_type } = selectedChat;
      const keyPair = getStoredKeyPair();
      if (!keyPair) return showAlert("Ошибка", "Ключи не найдены");
      const { privateKey } = keyPair;

      // ==== ПРИВАТНЫЙ ЧАТ ====
      if (chat_type === "private") {
        let rawKey: string | null | undefined;
        rawKey = selectedChat.otherUser?.public_key;
        if (!rawKey) {
          const otherUserId = selectedChat.otherUser?.id;
          if (otherUserId) {
            rawKey = await getParticipantPublicKey(chat_id, otherUserId);
          }
        }

        if (!rawKey) return showAlert("Ошибка", "Не удалось получить ключ собеседника");
        const theirPublicKeyUint8 = decodeBase64(rawKey);
        const { ciphertext, nonce } = encryptMessage(textToSend, theirPublicKeyUint8, privateKey);
        await api.post("/chats/send", {
          chat_id,
          ciphertext,
          nonce,
        });

        setInputText("");
        return;
      }

      // ==== ГРУППОВОЙ ЧАТ ====
      if (chat_type === "group") {
        const participantsRes = await api.get(`/chats/${chat_id}/participants`);
        const participants = participantsRes.data;

        const encryptedPerUser = participants.map((p: any) => {
          const publicKeyUint8 = decodeBase64(p.public_key);
          const { ciphertext, nonce } = encryptMessage(textToSend, publicKeyUint8, privateKey);
          return {
            user_id: p.id,
            ciphertext,
            nonce,
          };
        });

        await api.post("/chats/send", {
          chat_id,
          messages: encryptedPerUser,
          chatName: selectedChat.name,
        });

        setInputText("");
      }
    } catch (err: any) {
      console.error("Ошибка при отправке (handleSendWeb):", err.response?.data || err.message);
    }
  };

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
        if (data.type === "message_new" && Number(data.chat_id) === Number(selectedChat?.chat_id)) {
          const keyPair = getStoredKeyPair();
          console.log("socket data", data);
          if (!keyPair) {
            return showAlert("Ошибка", "Ключи шифрования не найдены");
          }
          const { privateKey } = keyPair;
          let text = "";
          if (selectedChat?.type === "private" && data.ciphertext && data.nonce) {
            const initialPubKey = selectedChat.otherUser?.public_key;
            if (!initialPubKey) return;
            let theirPub = initialPubKey ? decodeBase64(initialPubKey) : null;
            try {
              if (!theirPub) throw new Error("No key");
              text = decryptMessage(data.ciphertext, data.nonce, privateKey, theirPub);
            } catch {
              // В вебе функция getParticipantPublicKey должна быть определена или заменена на запрос
              const freshKey = await getParticipantPublicKey(selectedChat.chat_id, selectedChat.otherUser?.id);
              if (!freshKey) {
                text = "[Ошибка расшифровки]";
              } else {
                try {
                  theirPub = decodeBase64(freshKey);
                  text = decryptMessage(data.ciphertext, data.nonce, privateKey, theirPub);
                } catch {
                  text = "[Ошибка расшифровки]";
                }
              }
            }

            const newMsg = {
              id: data.id ?? Date.now(),
              chat_id: data.chat_id,
              sender_id: data.sender_id,
              ciphertext: data.ciphertext,
              nonce: data.nonce,
              sender_avatar: data.sender_avatar,
              sender_name: data.sender_name,
              sender_surname: data.sender_surname,
              created_at: data.created_at ?? new Date().toISOString(),
              parent_id: data.parent_id,
              text,
            };

            setMessages((prev) => [...prev, newMsg]);
          }

          if (selectedChat?.type === "group" && Array.isArray(data.messages)) {
            const encryptedForMe = data.messages.find((m: any) => Number(m.user_id) === Number(user?.id));
            if (!encryptedForMe) return;
            const keyPair = getStoredKeyPair();
            if (!keyPair) {
              return showAlert("Ошибка", "Ключи шифрования не найдены");
            }
            const { privateKey } = keyPair;
            const partRes = await api.get(`/chats/${selectedChat.chat_id}/participants`);
            const sender = partRes.data.find((p: any) => Number(p.id) === Number(data.sender_id));
            if (!sender?.public_key) return;

            const senderPub = decodeBase64(sender.public_key);
            let decryptedText = "";
            try {
              decryptedText = decryptMessage(encryptedForMe.ciphertext, encryptedForMe.nonce, privateKey, senderPub);
            } catch {
              decryptedText = "[Ошибка расшифровки]";
            }

            const newMsg = {
              id: encryptedForMe.id ?? Date.now(),
              chat_id: data.chat_id,
              sender_id: data.sender_id,
              ciphertext: encryptedForMe.ciphertext,
              nonce: encryptedForMe.nonce,
              sender_avatar: data.sender_avatar,
              sender_name: data.sender_name,
              sender_surname: data.sender_surname,
              created_at: data.created_at ?? new Date().toISOString(),
              parent_id: encryptedForMe.parent_id || data.parent_id,
              text: decryptedText,
            };
            setMessages((prev) => [...prev, newMsg]);
          }
        }
        if (data.type === "message_deleted") {
          setMessages((prev) => {
            return prev.filter((msg) => {
              const isMatch =
                Number(msg.id) === Number(data.message_id) ||
                (msg.parent_id && Number(msg.parent_id) === Number(data.message_id));
              return !isMatch;
            });
          });
        }

        if (data.type === "message_updated" && Number(data.chat_id) === Number(selectedChat?.chat_id)) {
          if (selectedChat?.type === "group" && Array.isArray(data.messages)) {
            if (!user) return;
            const myCopy = data.messages.find(
              (m: any) => Number(m.recipient_id || m.user_id) === Number(user.id) && m.ciphertext
            );

            if (myCopy) {
              try {
                const senderPubKeyString = myCopy?.sender_public_key;
                const keyPair = getStoredKeyPair();
                if (!keyPair) {
                  return showAlert("Ошибка", "Ключи шифрования не найдены");
                }
                const { privateKey } = keyPair;
                if (!senderPubKeyString) return;
                const senderPub = decodeBase64(senderPubKeyString);
                const decryptedText = decryptMessage(myCopy.ciphertext, myCopy.nonce, privateKey, senderPub);
                const commonId = Number(myCopy.parent_id || myCopy.id);
                setMessages((prev) =>
                  prev.map((msg) => {
                    const mId = Number(msg.id);
                    const mParentId = msg.parent_id ? Number(msg.parent_id) : null;
                    if (mId === commonId || mParentId === commonId) {
                      return { ...msg, text: decryptedText, ciphertext: myCopy.ciphertext, nonce: myCopy.nonce };
                    }
                    return msg;
                  })
                );
              } catch (err) {
                console.error("Group decryption error during update:", err);
              }
            }
          } else if (selectedChat?.type === "private" && data.message) {
            const keyPair = getStoredKeyPair();
            if (!keyPair) {
              return showAlert("Ошибка", "Ключи шифрования не найдены");
            }
            const { privateKey } = keyPair;
            const updateData = data.message;
            if (!user || !updateData) return;

            const senderId = Number(updateData.sender_id);
            let pubKeyString: string | null | undefined = null;
            if (senderId === Number(user.id)) {
              pubKeyString = selectedChat.otherUser?.public_key;
            } else {
              pubKeyString = data.sender_public_key || data.sender?.public_key || selectedChat.otherUser?.public_key;
            }

            if (!pubKeyString) return;
            const keyToDecrypt = decodeBase64(pubKeyString);
            const decryptedText = decryptMessage(updateData.ciphertext, updateData.nonce, privateKey, keyToDecrypt);

            setMessages((prev) => {
              const incomingId = Number(updateData.id || data.message_id);
              return prev.map((m) => {
                if (Number(m.id) === incomingId) {
                  return { ...m, text: decryptedText, ciphertext: updateData.ciphertext, nonce: updateData.nonce };
                }
                return m;
              });
            });
          }
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
                    onClick={() => {
                      setSelectedChat(item);
                      removeUnread(item.chat_id);
                    }}
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
                        {unreadChats.has(item.chat_id) && <span className="unread-badge">🔥</span>}
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
              <div className="chat-header-user">
                {selectedChat.type === "private"
                  ? `${selectedChat.otherUser?.username} ${selectedChat.otherUser?.usersurname}`
                  : selectedChat.name}
              </div>
            </header>
            <div className="messages-container">
              {messages.map((msg, index) => (
                <div key={msg.id || index} onContextMenu={(e) => handleContextMenu(e, msg)}>
                  <Message
                    message={msg}
                    isMe={Number(msg.sender_id) === Number(user?.id)}
                    onPressProfile={(id) => setViewedProfileId(id)}
                  />
                </div>
              ))}
            </div>
            <footer className="input-area">
              <textarea
                className="message-input multiline"
                placeholder="Введите сообщение..."
                rows={1}
                value={inputText}
                onChange={(e) => {
                  setInputText(cleanInput(e.target.value));
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (inputText.trim()) {
                      handleSendWeb(inputText);
                      setInputText("");
                      e.currentTarget.style.height = "auto";
                    }
                  }
                }}
              />
              <button
                className="send-button"
                onClick={() => {
                  if (inputText.trim()) {
                    handleSendWeb(inputText);
                    setInputText("");
                  }
                }}
                aria-label="Отправить"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  style={{ transform: "translateY(1px)" }}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </footer>
          </div>
        ) : (
          <div className="empty-chat">
            <div className="empty-content">
              <h2>LiveTouch.chat</h2>
              <p>Выберите чат, чтобы начать общение</p>
            </div>
          </div>
        )}
      </main>
      {contextMenu && (
        <div className="custom-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button
            onClick={() => {
              setSelectedMessage(contextMenu.msg);
              setEditMode(true);
              setInputText(contextMenu.msg.text || ""); // Предзаполняем инпут текстом сообщения
            }}
          >
            Изменить
          </button>
          <button
            className="delete-btn"
            onClick={() => {
              handleDelete(contextMenu.msg.id);
            }}
          >
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}
