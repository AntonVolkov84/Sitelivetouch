import { type DecryptedMessage } from "../types";

interface PropsMessage {
  message: DecryptedMessage;
  isMe: boolean;
  onPressProfile?: (id: number) => void;
}

export default function Message({ message, isMe, onPressProfile }: PropsMessage) {
  const renderContent = () => {
    const text = message.text;

    if (text.startsWith("https://api.livetouch.chat/photos/")) {
      return <img src={text} alt="photo" className="msg-media" />;
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

    if (text.startsWith("https://api.livetouch.chat/video/")) {
      return <video src={text} controls className="msg-media" />;
    }

    return <span className="msg-text">{text}</span>;
  };

  return (
    <div className={`message-wrapper ${isMe ? "me" : "them"}`}>
      <div className="message-bubble">
        <div className="message-info" onClick={() => onPressProfile?.(message.sender_id)}>
          {!isMe && message.sender_avatar && <img src={message.sender_avatar} className="mini-avatar" />}
          <span className="sender-name">{`${message.sender_surname} ${message.sender_name}`}</span>
          {isMe && message.sender_avatar && <img src={message.sender_avatar} className="mini-avatar" />}
        </div>

        {renderContent()}

        <div className="message-time">
          {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
