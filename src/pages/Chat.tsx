import { useEffect, useState, useRef } from "react";
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");

  const navigate = useNavigate();
  const { ws } = useWS() || {};
  const cleanInput = (text: string) => text.replace(/<\/?[^>]+(>|$)/g, "");

  const handleStartCall = () => {
    if (!selectedChat || !selectedChat.otherUser) return;
    navigate(`/call/${selectedChat.chat_id}?callerId=${selectedChat.otherUser.id}&isIncoming=false`);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const file = event.target.files[0];
    if (!file) return;
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("Файл слишком большой. Максимальный размер — 20 МБ.");
      return;
    }
    await uploadFileWeb(file);
    event.target.value = "";
  };
  const uploadFileWeb = async (file: File) => {
    const mime = file.type;
    let bucket = "files";
    if (mime.startsWith("image/")) bucket = "photos";
    else if (mime.startsWith("video/")) bucket = "video";
    else if (mime.startsWith("audio/")) bucket = "voice";
    const fileExt = file.name.split(".").pop();
    const uniqueName = `${Date.now()}-${Math.floor(Math.random() * 1e9)}.${fileExt}`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", bucket);
    formData.append("filename", uniqueName);
    try {
      const response = await fetch("https://api.livetouch.chat/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      if (!selectedChat) return;
      await addFileRecord(selectedChat.chat_id, bucket, uniqueName);
      handleSendWeb(data.url);
    } catch (err: any) {
      console.error("Upload error:", err.message);
      alert("Ошибка при загрузке файла");
    }
  };
  const addFileRecord = async (chatId: number, bucket: string, fileName: string) => {
    try {
      console.log({
        chat_id: chatId,
        bucket: bucket,
        file_name: fileName,
      });
      await api.post("/miniodata", {
        chat_id: chatId,
        bucket: bucket,
        file_name: fileName,
      });
      console.log("Запись о файле успешно добавлена в БД");
    } catch (err: any) {
      console.error("Ошибка при записи файла в БД:", err.response?.data || err.message);
    }
  };
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
  const fetchParticipants = async () => {
    if (!selectedChat) return;
    try {
      const res = await api.get(`/chats/${selectedChat.chat_id}/participants`);
      setParticipants(res.data);
      setIsParticipantsModalOpen(true);
    } catch (err) {
      console.error("Ошибка загрузки участников:", err);
    }
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
          console.log("socket data", data);
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
                      return { ...msg, ...myCopy, text: decryptedText };
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
                  return { ...m, ...updateData, text: decryptedText };
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
              <div
                className="header-info"
                onClick={selectedChat.type === "group" ? fetchParticipants : undefined}
                style={{ cursor: "pointer", display: "flex", flexDirection: "column" }}
              >
                <h4 style={{ margin: 0 }}>
                  {selectedChat.type === "private"
                    ? selectedChat.otherUser?.usersurname + " " + selectedChat.otherUser?.username
                    : selectedChat.name}
                </h4>
                {selectedChat.type === "group" && <span className="sub-text">нажмите, чтобы увидеть всех</span>}
              </div>

              <div className="header-actions">
                {selectedChat.type === "group" && (
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      backgroundColor: "#4a8cff",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0,
                      color: "white",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </button>
                )}
                <div className="chat-header-actions">
                  {selectedChat?.type === "private" && (
                    <button
                      className="call-btn"
                      onClick={() => {
                        handleStartCall();
                      }}
                      title="Позвонить"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                    </button>
                  )}
                </div>
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
              <button
                type="button"
                className="attach-btn"
                onClick={() => document.getElementById("file-upload")!.click()}
                title="Прикрепить файл"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>
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
              <input
                type="file"
                id="file-upload"
                style={{ display: "none" }}
                onChange={(e) => handleFileSelect(e)}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
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
      {/* Модалка добавления */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-window">
            <h3>Добавить участника</h3>
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="Введите email пользователя"
            />
            <div className="modal-buttons">
              <button
                onClick={() => {
                  addParticipant(newUserEmail);
                  setIsAddModalOpen(false);
                  setNewUserEmail("");
                }}
              >
                Добавить
              </button>
              <button className="cancel" onClick={() => setIsAddModalOpen(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Модалка списка участников */}
      {isParticipantsModalOpen && (
        <div className="modal-overlay" onClick={() => setIsParticipantsModalOpen(false)}>
          <div className="modal-window participants-list" onClick={(e) => e.stopPropagation()}>
            <h3>Участники группы</h3>
            <div className="list-container">
              {participants.map((p) => (
                <div key={p.id} className="participant-item">
                  <img src={p.avatar_url || "/default-avatar.png"} alt="avatar" />
                  <div className="p-info">
                    <span>
                      {p.username} {p.usersurname}
                    </span>
                    {p.id === user?.id && <small>(Вы)</small>}
                  </div>
                </div>
              ))}
            </div>
            <button className="participant-item-btn" onClick={() => setIsParticipantsModalOpen(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
