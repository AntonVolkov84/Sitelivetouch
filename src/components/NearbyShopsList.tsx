import React, { useState, useEffect } from "react";
import { getNearbyShopsService } from "../utils/locationService";
import { type Shop } from "../types";
import "./NearbyShopsList.css";
import { isShopOpen } from "../utils/workingTime";
import LocationPicker from "./LocationPicker";
import { logError } from "../utils/logger";
import { useUser } from "../context/UserContext";
const NearbyShopsList: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [tempLocation, setTempLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { user } = useUser();
  useEffect(() => {
    handleSearch();
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const result = await getNearbyShopsService();
      const activeShops = (result.shops || []).filter((shop: Shop) => isShopOpen(shop.opening_time, shop.closing_time));
      setShops(activeShops);
      if (result.coords) {
        setTempLocation({
          lat: result.coords.latitude,
          lng: result.coords.longitude,
        });
      }
      if (result.isLowAccuracy) {
        setIsMapModalOpen(true);
      }
    } catch (err: any) {
      if (user) {
        logError(user.email, "WEB_NearbyShopsList: handleSearch", err);
      }
      console.log(err.message || "Произошла ошибка");
    } finally {
      setLoading(false);
    }
  };
  const handleSearchWithNewCoords = async () => {
    if (!tempLocation) return;
    setLoading(true);
    setIsMapModalOpen(false);
    try {
      const response = await fetch(
        `https://api.livetouch.chat/seller/shops/nearby?lat=${tempLocation.lat}&lng=${tempLocation.lng}`,
      );
      const result = await response.json();
      if (result.status === "success") {
        const activeShops = (result.shops || result.data || []).filter((shop: Shop) =>
          isShopOpen(shop.opening_time, shop.closing_time),
        );
        setShops(activeShops);
      }
    } catch (err) {
      if (user) {
        logError(user.email, "WEB_NearbyShopsList: handleSearchWithNewCoords", err);
      }
      console.log("Ошибка при поиске по новым координатам", err);
    } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
        <p>Сканируем окрестности...</p>
      </div>
    );
  }

  return (
    <div className="nearby-page">
      <div className="nearby-header">
        <h2>Магазины поблизости</h2>
        <button onClick={() => setIsMapModalOpen(true)} className="refresh-btn">
          📍 Уточнить место
        </button>
        <button onClick={handleSearch} className="refresh-btn">
          🔄 Обновить
        </button>
      </div>

      <div className="shops-grid">
        {shops.map((shop) => (
          <div key={shop.shop_id} className="shop-card">
            <div className="shop-info">
              <h3>{shop.shop_name}</h3>
              <p>📞 {shop.phone}</p>
              <div className="shop-distance">
                📍 {shop.distance < 1000 ? `${shop.distance} м` : `${(shop.distance / 1000).toFixed(1)} км`} от вас
              </div>
            </div>
            <div className="products-grid">
              {shop.products.map((product) => (
                <div key={product.id} className="product-card-mini">
                  <div className="product-image-container">
                    <img src={product.image_url} alt={product.name} loading="lazy" />
                    <div className={`quantity-badge ${product.quantities <= 0 ? "out-of-stock" : ""}`}>
                      {product.quantities > 0 && `Количество или вес: ${product.quantities}`}
                    </div>
                  </div>
                  <div className="product-details">
                    <span className="product-name-mini">{product.name}</span>
                    <div className="product-meta-mini">
                      <strong className="product-price-mini">{product.price} грн</strong>
                    </div>
                    <span className="product-name-mini-decription">{product.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {isMapModalOpen && tempLocation && (
        <div className="product-modal-backdrop">
          <div className="product-modal-content map-modal">
            <h3>Проверьте адрес</h3>
            <div className="modal-map-wrapper">
              <LocationPicker
                initialPos={[tempLocation.lat, tempLocation.lng]}
                onLocationSelect={(lat, lng) => setTempLocation({ lat, lng })}
              />
            </div>
            <div className="product-modal-footer">
              <button className="btn-cancel" onClick={() => setIsMapModalOpen(false)}>
                Отмена
              </button>
              <button className="btn-save" onClick={handleSearchWithNewCoords}>
                Искать здесь
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NearbyShopsList;
