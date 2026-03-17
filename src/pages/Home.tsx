import { useState } from "react";
import Feedback from "../components/Feedback";
import "./Home.css";

export default function Home() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  return (
    <div className="home-screen">
      <h1>Главная (Новости)</h1>
      <p>Мессенджер в разработке...</p>

      <button className="feedback-trigger-btn" onClick={() => setIsFeedbackOpen(true)}>
        Написать в поддержку
      </button>

      {isFeedbackOpen && <Feedback onClose={() => setIsFeedbackOpen(false)} />}
    </div>
  );
}
