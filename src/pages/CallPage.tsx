import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useWS } from "../context/WsContext";
import { useUser } from "../context/UserContext";
import { useLocation } from "react-router-dom";

export default function CallPage() {
  const { chatId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialOffer = location.state?.offer;

  const callerId = Number(searchParams.get("callerId"));
  const isIncoming = searchParams.get("isIncoming") === "true";

  const { ws, consumeSignal, signals, setIsInCall } = useWS();
  const { user } = useUser();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallProcessing, setIsCallProcessing] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const processedOfferRef = useRef(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteIceCandidatesBuffer = useRef<RTCIceCandidateInit[]>([]);

  const pc = useRef<RTCPeerConnection>(
    new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: ["turn:5.35.95.26:3478?transport=udp", "turn:5.35.95.26:3478?transport=tcp"],
          username: "myuser",
          credential: "mypassword",
        },
      ],
    })
  );

  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 640, height: 480 },
      });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream
        .getTracks()
        .sort((a, b) => (a.kind === "audio" ? -1 : 1))
        .forEach((track) => {
          console.log(`Отправляем трек в PC: ${track.kind}`);
          pc.current.addTrack(track, stream);
        });
      if (!isIncoming) {
        startCall();
      }
    } catch (err) {
      console.error("Error getting local stream:", err);
    }
  };
  useEffect(() => {
    const processInitialOffer = async () => {
      // Добавляем проверку processedOfferRef
      if (isIncoming && initialOffer && !processedOfferRef.current && ws?.readyState === WebSocket.OPEN) {
        processedOfferRef.current = true;
        try {
          console.log("Устанавливаем RemoteDescription (Offer)");
          await pc.current.setRemoteDescription(new RTCSessionDescription(initialOffer));

          const answer = await pc.current.createAnswer();
          await pc.current.setLocalDescription(answer);

          ws.send(
            JSON.stringify({
              type: "answer",
              target: callerId,
              sender: user!.id,
              answer,
              chatId: Number(chatId),
            })
          );

          setIsCallProcessing(true);

          // ВАЖНО: Прокидываем накопившиеся ICE-кандидаты
          console.log("Добавляем кандидаты из буфера:", remoteIceCandidatesBuffer.current.length);
          while (remoteIceCandidatesBuffer.current.length > 0) {
            const cand = remoteIceCandidatesBuffer.current.shift();
            if (cand) await pc.current.addIceCandidate(cand);
          }
        } catch (err) {
          console.error("Ошибка при ответе на звонок:", err);
        }
      }
    };

    if (localStream && ws) {
      processInitialOffer();
    }
  }, [localStream, ws, ws?.readyState, initialOffer]);
  useEffect(() => {
    pc.current.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    pc.current.onicecandidate = (event) => {
      if (event.candidate && ws && user) {
        ws.send(
          JSON.stringify({
            type: "ice-candidate",
            target: callerId,
            sender: user.id,
            candidate: event.candidate,
            chatId: Number(chatId),
          })
        );
      }
    };

    initLocalStream();
    setIsInCall(true);

    return () => {
      setIsInCall(false);
    };
  }, []);

  useEffect(() => {
    const handleSignals = async () => {
      const signal = consumeSignal((s) => s.sender === callerId);
      if (!signal) return;
      try {
        if (signal.type === "offer") {
          if (isIncoming && initialOffer) return;
          await pc.current.setRemoteDescription(new RTCSessionDescription(signal.offer));
          const answer = await pc.current.createAnswer();
          await pc.current.setLocalDescription(answer);
          ws?.send(
            JSON.stringify({ type: "answer", target: callerId, sender: user!.id, answer, chatId: Number(chatId) })
          );
          setIsCallProcessing(true);
        }
        if (signal.type === "answer") {
          await pc.current.setRemoteDescription(new RTCSessionDescription(signal.answer));
          while (remoteIceCandidatesBuffer.current.length > 0) {
            const cand = remoteIceCandidatesBuffer.current.shift();
            await pc.current.addIceCandidate(cand);
          }
        }
        if (signal.type === "ice-candidate") {
          if (pc.current.remoteDescription) {
            await pc.current.addIceCandidate(signal.candidate);
          } else {
            remoteIceCandidatesBuffer.current.push(signal.candidate);
          }
        }

        if (signal.type === "call-ended") {
          endCall(false);
        }
      } catch (err) {
        console.error("Signal error:", err);
      }
    };

    handleSignals();
  }, [signals]);

  const startCall = async () => {
    if (!ws) {
      console.error("Ошибка: WebSocket не подключен!");
      return;
    }
    try {
      setIsCallProcessing(true);
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      const message = {
        type: "offer",
        target: callerId,
        sender: user!.id,
        offer,
        chatId: Number(chatId),
      };
      ws.send(JSON.stringify(message));
    } catch (err) {
      console.error("Ошибка в startCall:", err);
    }
  };

  const handleBack = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (pc.current) {
      pc.current.close();
    }
    setIsInCall(false);
    navigate("/chat");
  };

  const endCall = (sendSignal = true) => {
    if (sendSignal && ws && user) {
      ws.send(JSON.stringify({ type: "call-ended", chatId: Number(chatId), sender: user.id, target: callerId }));
    }
    localStream?.getTracks().forEach((t) => t.stop());
    pc.current.close();
    navigate("/");
  };

  return (
    <div className="call-page" style={{ height: "100vh", background: "#000", color: "#fff", position: "relative" }}>
      <button
        onClick={handleBack}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          zIndex: 100,
          background: "rgba(255,255,255,0.2)",
          border: "none",
          color: "white",
          padding: "10px 20px",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        ← Назад
      </button>
      <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "200px",
          position: "absolute",
          top: "20px",
          right: "20px",
          border: "2px solid #fff",
          borderRadius: "10px",
          transform: "scaleX(-1)",
        }}
      />
      <div style={{ position: "absolute", bottom: "40px", width: "100%", textAlign: "center" }}>
        <button
          onClick={() => endCall(true)}
          style={{
            padding: "15px 30px",
            background: "red",
            color: "white",
            borderRadius: "30px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Завершить звонок
        </button>
      </div>
    </div>
  );
}
