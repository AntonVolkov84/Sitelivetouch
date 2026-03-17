import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { useModal } from "../context/ModalContext";
import { api } from "../../axiosinstance";
import "./Feedback.css";

interface FeedbackProps {
  onClose?: () => void;
}

export default function Feedback({ onClose }: FeedbackProps) {
  const { user } = useUser();
  const { showAlert } = useModal();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    // Простая защита от XSS
    if (/<script|iframe|on\w+=/i.test(message)) {
      showAlert("Ошибка", "Сообщение содержит запрещенные символы.");
      return;
    }

    setSending(true);
    try {
      await api.post("/auth/feedback/send", {
        name: `${user?.username || ""} ${user?.usersurname || ""}`,
        email: email,
        subject: subject,
        message: message,
      });
      showAlert("Успех", "Сообщение отправлено! Мы скоро свяжемся с вами.");
      if (onClose) onClose();
      setSubject("");
      setMessage("");
    } catch (err) {
      console.error("Feedback error:", err);
      showAlert("Ошибка", "Не удалось отправить сообщение. Попробуйте позже.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="feedback-container">
      <div className="feedback-card">
        <h2 className="feedback-title">Обратная связь</h2>
        <form onSubmit={handleSend} className="feedback-form">
          <div className="feedback-group">
            <label>Ваш Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="feedback-group">
            <label>Тема</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Например: Ошибка в чате"
              required
            />
          </div>
          <div className="feedback-group">
            <label>Сообщение</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Опишите вашу проблему или предложение..."
              required
            ></textarea>
          </div>

          <div className="feedback-actions">
            <button type="submit" disabled={sending} className="btn-send">
              {sending ? "Отправка..." : "Отправить"}
            </button>
            <button type="button" onClick={onClose} className="btn-cancel">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
