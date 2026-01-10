import { useState } from "react";
import { api } from "../../axiosinstance";
import { useUser } from "../context/UserContext";
import { logError } from "../utils/logger";
import "./AddChatView.css";
import { useModal } from "../context/ModalContext";

interface AddChatViewProps {
  onBack: () => void;
  onSuccess: (chatId: string) => void;
}

export default function AddChatView({ onBack, onSuccess }: AddChatViewProps) {
  const [mode, setMode] = useState<"private" | "group">("private");
  const [email, setEmail] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupEmails, setGroupEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const { user } = useUser();
  const { showAlert } = useModal();

  const sanitize = (text: string) => text.replace(/<[^>]*>?/gm, "");
  const normalizeEmail = (text: string) => sanitize(text).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handlePrivateSubmit = async () => {
    const cleaned = normalizeEmail(email);
    if (cleaned === user?.email?.toLowerCase()) {
      showAlert("Себя добавляешь?", "Можешь с собой и так поговорить!");
      return;
    }
    if (!cleaned || !emailRegex.test(cleaned)) {
      showAlert("Ошибка", "Введите корректный email.");
      return;
    }

    try {
      const res = await api.post("/chats/createprivate", { type: "private", email: cleaned });
      if (res.data.chatId) onSuccess(res.data.chatId);
    } catch (err: any) {
      showAlert("Упс!", err.response?.status === 404 ? "Пользователь не найден" : "Ошибка создания чата");
      if (user) {
        logError(user.email, "WEB_AddChatView: handlePrivateSubmit", err);
      }
    }
  };

  const addEmailToGroup = async () => {
    const cleaned = normalizeEmail(emailInput);
    if (!cleaned || !emailRegex.test(cleaned) || groupEmails.includes(cleaned)) return;

    try {
      const res = await api.get(`/auth/check?email=${cleaned}`);
      if (!res.data.exists) {
        showAlert("Поиск", "Такой пользователь не существует.");
        return;
      }
      setGroupEmails([...groupEmails, cleaned]);
      setEmailInput("");
    } catch (err) {
      console.error(err);
      showAlert("Ошибка", "Не удалось проверить пользователя.");
      if (user) {
        logError(user.email, "WEB_AddChatView: addEmailToGroup", err);
      }
    }
  };

  const handleGroupSubmit = async () => {
    if (!groupName.trim() || groupEmails.length < 1) {
      showAlert("Данные группы", "Заполните название и добавьте хотя бы одного участника.");
      return;
    }
    try {
      const res = await api.post("/chats/creategroup", { name: groupName, participants: groupEmails });
      if (res.data.chat_id) onSuccess(res.data.chat_id);
      onBack();
    } catch (err) {
      console.error(err);
      if (user) {
        logError(user.email, "WEB_AddChatView: handleGroupSubmit", err);
      }
    }
  };

  return (
    <div className="add-chat-view">
      <header className="add-chat-view__header">
        <button onClick={onBack} className="add-chat-view__back-btn">
          ← Назад
        </button>
        <h4 className="add-chat-view__title">Новый чат</h4>
      </header>

      <div className="add-chat-view__content">
        <div className="add-chat-view__switch-container">
          <button
            className={`add-chat-view__switch-btn ${mode === "private" ? "add-chat-view__switch-btn--active" : ""}`}
            onClick={() => setMode("private")}
          >
            Приватный
          </button>
          <button
            className={`add-chat-view__switch-btn ${mode === "group" ? "add-chat-view__switch-btn--active" : ""}`}
            onClick={() => setMode("group")}
          >
            Группа
          </button>
        </div>

        {mode === "private" ? (
          <div className="add-chat-view__form">
            <input
              className="add-chat-view__input"
              placeholder="Введите email пользователя"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="add-chat-view__submit-btn" onClick={handlePrivateSubmit}>
              Создать чат
            </button>
          </div>
        ) : (
          <div className="add-chat-view__form">
            <input
              className="add-chat-view__input"
              placeholder="Название группы"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <div className="add-chat-view__group-input-row">
              <input
                className="add-chat-view__input"
                style={{ flex: 1 }}
                placeholder="Добавить email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEmailToGroup()}
              />
              <button
                className="add-chat-view__submit-btn"
                style={{ width: "auto", padding: "0 15px" }}
                onClick={addEmailToGroup}
              >
                +
              </button>
            </div>

            <div className="add-chat-view__list">
              {groupEmails.map((e) => (
                <div
                  key={e}
                  className="add-chat-view__item"
                  onClick={() => setGroupEmails((prev) => prev.filter((i) => i !== e))}
                >
                  {e} <span>×</span>
                </div>
              ))}
            </div>

            <button className="add-chat-view__submit-btn" onClick={handleGroupSubmit}>
              Создать группу
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
