import React, { useState, useEffect } from "react";
import { api } from "../../axiosinstance";
import { useUser } from "../context/UserContext";
import { logError } from "../utils/logger";
import "./ProfileView.css";
import { useModal } from "../context/ModalContext";

interface ProfileViewProps {
  onBack: () => void;
}

export default function ProfileView({ onBack }: ProfileViewProps) {
  const { user, setUser } = useUser();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [surname, setSurname] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [uploading, setUploading] = useState(false);
  const { showAlert } = useModal();

  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setSurname(user.usersurname || "");
      setPhone(user.phone || "");
      setBio(user.bio || "");
      setLoading(false);
    }
  }, [user]);

  const sanitizeInput = (text: string) =>
    text
      .replace(/<[^>]*>?/gm, "")
      .replace(/script/gi, "")
      .trim();

  const handlePickImage = () => {
    document.getElementById("avatarInput")?.click();
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    const extension = file.name.split(".").pop();
    const filename = `avatar-${user?.id || "web"}-${Date.now()}.${extension}`;
    formData.append("file", file);
    formData.append("bucket", "avatars");
    formData.append("filename", filename);
    try {
      const res = await api.post("/upload", formData);
      const newUrl = res.data.url;
      console.log("Файл загружен, URL:", newUrl);
      await api.put("/auth/update-avatar", { avatar_url: newUrl });
      if (user) setUser({ ...user, avatar_url: newUrl });
      showAlert("Успех", "Ваш аватар успешно обновлен!");
    } catch (err: any) {
      console.error("Upload error detail:", err.response?.data || err.message);
      showAlert("Ошибка загрузки", `Статус ${err.response?.data || err.message}`);
      if (user) {
        logError(user.email, "WEB_ProfileView: uploadAvatar", err);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const updateProfile = async () => {
    const payload = {
      username: sanitizeInput(username),
      surname: sanitizeInput(surname),
      bio: sanitizeInput(bio),
      phone: phone.replace(/[^\d+ -]/g, ""),
    };

    try {
      await api.put("/auth/update-profile", payload);
      if (user) setUser({ ...user, ...payload });
      showAlert("Обновление", "Данные профиля успешно сохранены");
    } catch (err: any) {
      console.error("Ошибка обновления профиля:", err);
      showAlert("Ошибка", "Не удалось обновить данные профиля");
      if (user) {
        logError(user.email, "WEB_ProfileView: updateProfile", err);
      }
    }
  };

  if (loading) return <div style={{ padding: "20px" }}>Загрузка...</div>;

  return (
    <div className="profile-view">
      <header className="profile-view__header">
        <button onClick={onBack} className="profile-view__back-btn">
          ← Назад
        </button>
        <h4 className="profile-view__title">Профиль</h4>
      </header>
      <div className="profile-view__content">
        <div className="profile-view__avatar-section" onClick={handlePickImage}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Avatar" className="profile-view__avatar-img" />
          ) : (
            <div className="profile-view__avatar-placeholder">{user?.username?.[0]?.toUpperCase()}</div>
          )}
          {uploading && <div className="profile-view__loader-overlay">...</div>}
          <input type="file" id="avatarInput" hidden accept="image/*" onChange={uploadAvatar} />
        </div>
        <div className="profile-view__form">
          <label className="profile-view__label">Имя</label>
          <input className="profile-view__input" value={username} onChange={(e) => setUsername(e.target.value)} />
          <label className="profile-view__label">Фамилия</label>
          <input className="profile-view__input" value={surname} onChange={(e) => setSurname(e.target.value)} />
          <label className="profile-view__label">Email (не редактируется)</label>
          <input className="profile-view__input profile-view__input--disabled" value={user?.email} disabled />
          <label className="profile-view__label">Телефон</label>
          <input className="profile-view__input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label className="profile-view__label">О себе</label>
          <textarea className="profile-view__textarea" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
      </div>
      <footer className="profile-view__footer">
        <button onClick={updateProfile} className="profile-view__save-btn">
          Сохранить
        </button>
      </footer>
    </div>
  );
}
