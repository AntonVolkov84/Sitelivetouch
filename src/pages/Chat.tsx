import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  type Chat,
  type DecryptedMessage,
  type UserChat,
  type SocketMessageNewPayload,
  type EncryptedMessageFromServer,
} from "../types";
import { api } from "../../axiosinstance";
import { useWS } from "../context/WsContext";
import { useModal } from "../context/ModalContext";
import Message from "../components/Message";
import { IoArrowDownOutline } from "react-icons/io5";
import ProfileView from "../components/ProfileView";
import { IoHeart } from "react-icons/io5";
import {
  IoArrowUndoOutline,
  IoCopyOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoArrowRedoOutline,
} from "react-icons/io5";
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
  const [replyMessage, setReplyMessage] = useState<DecryptedMessage | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msg: DecryptedMessage } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<number[]>([]);
  const [messageToForward, setMessageToForward] = useState<DecryptedMessage | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const [_, setCanLoadHistory] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const navigate = useNavigate();
  const { ws } = useWS() || {};
  const cleanInput = (text: string) => text.replace(/<\/?[^>]+(>|$)/g, "");
  const handleStartCall = () => {
    if (!selectedChat || !selectedChat.otherUser) return;
    navigate(`/call/${selectedChat.chat_id}?callerId=${selectedChat.otherUser.id}&isIncoming=false`);
  };
  const handleTyping = () => {
    if (!ws || !user || !selectedChat) return;
    if (!typingTimeoutRef.current) {
      ws.send(
        JSON.stringify({
          type: "typing",
          chatId: selectedChat.chat_id,
          userId: user.id,
          isTyping: true,
        }),
      );
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      ws.send(
        JSON.stringify({
          type: "typing",
          chatId: selectedChat.chat_id,
          userId: user.id,
          isTyping: false,
        }),
      );
      typingTimeoutRef.current = null;
    }, 2500);
  };
  useEffect(() => {
    if (ws?.readyState === 1 && selectedChat?.chat_id) {
      ws.send(
        JSON.stringify({
          type: "join-chat",
          chat_id: selectedChat.chat_id,
          userId: user?.id,
        }),
      );
    }
  }, [ws, selectedChat?.chat_id]);
  useEffect(() => {
    if (!ws) {
      console.warn("WS: Соединение отсутствует");
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (Number(data.chat_id) !== Number(selectedChat?.chat_id)) {
          return;
        }
        switch (data.type) {
          case "room_snapshot":
            const ids = data.online_users ? data.online_users.map(Number) : [];
            setOnlineUsers(ids);
            break;
          case "user_status_update":
            const uid = Number(data.user_id);
            if (data.status === "online") {
              setOnlineUsers((prev) => [...new Set([...prev, uid])]);
            } else {
              setOnlineUsers((prev) => prev.filter((id) => id !== uid));
            }
            break;
          case "user_typing_update":
            const tId = Number(data.user_id);
            if (data.isTyping) {
              setTypingUsers((prev) => [...new Set([...prev, tId])]);
            } else {
              setTypingUsers((prev) => prev.filter((id) => id !== tId));
            }
            break;
          default:
            console.log("ℹ️ Получено другое событие:", data.type);
        }
      } catch (err) {
        console.error("❌ Ошибка при обработке сообщения WS:", err, event.data);
      }
    };
    ws.addEventListener("message", handleMessage);
    const handleClose = () => console.error("🚨 WS ПОТЕРЯНО СОЕДИНЕНИЕ (Сервер упал?)");
    ws.addEventListener("close", handleClose);
    return () => {
      ws.removeEventListener("message", handleMessage);
      ws.removeEventListener("close", handleClose);
    };
  }, [ws, selectedChat?.chat_id]);
  const scrollToBottom = () => {
    const container = document.querySelector(".messages-container");
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  };
  useEffect(() => {
    const container = document.querySelector(".messages-container");
    if (!container) return;
    const handleScroll = () => {
      const offset = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollDown(offset > 300);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);
  const handleToggleLike = (messageId: number) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("WS connection is not open");
      return;
    }
    if (!user || !selectedChat?.chat_id) return;
    ws.send(
      JSON.stringify({
        type: "toggle-like",
        messageId: messageId,
        chatId: selectedChat.chat_id,
        userId: user.id,
      }),
    );
    setMessages((prev) =>
      prev.map((msg) => {
        if (Number(msg.id) === messageId) {
          const alreadyLiked = msg.is_liked;
          const currentCount = Number(msg.likes_count) || 0;
          return {
            ...msg,
            is_liked: !alreadyLiked,
            likes_count: alreadyLiked ? Math.max(0, currentCount - 1) : currentCount + 1,
          };
        }
        return msg;
      }),
    );
  };
  const handleOpenForward = (msg: DecryptedMessage) => {
    setMessageToForward(msg);
    setSelectedChatIds([]);
    setIsForwardModalOpen(true);
    setContextMenu(null);
  };
  const toggleChatSelection = (chatId: number) => {
    setSelectedChatIds((prev) => (prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]));
  };
  const confirmForward = async () => {
    if (!messageToForward || selectedChatIds.length === 0) return;
    try {
      await Promise.all(selectedChatIds.map((id) => handleSendWeb(messageToForward.text, id)));
      showAlert("Успех", "Сообщение переслано");
    } catch (err) {
      console.error("Ошибка рассылки:", err);
      showAlert("Ошибка", "Не удалось переслать в некоторые чаты");
    } finally {
      setIsForwardModalOpen(false);
      setSelectedChatIds([]);
      setMessageToForward(null);
    }
  };
  useEffect(() => {
    setHasMore(true);
    setMessages([]);
    setOffset(0);
    setCanLoadHistory(false);
    if (selectedChat) {
      loadMessages(0);
      const timer = setTimeout(() => setCanLoadHistory(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedChat]);
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const file = event.target.files[0];
    if (!file) return;
    const MAX_SIZE = 20 * 1024 * 1024;
    const admins = ["antvolkov84@gmail.com", "aleks_e@inbox.ru"];
    const isProgrammer = user?.email && admins.includes(user.email);
    if (file.size > MAX_SIZE && !isProgrammer) {
      alert("Файл слишком большой. Максимальный размер — 20 МБ.");
      return;
    }
    try {
      setUploadProgress(1);
      await uploadFileWeb(file);
    } catch (err: any) {
      if (user) {
        logError(user.email, "Web Chat: markAsRead", err.response?.data || err.message);
      }
    } finally {
      setUploadProgress(0);
      event.target.value = "";
    }
  };
  const uploadFileWeb = async (file: File) => {
    const mime = file.type;
    let bucket = "files";
    let finalFilename = "";
    if (mime.startsWith("image/")) bucket = "photos";
    else if (mime.startsWith("video/")) bucket = "video";
    else if (mime.startsWith("audio/")) bucket = "voice";
    if (bucket !== "files") {
      const fileExt = file.name.split(".").pop();
      finalFilename = `${Date.now()}-${Math.floor(Math.random() * 1e9)}.${fileExt}`;
    } else {
      finalFilename = file.name.replace(/\s+/g, "_");
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", bucket);
    formData.append("filename", finalFilename);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "https://api.livetouch.chat/upload");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      };
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (selectedChat) {
              await addFileRecord(selectedChat.chat_id, bucket, finalFilename);
              handleSendWeb(data.url);
            }
            resolve(data);
          } catch (e) {
            reject(new Error("Ошибка парсинга ответа"));
          }
        } else {
          reject(new Error("Ошибка загрузки: " + xhr.status));
        }
      };

      xhr.onerror = () => reject(new Error("Сетевая ошибка"));
      xhr.send(formData);
    });
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
    } catch (err: any) {
      if (user) {
        logError(user.email, "Web Chat: addFileRecord", err.response?.data || err.message);
      }
      console.error("Ошибка при записи файла в БД:", err.response?.data || err.message);
    }
  };
  const cancelSpecialMode = () => {
    setEditMode(false);
    setReplyMessage(null);
    setSelectedMessage(null);
    setInputText("");
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
    const menuWidth = 150;
    const menuHeight = 150;
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
    } catch (err: any) {
      if (user) {
        logError(user.email, "Web Chat: fetchParticipants", err.response?.data || err.message);
      }
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
      if (user) {
        logError(user.email, "Web Chat: addParticipant", err.response?.data || err.message);
      }
      alert("Не удалось добавить пользователя");
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
      const { chat_id } = selectedChat;
      const { data: participants } = await api.get(`/chats/${chat_id}/participants`);
      const encryptedPerUser = participants.map((u: UserChat) => {
        const userPub = decodeBase64(u.public_key);
        const { ciphertext, nonce } = encryptMessage(inputText, userPub, privateKey);
        return { recipient_id: u.id, ciphertext, nonce };
      });
      const messageIdToUpdate = selectedMessage.parent_id || selectedMessage.id;
      await api.put(`/chats/message/${messageIdToUpdate}`, {
        messages: encryptedPerUser,
      });
      setInputText("");
      setEditMode(false);
      setSelectedMessage(null);
    } catch (err: any) {
      if (user) {
        logError(user.email, "Web Chat: handleUpdateMessage", err.response?.data || err.message);
      }
      console.error("handleUpdateMessage error:", err);
    }
  };
  const handleDelete = async (id: number | string) => {
    showConfirm(
      "Удаление",
      "Удалить сообщение у себя?",
      async () => {
        try {
          await api.delete(`/chats/message/${id}`);
          setMessages((prev) => prev.filter((m) => m.id !== id));
          setSelectedMessage(null);
        } catch (err: any) {
          if (user) {
            logError(user.email, "Web Chat: handleDelete", err.response?.data || err.message);
          }
          console.error("Delete error:", err);
          alert("Не удалось удалить сообщение.");
        }
      },
      "Удалить",
    );
  };
  const handleDeleteAllParticipants = async (id: number | string) => {
    showConfirm(
      "Удаление у всех",
      "Вы уверены, что хотите удалить это сообщение для всех участников?",
      async () => {
        try {
          await api.delete(`/chats/messageall/${id}`);
          setMessages((prev) => prev.filter((m) => m.id !== id));
          setSelectedMessage(null);
        } catch (err: any) {
          if (user) {
            logError(user.email, "Web Chat: handleDeleteAllParticipants", err.response?.data || err.message);
          }
          console.error("Delete All error:", err);
          alert("Не удалось удалить сообщение у всех участников.");
        }
      },
      "Удалить у всех",
    );
  };

  useEffect(() => {
    const container = document.querySelector(".messages-container");
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
    if (isAtBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async (currentOffset: number = 0) => {
    if (!selectedChat || !user) return;
    if (currentOffset > 0 && (!hasMore || isFetchingHistory)) return;
    try {
      setIsFetchingHistory(true);
      const container = document.querySelector(".messages-container");
      const previousHeight = container ? container.scrollHeight : 0;
      const previousScrollTop = container ? container.scrollTop : 0;
      const keyPair = getStoredKeyPair();
      if (!keyPair) {
        console.error("Ключи не найдены");
        return;
      }
      const { data } = await api.get(`/chats/${selectedChat.chat_id}?limit=${LIMIT}&offset=${currentOffset}`);
      const rawMessages = data as DecryptedMessage[];
      if (rawMessages.length < 30) setHasMore(false);
      const decrypted = rawMessages.map((msg) => {
        if (!msg.ciphertext || !msg.nonce) return msg;
        try {
          const pubKeyString = msg.sender_public_key;
          if (!pubKeyString) {
            throw new Error("Публичный ключ отправителя отсутствует в данных");
          }
          const text = decryptMessage(msg.ciphertext, msg.nonce, keyPair.privateKey, decodeBase64(pubKeyString));
          return { ...msg, text };
        } catch (err: any) {
          if (user) {
            logError(user.email, "Web Chat: loadMessages", err.response?.data || err.message);
          }
          console.error(`Ошибка расшифровки сообщения ${msg.id}:`, err);
          return { ...msg, text: "[Ошибка расшифровки]" };
        }
      });
      const newDecrypted = decrypted.filter((m) => m !== null).reverse();
      if (currentOffset === 0) {
        setMessages(newDecrypted);
        setOffset(LIMIT);
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTo({ top: container.scrollHeight, behavior: "instant" });
            setTimeout(() => {
              container.scrollTop = container.scrollHeight;
            }, 250);
          }
        });
      } else {
        setMessages((prev) => [...newDecrypted, ...prev]);
        setOffset(currentOffset + LIMIT);
        requestAnimationFrame(() => {
          if (container) {
            const newHeight = container.scrollHeight;
            container.scrollTop = newHeight - previousHeight + previousScrollTop;
          }
        });
      }
    } catch (err) {
      console.error("Load messages error:", err);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  useEffect(() => {
    setMessages([]);
    if (selectedChat) loadMessages();
  }, [selectedChat]);
  const handleSendWeb = async (msg?: string, targetChatId?: number) => {
    try {
      const textToSend = msg ?? inputText;
      const finalChatId = targetChatId ?? selectedChat?.chat_id;
      if (!finalChatId) return;
      if (!textToSend.trim()) return;
      if (/[<>]/.test(textToSend)) {
        console.error("Недопустимые символы");
        return;
      }
      if (!targetChatId && editMode && selectedMessage) {
        if (Number(selectedMessage.sender_id) === Number(user?.id)) {
          await handleUpdateMessage();
          cancelSpecialMode();
          return;
        } else {
          cancelSpecialMode();
          setSelectedMessage(null);
          return;
        }
      }
      const keyPair = getStoredKeyPair();
      if (!keyPair) return showAlert("Ошибка", "Ключи не найдены");
      const { privateKey } = keyPair;
      const participantsRes = await api.get(`/chats/${finalChatId}/participants`);
      const participants = participantsRes.data;
      const encryptedPerUser = participants.map((p: UserChat) => {
        const publicKeyUint8 = decodeBase64(p.public_key);
        const { ciphertext, nonce } = encryptMessage(textToSend, publicKeyUint8, privateKey);
        return {
          user_id: p.id,
          ciphertext,
          nonce,
        };
      });
      const targetChatData = targetChatId ? chats.find((c) => c.chat_id === targetChatId) : selectedChat;
      await api.post("/chats/send", {
        chat_id: finalChatId,
        messages: encryptedPerUser,
        chatName: targetChatData?.name || "Чат",
        reply_to_id: targetChatId ? null : replyMessage?.id,
        chat_type: targetChatData?.type || "private",
      });
      if (!targetChatId) {
        cancelSpecialMode();
        setInputText("");
      }
    } catch (err: any) {
      if (user) {
        logError(user.email, "Web Chat: handleSendWeb", err.response?.data || err.message);
      }
      setEditMode(false);
      setReplyMessage(null);
      console.error("Ошибка при отправке (handleSendWeb):", err.response?.data || err.message);
    }
  };

  const fetchData = async () => {
    try {
      const chatsRes = await api.get("/chats/getchats");
      setChats(chatsRes.data);
    } catch (err: any) {
      console.error("Data fetch error:", err);
      if (user) {
        logError(user.email, "Web Chat: fetchData", err.response?.data || err.message);
      }
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
        const keyPair = getStoredKeyPair();
        if (!keyPair) {
          return showAlert("Ошибка", "Ключи шифрования не найдены");
        }
        if (["chat_created", "group_created", "add_participant"].includes(data.type)) {
          api.get("/chats/getchats").then((res) => setChats(res.data));
        }
        if (data.type === "chat_removed") {
          setChats((prev) => prev.filter((c) => c.chat_id !== data.chat_id));
          if (selectedChat?.chat_id === data.chat_id) setSelectedChat(null);
        }
        if (data.type === "message_new" && Number(data.chat_id) === Number(selectedChat?.chat_id)) {
          const payload = data as SocketMessageNewPayload;
          const myCopy = payload.messages?.find(
            (m: EncryptedMessageFromServer) => Number(m.user_id || m.recipient_id) === Number(user?.id),
          );
          if (myCopy) {
            try {
              const pubKey = data.sender_public_key;
              if (!pubKey) throw new Error("No sender public key in socket data");
              const text = decryptMessage(myCopy.ciphertext, myCopy.nonce, keyPair.privateKey, decodeBase64(pubKey));
              const newMsg = {
                ...myCopy,
                reply_to_id: data.reply_to_id ? Number(data.reply_to_id) : null,
                sender_id: data.sender_id,
                sender_name: data.sender_name,
                sender_surname: data.sender_surname,
                sender_avatar: data.sender_avatar,
                text,
              };
              setMessages((prev) => [...prev, newMsg]);
            } catch (err: any) {
              if (user) {
                logError(user.email, "Web Chat: handleMessage - new_message", err.response?.data || err.message);
              }
              console.error("Decryption error", err);
            }
          }
        }
        if (data.type === "message_deleted") {
          setMessages((prev) =>
            prev.filter((msg) => {
              const mId = Number(msg.id);
              const mParentId = msg.parent_id ? Number(msg.parent_id) : null;
              const targetId = Number(data.message_id);
              return mId !== targetId && mParentId !== targetId;
            }),
          );
          return;
        }
        if (data.type === "like_update") {
          const { messageId, totalLikes, parentId, userId, action } = data;
          setMessages((prev) =>
            prev.map((msg) => {
              // Твоя фирменная логика сопоставления ID
              const isMatch =
                Number(msg.id) === Number(messageId) ||
                (msg.parent_id && Number(msg.parent_id) === Number(parentId)) ||
                Number(msg.id) === Number(parentId);

              if (isMatch) {
                return {
                  ...msg,
                  likes_count: totalLikes,
                  is_liked:
                    Number(userId) === Number(user?.id) ? action === "added" || action === "restored" : msg.is_liked,
                };
              }
              return msg;
            }),
          );
          return;
        }
        if (data.type === "message_updated" && Number(data.chat_id) === Number(selectedChat?.chat_id)) {
          const myCopy = data.messages?.find(
            (m: EncryptedMessageFromServer) => Number(m.user_id || m.recipient_id) === Number(user?.id),
          );
          if (myCopy) {
            try {
              const pubKey = myCopy.sender_public_key;
              const text = decryptMessage(myCopy.ciphertext, myCopy.nonce, keyPair.privateKey, decodeBase64(pubKey));
              const commonId = Number(myCopy.parent_id || myCopy.id);
              setMessages((prev) =>
                prev.map((msg) => {
                  const mId = Number(msg.id);
                  const mParentId = msg.parent_id ? Number(msg.parent_id) : null;
                  if (mId === commonId || mParentId === commonId) {
                    return { ...msg, ...myCopy, text };
                  }
                  return msg;
                }),
              );
            } catch (err: any) {
              if (user) {
                logError(user.email, "Web Chat: handleMessage - message_updated", err.response?.data || err.message);
              }
              console.error("Update decryption error", err);
            }
          }
        }
      } catch (err: any) {
        console.error("WS error:", err);
        if (user) {
          if (user) {
            logError(user.email, "Web Chat: handleMessage", err.response?.data || err.message);
          }
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
      "Покинуть",
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

  const handleReply = (msg: DecryptedMessage) => {
    setEditMode(false);
    setInputText("");
    setReplyMessage(msg);
    setContextMenu(null);
    inputRef.current?.focus();
  };
  const handleOpenProfile = async (userId: number) => {
    try {
      const res = await api.get(`/auth/${userId}/profile`);
      setSelectedUserProfile(res.data);
      setIsProfileOpen(true);
    } catch (err: any) {
      if (user) {
        logError(user.email, "Web Chat: handleOpenProfile", err.response?.data || err.message);
      }
      console.error("Ошибка загрузки профиля", err);
    }
  };
  useEffect(() => {
    const container = document.querySelector(".messages-container");
    const observer = new IntersectionObserver(
      (entries) => {
        const container = document.querySelector(".messages-container");
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isFetchingHistory &&
          messages.length >= LIMIT &&
          container &&
          container.scrollTop < 200
        ) {
          loadMessages(offset);
        }
      },
      { threshold: 0.1, root: container },
    );

    const target = document.querySelector("#scroll-sentinel");
    if (target) observer.observe(target);

    return () => observer.disconnect();
  }, [offset, hasMore, isFetchingHistory, selectedChat, messages.length]);

  if (loading) return <h2 className="loader">Загрузка...</h2>;
  const handleCopy = async (msg: DecryptedMessage) => {
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg.text);
    } catch (err) {
      console.error("Не удалось скопировать текст: ", err);
    }
  };
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
                          {userInfo ? `${userInfo.username} ${userInfo.usersurname}` : `Группа: ${item.name}`}
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
                {selectedChat.type === "private" &&
                  selectedChat.otherUser &&
                  (() => {
                    const companionId = Number(selectedChat.otherUser.id);
                    const isTyping = typingUsers.includes(companionId);
                    const isOnline = onlineUsers.includes(companionId);

                    return (
                      <span
                        className={`sub-text ${isTyping ? "typing" : isOnline ? "online" : "offline"}`}
                        style={{ fontSize: "12px", color: isTyping || isOnline ? "#4A8CFF" : "#888" }}
                      >
                        {isTyping ? "Печатает..." : isOnline ? "В сети" : "Не в сети"}
                      </span>
                    );
                  })()}
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
              <div id="scroll-sentinel" style={{ height: "10px" }}>
                {isFetchingHistory && <div className="loader-mini">Загрузка истории...</div>}
              </div>
              {messages.map((msg, index) => (
                <div key={msg.id || index} onContextMenu={(e) => handleContextMenu(e, msg)}>
                  <Message
                    message={msg}
                    isMe={Number(msg.sender_id) === Number(user?.id)}
                    onPressProfile={handleOpenProfile}
                    allMessages={messages}
                  />
                </div>
              ))}
              {showScrollDown && (
                <button className="scroll-down-btn" onClick={scrollToBottom}>
                  <IoArrowDownOutline />
                </button>
              )}
            </div>
            <footer className="input-area">
              {editMode && selectedMessage && (
                <div className="edit-indicator-bar">
                  <div className="edit-info">
                    <span className="edit-label">Редактирование</span>
                    <span className="edit-text-preview">
                      {selectedMessage.text.length > 100
                        ? selectedMessage.text.slice(0, 100) + "..."
                        : selectedMessage.text}
                    </span>
                  </div>
                  <button className="cancel-edit-btn" onClick={cancelSpecialMode}>
                    ✕
                  </button>
                </div>
              )}
              {replyMessage && (
                <div className="reply-indicator-bar">
                  <div className="reply-info">
                    <span className="reply-label">Ответ пользователю {replyMessage.sender_name}</span>
                    <span className="reply-text-preview">
                      {replyMessage.text.length > 100 ? replyMessage.text.slice(0, 100) + "..." : replyMessage.text}
                    </span>
                  </div>
                  <button className="cancel-reply-btn" onClick={cancelSpecialMode}>
                    ✕
                  </button>
                </div>
              )}
              <div className="input-area-block">
                {uploadProgress > 0 ? (
                  <div style={{ width: "100%", background: "#eee", borderRadius: "5px", margin: "10px 0" }}>
                    <div
                      style={{
                        width: `${uploadProgress}%`,
                        height: "10px",
                        background: "#4caf50",
                        borderRadius: "5px",
                        transition: "width 0.3s ease",
                      }}
                    />
                    <span style={{ fontSize: "12px" }}>Загрузка: {uploadProgress}%</span>
                  </div>
                ) : (
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
                )}
                {uploadProgress > 0 ? null : (
                  <textarea
                    ref={inputRef}
                    className="message-input multiline"
                    placeholder="Введите сообщение..."
                    rows={1}
                    value={inputText}
                    onChange={(e) => {
                      setInputText(cleanInput(e.target.value));
                      handleTyping();
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
                )}
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
              </div>
            </footer>
          </div>
        ) : (
          <div className="empty-chat">
            <div className="empty-content">
              <h2>ЛТ</h2>
              <p>Выберите чат, чтобы начать общение</p>
            </div>
          </div>
        )}
      </main>
      {contextMenu && (
        <div className="custom-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button onClick={() => handleToggleLike(Number(contextMenu.msg.id))}>
            <IoHeart
              style={{
                color: contextMenu.msg.is_liked ? "#ff3b30" : "inherit",
                marginRight: "8px",
                verticalAlign: "middle",
              }}
            />
            {contextMenu.msg.is_liked ? "Убрать лайк" : "Лайкнуть"}
          </button>
          <button
            onClick={() => {
              handleReply(contextMenu.msg);
              setContextMenu(null);
            }}
          >
            <IoArrowUndoOutline className="menu-icon" />
            <span>Ответить</span>
          </button>
          <button
            onClick={() => {
              handleCopy(contextMenu.msg);
              setContextMenu(null);
            }}
          >
            <IoCopyOutline className="menu-icon" />
            <span>Копировать</span>
          </button>
          <button onClick={() => handleOpenForward(contextMenu.msg)}>
            <IoArrowRedoOutline className="menu-icon" />
            <span>Переслать</span>
          </button>
          {Number(contextMenu.msg.sender_id) === Number(user?.id) && (
            <button
              onClick={() => {
                setSelectedMessage(contextMenu.msg);
                setEditMode(true);
                setReplyMessage(null);
                setInputText(contextMenu.msg.text || "");
                setContextMenu(null);
                inputRef.current?.focus();
              }}
            >
              <IoPencilOutline className="menu-icon" />
              <span>Изменить</span>
            </button>
          )}
          <button
            className="delete-btn"
            onClick={() => {
              handleDelete(contextMenu.msg.id);
              setContextMenu(null);
            }}
          >
            <IoTrashOutline className="menu-icon" />
            <span>Удалить</span>
          </button>
          {Number(contextMenu.msg.sender_id) === Number(user?.id) && (
            <button
              className="delete-btn"
              onClick={() => {
                handleDeleteAllParticipants(contextMenu.msg.id);
                setContextMenu(null);
              }}
            >
              <IoTrashOutline className="menu-icon" />
              <span>Удалить у всех</span>
            </button>
          )}
        </div>
      )}
      {isForwardModalOpen && (
        <div className="modal-overlay">
          <div className="modal-window forward-modal">
            <h3>Переслать сообщение</h3>
            <div className="forward-chats-list">
              {chats
                .filter((c) => c.chat_id !== selectedChat?.chat_id)
                .map((chat) => {
                  const isSelected = selectedChatIds.includes(chat.chat_id);
                  return (
                    <div
                      key={chat.chat_id}
                      className={`forward-chat-item ${isSelected ? "selected" : ""}`}
                      onClick={() => toggleChatSelection(chat.chat_id)}
                    >
                      <div className="checkbox-wrapper">
                        <input type="checkbox" checked={isSelected} readOnly />
                      </div>

                      {chat.type === "private" ? (
                        <>
                          {chat.otherUser?.avatar_url ? (
                            <img src={chat.otherUser.avatar_url} alt="avatar" className="participant-avatar" />
                          ) : (
                            <div className="avatar-placeholder-sm">{chat.otherUser?.username?.[0] || "?"}</div>
                          )}
                          <div className="chat-info-min">
                            <span>
                              {chat.otherUser?.username} {chat.otherUser?.usersurname}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="avatar-placeholder-sm group">{chat.name?.[0] || "G"}</div>
                          <div className="chat-info-min">
                            <span>{chat.name}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
            </div>
            <div className="modal-buttons">
              <button className="cancel" onClick={() => setIsForwardModalOpen(false)}>
                Отмена
              </button>
              <button disabled={selectedChatIds.length === 0} onClick={confirmForward}>
                Переслать ({selectedChatIds.length})
              </button>
            </div>
          </div>
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
      {isParticipantsModalOpen && (
        <div className="modal-overlay" onClick={() => setIsParticipantsModalOpen(false)}>
          <div className="modal-window participants-list" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Участники группы</h3>
            </div>
            <div className="list-container">
              {participants.map((p) => {
                const isOnline = onlineUsers.includes(Number(p.id));
                const isTyping = typingUsers.includes(Number(p.id));
                const isMe = p.id === user?.id;
                return (
                  <div key={p.id} className="participant-item">
                    <div className="avatar-wrapper">
                      <img src={p.avatar_url || "/default-avatar.png"} className="participant-avatar" alt="" />
                      {isOnline && <div className="online-indicator" />}
                    </div>
                    <div className="p-info">
                      <div className="p-name-row">
                        <span className="p-name">
                          {p.username} {p.usersurname}
                        </span>
                        {isMe && <span className="me-badge">Вы</span>}
                      </div>
                      {isMe ? (
                        <div className="p-status online" style={{ color: "#4A8CFF" }}>
                          Это вы
                        </div>
                      ) : (
                        <div className={`p-status ${isTyping ? "typing" : isOnline ? "online" : "offline"}`}>
                          {isTyping ? "Печатает..." : isOnline ? "В сети" : "Не в сети"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="modal-close-btn" onClick={() => setIsParticipantsModalOpen(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
      {isProfileOpen && selectedUserProfile && (
        <div className="web-modal-overlay" onClick={() => setIsProfileOpen(false)}>
          <div className="web-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setIsProfileOpen(false)}>
              ×
            </button>
            <img src={selectedUserProfile.avatar_url || "default-avatar.png"} alt="Avatar" />
            <h2>
              {selectedUserProfile.username} {selectedUserProfile.usersurname}
            </h2>
            <p>{selectedUserProfile.email}</p>
            <p>{selectedUserProfile.phone || "Телефон не указан"}</p>
            <div className="bio">{selectedUserProfile.bio}</div>
          </div>
        </div>
      )}
    </div>
  );
}
