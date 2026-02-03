import axios from "axios";

export const api = axios.create({
  baseURL: "https://api.livetouch.chat",
  timeout: 40000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem("accessToken");
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ЛОГ ДЛЯ ТЕБЯ:
    console.log("=== Ошибка в интерцепторе ===");
    console.log("Статус:", error.response?.status);
    console.log("Таймаут/Сеть:", error.code === "ECONNABORTED" || !error.response);

    if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
      originalRequest._retry = true;
      console.log("Пытаюсь обновить токен...");

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");

        // ВАЖНО: используем axios (не api), чтобы не зациклиться
        const res = await axios.post(
          "https://api.livetouch.chat/auth/refresh",
          {
            token: refreshToken,
          },
          { timeout: 30000 },
        ); // Даем рефрешу много времени!

        const { accessToken: newAccessToken } = res.data;
        localStorage.setItem("accessToken", newAccessToken);

        console.log("Токен обновлен успешно!");
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError: any) {
        console.error("Рефреш не удался:", refreshError);
        // Очищаем ТОЛЬКО если сервер подтвердил, что рефреш-токен сдох
        if (refreshError.response?.status === 401) {
          localStorage.clear(); // Или удаляй по списку
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);
