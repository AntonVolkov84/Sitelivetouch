import { api } from "../../axiosinstance";

export const logError = async (message: string, functionName?: string, error?: any) => {
  try {
    const browserInfo = {
      userAgent: navigator.userAgent,
      url: window.location.href,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
    };
    const payload = {
      message: message,
      functionName: `WEB ${functionName}` || "WEB unknown",
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error
          ? JSON.stringify(error)
          : "no error",
      timestamp: new Date().toISOString(),
      context: browserInfo,
    };
    await api.post("/errors/log", payload);
  } catch (err) {
    console.error("Критическая ошибка логгера:", err);
  }
};
