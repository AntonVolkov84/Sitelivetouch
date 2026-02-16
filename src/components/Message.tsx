import { type DecryptedMessage } from "../types";
import "./Message.css";

interface PropsMessage {
  message: DecryptedMessage;
  isMe: boolean;
  allMessages: DecryptedMessage[];
  onPressProfile?: (id: number) => void;
  onContextMenu?: (e: React.MouseEvent, msg: DecryptedMessage) => void;
}

export default function Message({ message, isMe, onPressProfile, onContextMenu, allMessages }: PropsMessage) {
  const repliedMsg = message.reply_to_id ? allMessages.find((m) => m.id === message.reply_to_id) : null;
  const renderContent = () => {
    const text = message.text;

    if (text.startsWith("https://api.livetouch.chat/photos/")) {
      return <img src={text} alt="Shared" onClick={() => window.open(text, "_blank")} />;
    }
    if (text.startsWith("https://api.livetouch.chat/video/")) {
      return <video src={text} controls />;
    }
    if (text.startsWith("https://api.livetouch.chat/files/")) {
      const fileName = text.split("/").pop();
      return (
        <a href={text} target="_blank" rel="noreferrer" className="file-link">
          <div className="file-icon">📄</div>
          <div>
            <div className="file-name">{fileName}</div>
            <div className="file-sub">Скачать</div>
          </div>
        </a>
      );
    }
    return <span className="msg-text">{text}</span>;
  };

  return (
    <div onContextMenu={(e) => onContextMenu?.(e, message)} className={`message-wrapper ${isMe ? "me" : "them"}`}>
      <div className="message-bubble">
        {repliedMsg && (
          <div
            className="message-reply-quote"
            onClick={() => {
              document.getElementById(`msg-${repliedMsg.id}`)?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <div className="reply-quote-content">
              <span className="reply-quote-sender">Ответ:</span>
              <span className="reply-quote-sender">
                {repliedMsg.sender_surname} {repliedMsg.sender_name}
              </span>
              <span className="reply-quote-text">
                {repliedMsg.text.startsWith("https://")
                  ? "📎 Файл/Медиа"
                  : repliedMsg.text.length > 50
                    ? repliedMsg.text.substring(0, 50) + "..."
                    : repliedMsg.text}
              </span>
            </div>
          </div>
        )}
        <div className="message-info" onClick={() => onPressProfile?.(message.sender_id)} style={{ cursor: "pointer" }}>
          {!isMe && message.sender_avatar && <img src={message.sender_avatar} className="mini-avatar" alt="avatar" />}
          <span className="sender-name">{`${message.sender_surname} ${message.sender_name}`}</span>
          {isMe && message.sender_avatar && <img src={message.sender_avatar} className="mini-avatar" alt="avatar" />}
        </div>

        {renderContent()}

        <div className="message-time">
          {message.updated_at &&
            new Date(message.updated_at).getTime() - new Date(message.created_at).getTime() > 1000 && (
              <span className="edited-mark">ред.</span>
            )}
          {new Date(
            message.updated_at && new Date(message.updated_at).getTime() - new Date(message.created_at).getTime() > 1000
              ? message.updated_at
              : message.created_at,
          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {", "}
          {new Date(
            message.updated_at && new Date(message.updated_at).getTime() - new Date(message.created_at).getTime() > 1000
              ? message.updated_at
              : message.created_at,
          ).toLocaleDateString([], { day: "numeric", month: "short" })}
        </div>
      </div>
    </div>
  );
}
