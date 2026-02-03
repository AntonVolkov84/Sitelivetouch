import { useNavigate } from "react-router-dom";
import { useWS } from "../context/WsContext";
import "./IncomingCallModal.css";

export default function IncomingCallModal() {
  const { signals, consumeSignal, stopRingtone, setIsInCall } = useWS();
  const navigate = useNavigate();
  const incomingOffer = signals.find((s) => s.type === "offer");
  if (!incomingOffer) return null;
  const handleAccept = () => {
    stopRingtone();
    setIsInCall(true);
    consumeSignal((s) => s.type === "offer");
    navigate(`/call/${incomingOffer.chatId}?callerId=${incomingOffer.sender}&isIncoming=true`, {
      state: { offer: incomingOffer.offer },
    });
  };

  const handleDecline = () => {
    stopRingtone();
    consumeSignal((s) => s.type === "offer");
  };

  return (
    <div className="call-modal-overlay">
      <div className="call-modal-container">
        <h3>Входящий звонок</h3>
        <p>Пользователь {incomingOffer.callerName}</p>

        <div className="call-modal-buttons">
          <button className="btn-accept" onClick={handleAccept}>
            Принять
          </button>
          <button className="btn-decline" onClick={handleDecline}>
            Отклонить
          </button>
        </div>
      </div>
    </div>
  );
}
