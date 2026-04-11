import { type DecryptedMessage } from "../types";
import "./Message.css";
import IoHeart from "../assets/Like.svg";
import { useModal } from "../context/ModalContext";

interface PropsMessage {
  message: DecryptedMessage;
  isMe: boolean;
  allMessages: DecryptedMessage[];
  onPressProfile?: (id: number) => void;
  onContextMenu?: (e: React.MouseEvent, msg: DecryptedMessage) => void;
  onLike?: (id: number) => void;
}

export default function Message({ message, isMe, onPressProfile, onContextMenu, onLike, allMessages }: PropsMessage) {
  const { showAlert } = useModal();
  const repliedMsg = message.reply_to_id
    ? allMessages.find(
        (m) =>
          Number(m.id) === Number(message.reply_to_id) ||
          (m.parent_id && Number(m.parent_id) === Number(message.reply_to_id)),
      )
    : null;

  const renderContent = () => {
    const rawText = message.text;
    const parts = rawText.split(":::TEXT:::");
    const fileUrl = parts[0];
    const caption = parts.length > 1 ? parts[1] : null;

    if (fileUrl.startsWith("https://api.livetouch.chat/photos/")) {
      return (
        <div className="media-container">
          <img src={fileUrl} alt="Shared" onClick={() => window.open(fileUrl, "_blank")} className="msg-image" />
          {caption && (
            <div className="msg-caption" style={{ color: isMe ? "#FFFFFF" : "black" }}>
              {caption}
            </div>
          )}
        </div>
      );
    }
    if (fileUrl.startsWith("https://api.livetouch.chat/video/")) {
      return (
        <div className="media-container">
          <video src={fileUrl} controls className="msg-video" />
          {caption && (
            <div className="msg-caption" style={{ color: isMe ? "#FFFFFF" : "black" }}>
              {caption}
            </div>
          )}
        </div>
      );
    }
    if (fileUrl.startsWith("https://api.livetouch.chat/files/")) {
      const fileName = fileUrl.split("/").pop();
      return (
        <div className="file-wrapper">
          <a href={fileUrl} target="_blank" rel="noreferrer" className="file-link">
            <div className="file-icon">📄</div>
            <div>
              <div className="file-name">{fileName}</div>
              <div className="file-sub">Скачать</div>
            </div>
          </a>
          {caption && (
            <div className="msg-caption" style={{ color: isMe ? "#FFFFFF" : "black" }}>
              {caption}
            </div>
          )}
        </div>
      );
    }
    return <span className="msg-text">{rawText}</span>;
  };

  return (
    <div
      id={`msg-${message.id}`}
      onContextMenu={(e) => onContextMenu?.(e, message)}
      className={`message-wrapper ${isMe ? "me" : "them"}`}
    >
      <div className="message-bubble">
        {message.reply_to_id && Number(message.reply_to_id) !== 0 && (
          <div
            className="message-reply-quote"
            onClick={() => {
              const targetId = `msg-${repliedMsg?.id}`;
              const targetElement = document.getElementById(targetId);
              if (targetElement) {
                targetElement.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                targetElement.classList.add("highlight-flash");
                setTimeout(() => {
                  targetElement.classList.remove("highlight-flash");
                }, 2000);
              } else {
                showAlert("Сообщение слишком старое и еще не подгружено", "Прокрутите чат вверх.");
              }
            }}
          >
            <div className="reply-quote-content">
              <span className="reply-quote-sender">Ответ:</span>
              <span className="reply-quote-sender">
                {repliedMsg ? `${repliedMsg.sender_surname} ${repliedMsg.sender_name}` : "Ответ на сообщение"}
              </span>
              <span className="reply-quote-text">
                {repliedMsg
                  ? repliedMsg.text.startsWith("https://")
                    ? "📎 Файл/Медиа"
                    : repliedMsg.text.length > 50
                      ? repliedMsg.text.substring(0, 50) + "..."
                      : repliedMsg.text
                  : "Догрузите историю сообщений"}
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
          {message.likes_count !== undefined && message.likes_count > 0 && (
            <div
              className={`message-like-tag ${message.is_liked ? "liked" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onLike?.(Number(message.id));
              }}
              style={{ marginLeft: "6px" }}
            >
              <img src={IoHeart} className="like-icon" alt="like" />
              <span className="like-count">{message.likes_count}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
