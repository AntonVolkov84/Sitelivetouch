import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { useUser } from "./UserContext";
import { useUnread } from "./UnreadContext";
import { api } from "../../axiosinstance";
import { useNavigate } from "react-router-dom";

type SignalMessage =
  | { type: "offer"; sender: number; chatId: number; offer: RTCSessionDescriptionInit; timestamp?: number }
  | { type: "answer"; sender: number; chatId: number; answer: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; sender: number; chatId: number; candidate: RTCIceCandidateInit }
  | { type: "call-ended"; sender: number; chatId: number };

type WSContextType = {
  ws: WebSocket | null;
  signals: SignalMessage[];
  consumeSignal: (predicate: (s: SignalMessage) => boolean) => SignalMessage | undefined;
  isIncomingWS: boolean;
  wsReady: boolean;
  setIsIncoming: React.Dispatch<React.SetStateAction<boolean>>;
  setIsInCall: React.Dispatch<React.SetStateAction<boolean>>;
};

const WSContext = createContext<WSContextType | null>(null);

export const WSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const { addUnread } = useUnread();
  const navigate = useNavigate();

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [wsReady, setWsReady] = useState(false);
  const [isIncomingWS, setIsIncoming] = useState(false);
  const [signals, setSignals] = useState<SignalMessage[]>([]);
  const [isInCall, setIsInCall] = useState(false);

  const signalsQueue = useRef<SignalMessage[]>([]);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const isInCallRef = useRef(false);

  useEffect(() => {
    isInCallRef.current = isInCall;
  }, [isInCall]);

  // Управление звуком (Web Audio API)
  const playRingtone = () => {
    if (!ringtoneRef.current) {
      ringtoneRef.current = new Audio("/assets/ringtone.mp3"); // Файл должен лежать в public/assets/
      ringtoneRef.current.loop = true;
    }
    ringtoneRef.current.play().catch((e) => console.log("Audio play failed:", e));
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  };

  const getUserProfile = async (id: number) => {
    try {
      const res = await api.get(`/auth/${id}/profile`);
      return res.data;
    } catch (err) {
      console.error("WS Context getUserProfile error", err);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    let socket: WebSocket | null = null;
    let reconnectAttempts = 0;
    let closedByUser = false;

    const connect = () => {
      console.log("WS connecting...");
      socket = new WebSocket("wss://api.livetouch.chat/ws");

      socket.onopen = () => {
        console.log("WS opened");
        reconnectAttempts = 0;
        setWsReady(true);
        socket?.send(JSON.stringify({ userId: user.id, type: "init" }));
        setWs(socket);
      };

      socket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          // Новое сообщение
          if (data.type === "message_new" && data.chat_id && data.sender_id !== user.id) {
            addUnread(data.chat_id);
          }

          // Логика звонков (Сигналинг)
          if (["offer", "answer", "ice-candidate", "call-ended"].includes(data.type)) {
            if (data.type === "offer") {
              const now = Date.now();
              const serverTime = data.timestamp || now;
              if (!isInCallRef.current && now - serverTime < 5000) {
                const senderProfile = await getUserProfile(data.sender);
                playRingtone();
                setIsIncoming(true);

                // Браузерный confirm (потом заменим на красивую модалку)
                if (
                  window.confirm(`Входящий звонок от: ${senderProfile.usersurname} ${senderProfile.username}. Принять?`)
                ) {
                  stopRingtone();
                  setIsInCall(true);
                  navigate(`/call/${data.chatId}?callerId=${data.sender}&isIncoming=true`);
                } else {
                  stopRingtone();
                  setIsIncoming(false);
                }
              }
            }

            if (data.type === "call-ended") {
              stopRingtone();
              setIsIncoming(false);
              setIsInCall(false);
              setSignals([]);
              signalsQueue.current = [];
            }

            setSignals((prev) => [...prev, data]);
            signalsQueue.current.push(data);
          }
        } catch (err) {
          console.error("WS message parse error:", err);
        }
      };

      socket.onclose = () => {
        setWsReady(false);
        setWs(null);
        if (!closedByUser) {
          reconnectAttempts++;
          const delay = Math.min(10000, 1000 * 2 ** reconnectAttempts);
          setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      closedByUser = true;
      socket?.close();
    };
  }, [user?.id]);

  const consumeSignal = (predicate: (s: SignalMessage) => boolean) => {
    const idx = signalsQueue.current.findIndex(predicate);
    if (idx === -1) return undefined;
    const [found] = signalsQueue.current.splice(idx, 1);
    return found;
  };

  return (
    <WSContext.Provider value={{ ws, signals, consumeSignal, isIncomingWS, wsReady, setIsIncoming, setIsInCall }}>
      {children}
    </WSContext.Provider>
  );
};

export const useWS = () => {
  const context = useContext(WSContext);
  if (!context) throw new Error("useWS must be used within a WSProvider");
  return context;
};
