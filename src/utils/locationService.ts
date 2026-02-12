import { type Shop, type ApiResponse } from "../types";
const ACCURACY_THRESHOLD = 1000;

interface LocationResult {
  shops: Shop[];
  coords: { latitude: number; longitude: number };
  isLowAccuracy: boolean;
  message?: string;
}

export const getNearbyShopsService = async (): Promise<LocationResult> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Геолокация не поддерживается"));
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const isLowAccuracy = accuracy > ACCURACY_THRESHOLD;

        try {
          const response = await fetch(
            `https://api.livetouch.chat/seller/shops/nearby?lat=${latitude}&lng=${longitude}`,
          );

          if (!response.ok) throw new Error("Ошибка сети");

          const result: ApiResponse = await response.json();

          resolve({
            shops: result.data,
            coords: { latitude, longitude },
            isLowAccuracy,
            message: result.message,
          });
        } catch (err) {
          reject(new Error("Не удалось загрузить данные с сервера"));
        }
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
};
