import React, { useState, useEffect } from "react";
import { getNearbyShopsService } from "../utils/locationService";
import { type Shop, type CartProduct } from "../types";
import "./NearbyShopsList.css";
import { isShopOpen } from "../utils/workingTime";
import LocationPicker from "./LocationPicker";
import { logError } from "../utils/logger";
import { useUser } from "../context/UserContext";
const NearbyShopsList: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CartProduct | null>(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "product" | "service">("all");
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [onlyDelivery, setOnlyDelivery] = useState(false);
  const [tempLocation, setTempLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { user } = useUser();
  useEffect(() => {
    handleSearch();
  }, []);

  useEffect(() => {
    setSelectedQuantity(1);
  }, [selectedProduct]);

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
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const activeShopId = cart.length > 0 ? cart[0].product.shop_id : null;
  const filteredShops = shops
    .filter((shop) => {
      if (activeShopId && shop.shop_id !== activeShopId) return false;
      return true;
    })
    .map((shop) => {
      const filteredProducts = shop.products.filter((product) => {
        const matchesType = filter === "all" || product.service_type === filter;
        const matchesDelivery = !onlyDelivery || product.delivery === true;
        return matchesType && matchesDelivery;
      });
      return { ...shop, products: filteredProducts };
    })
    .filter((shop) => shop.products.length > 0);
  const addToCart = (product: any, shopId: number, shopName: string) => {
    const isOtherShop = cart.length > 0 && cart[0].product.shop_id !== shopId;
    if (isOtherShop) {
      alert(`Сначала завершите заказ в "${cart[0].product.shop_name}" или очистите корзину.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + selectedQuantity } : item,
        );
      }
      return [
        ...prev,
        {
          product: { ...product, shop_id: shopId, shop_name: shopName },
          quantity: selectedQuantity,
        },
      ];
    });
    setSelectedProduct(null);
    setSelectedQuantity(1);
  };
  const removeFromCart = (productId: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) => (item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item));
      }
      return prev.filter((item) => item.product.id !== productId);
    });
  };
  // const clearCart = () => {
  //   if (window.confirm("Очистить корзину и показать все магазины?")) {
  //     setCart([]);
  //   }
  // };
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
      <div className="filter-bar">
        <div className="filter-buttons">
          <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            Все
          </button>
          <button className={`filter-btn ${filter === "product" ? "active" : ""}`} onClick={() => setFilter("product")}>
            Товары
          </button>
          <button className={`filter-btn ${filter === "service" ? "active" : ""}`} onClick={() => setFilter("service")}>
            Услуги
          </button>
          <label className={`delivery-toggle ${onlyDelivery ? "active" : ""}`}>
            <input type="checkbox" checked={onlyDelivery} onChange={() => setOnlyDelivery(!onlyDelivery)} />
            <span>🚚 Доставка</span>
          </label>
        </div>
        <div className="filter-right-section">
          <button className="cart-icon-btn" onClick={() => setIsCartModalOpen(true)}>
            🛒
            {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </button>
        </div>
      </div>
      <div className="shops-grid">
        {filteredShops.map((shop) => (
          <div key={shop.shop_id} className="shop-card">
            <div className="shop-info">
              <h3>
                {shop.shop_name} Рабочие часы {shop.opening_time} - {shop.closing_time}
              </h3>
              <p>📞 {shop.phone}</p>
              <div className="shop-distance">
                📍 {shop.distance < 1000 ? `${shop.distance} м` : `${(shop.distance / 1000).toFixed(1)} км`} от вас
              </div>
            </div>
            <div className="products-grid">
              {shop.products
                .filter((p) => filter === "all" || p.service_type === filter)
                .map((product) => (
                  <div
                    key={product.id}
                    className="product-card-mini"
                    onClick={() =>
                      setSelectedProduct({
                        ...product,
                        shop_id: shop.shop_id,
                        shop_name: shop.shop_name,
                      })
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <div className="product-image-container">
                      {product.delivery && <span className="delivery-tag">Доставка</span>}
                      <img src={product.image_url} alt={product.name} loading="lazy" />
                      <div className={`quantity-badge ${product.quantities <= 0 ? "out-of-stock" : ""}`}>
                        {product.quantities > 0 && `Кол-во: ${product.quantities}`}
                      </div>
                    </div>
                    <div className="product-details">
                      <div className="product-main-info">
                        <div className="product-price-mini">{product.price} ₽</div>
                        <div className="product-name-mini">{product.name}</div>
                      </div>
                      <div className="product-name-mini-description">{product.description}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      {selectedProduct && (
        <div className="product-modal-backdrop" onClick={() => setSelectedProduct(null)}>
          <div className="product-modal-content full-view" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedProduct(null)}>
              ×
            </button>
            <div className="modal-body-layout">
              <div className="modal-image-side">
                <img src={selectedProduct.image_url} alt={selectedProduct.name} />
              </div>
              <div className="modal-info-side">
                <div className="modal-header-info">
                  <span className="modal-price">{selectedProduct.price} ₽</span>
                  <h2>{selectedProduct.name}</h2>
                </div>
                <div className="modal-description-full">
                  <h4>Описание</h4>
                  <p>{selectedProduct.description}</p>
                </div>
                <div className="modal-actions">
                  <div className="quantity-controls">
                    <button className="qty-btn" onClick={() => setSelectedQuantity((q) => Math.max(1, q - 1))}>
                      —
                    </button>

                    <span className="qty-number">{selectedQuantity}</span>

                    <button className="qty-btn" onClick={() => setSelectedQuantity((q) => q + 1)}>
                      +
                    </button>
                  </div>

                  <button
                    className="btn-add-to-cart"
                    onClick={() => {
                      addToCart(selectedProduct, selectedProduct.shop_id, selectedProduct.shop_name);
                    }}
                  >
                    Добавить за {(selectedProduct.price * selectedQuantity).toFixed(2)} ₽
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {isCartModalOpen && (
        <div className="product-modal-backdrop" onClick={() => setIsCartModalOpen(false)}>
          <div className="product-modal-content cart-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cart-modal-header">
              <h3>Ваша корзина</h3>
              <button className="close-cart" onClick={() => setIsCartModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="cart-items-list">
              {cart.length === 0 ? (
                <p className="empty-cart-msg">В корзине пока пусто</p>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="cart-item-row">
                    <img src={item.product.image_url} alt="" className="cart-item-img" />
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.product.name}</div>
                      <div className="cart-item-meta">
                        {item.quantity} шт. × {item.product.price} ₽
                      </div>
                    </div>
                    <div className="cart-item-actions">
                      <button className="delete-item-btn" onClick={() => removeFromCart(item.product.id)}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="cart-modal-footer">
                <div className="cart-total-section">
                  <span>Итого:</span>
                  <span className="total-amount">{totalPrice.toFixed(2)} ₽</span>
                </div>
                <button
                  className="btn-checkout"
                  onClick={() => {
                    console.log("Оформление заказа", cart);
                    setCart([]);
                    setSelectedProduct(null);
                    setIsCartModalOpen(false);
                  }}
                >
                  Оформить заказ
                </button>
              </div>
            )}
          </div>
        </div>
      )}
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
