import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { useModal } from "../context/ModalContext";
import { api } from "../../axiosinstance";
import "./RegisterSeller.css";
import LocationPicker from "../components/LocationPicker";
import { logError } from "../utils/logger";
import { type IProduct } from "../types";

export default function RegisterSeller() {
  const { user, loading } = useUser();
  const { showAlert, showConfirm } = useModal();
  const [step, setStep] = useState(1);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    phone: "",
    shop_name: "",
    opening_time: "09:00",
    closing_time: "20:00",
    payment_details: "",
    location_lat: 50.4501,
    location_lng: 30.5234,
    geohash: "",
  });
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    description: "",
    image: null as File | null,
    preview: "",
    quantities: "1.000",
  });
  const sanitizeInput = (val: string) => val.replace(/<[^>]*>?/gm, "").trim();
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewProduct({
        ...newProduct,
        image: file,
        preview: URL.createObjectURL(file),
      });
    }
  };
  const handleLocationChange = (lat: number, lng: number, hash: string) => {
    setFormData((prev) => ({
      ...prev,
      location_lat: lat,
      location_lng: lng,
      geohash: hash,
    }));
  };

  const handleStepOne = async () => {
    const cleanPhone = formData.phone.replace(/[^\d+]/g, "");
    const phoneRegex = /^\+?\d{10,15}$/;
    if (!phoneRegex.test(cleanPhone)) {
      showAlert("Ошибка", "Введите корректный номер телефона (мин. 10 цифр)");
      return;
    }
    try {
      const response = await api.post("/seller/init-seller", {
        phone: cleanPhone,
      });
      if (response.data.success) {
        setStep(3);
      }
    } catch (err: any) {
      if (user) {
        logError(user.email, "WEB_RegisterSeller: handleStepOne", err);
      }
      const errorMsg = err.response?.data?.error || "Не удалось сохранить телефон";
      showAlert("Ошибка", errorMsg);
    }
  };
  useEffect(() => {
    if (user?.role === "seller") {
      const fetchProfile = async () => {
        try {
          const res = await api.get("/seller/profile");
          if (res.data.success) {
            console.log(res.data);
            setFormData(res.data.profile);
          }
        } catch (err: any) {
          if (user) {
            logError(user.email, "WEB_RegisterSeller: fetchProfile", err);
          }
          console.error("Ошибка загрузки профиля", err);
        }
      };
      const fetchProducts = async () => {
        try {
          const res = await api.get("/seller/products");
          if (res.data.success) {
            setProducts(res.data.products);
          }
        } catch (err) {
          console.error("Ошибка загрузки товаров", err);
        }
      };
      fetchProducts();
      fetchProfile();
    }
  }, [user]);
  const handleChangeData = async () => {
    try {
      const cleanShopName = sanitizeInput(formData.shop_name);
      if (!cleanShopName) {
        showAlert("Ошибка", "Название магазина не может быть пустым");
        return;
      }
      const dataToSave = {
        ...formData,
        shop_name: cleanShopName,
        payment_details: sanitizeInput(formData.payment_details),
      };
      const response = await api.put("/seller/complete-registration", dataToSave);
      if (response.data.success) {
        showAlert("Успех", "Данные профиля обновлены!");
      }
    } catch (err: any) {
      if (user) {
        logError(user.email, "WEB_RegisterSeller: handleChangeData", err);
      }
      console.log("handleChangeData", err);
    }
  };
  const handleFinish = () => {
    if (!formData.shop_name) {
      showAlert("Внимание", "Введите название магазина");
      return;
    }
    showConfirm(
      "Регистрация",
      "Данные верны? Отправить анкету?",
      async () => {
        try {
          const response = await api.put("/seller/complete-registration", formData);
          if (response.data.success) {
            showAlert("Успех", "Ваш профиль продавца активирован!");
            setTimeout(() => window.location.reload(), 2000);
          }
        } catch (err: any) {
          if (user) {
            logError(user.email, "WEB_RegisterSeller: handleFinish", err);
          }
          showAlert("Ошибка", err.response?.data?.error || "Не удалось завершить регистрацию");
        }
      },
      "Отправить",
    );
  };
  const handleCloseModal = () => {
    setIsProductModalOpen(false);
    setEditingProductId(null);
    setNewProduct({
      name: "",
      price: "",
      description: "",
      image: null,
      preview: "",
      quantities: "1.000",
    });
  };
  const saveProduct = async () => {
    setIsSubmitting(true);
    const cleanName = sanitizeInput(newProduct.name);
    const cleanDesc = sanitizeInput(newProduct.description);
    const priceNum = parseFloat(newProduct.price);
    const qtyNum = parseFloat(newProduct.quantities);
    if (!cleanName || cleanName.length < 2) {
      setIsSubmitting(false);
      return showAlert("Ошибка", "Название слишком короткое");
    }
    if (cleanName.length > 30) {
      setIsSubmitting(false);
      return showAlert("Ошибка", "Название не должно превышать 30 символов");
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setIsSubmitting(false);
      return showAlert("Ошибка", "Введите корректную цену выше 0");
    }
    if (isNaN(qtyNum) || qtyNum < 0) {
      setIsSubmitting(false);
      return showAlert("Ошибка", "Количество не может быть отрицательным");
    }
    if (newProduct.image && newProduct.image.size > 5 * 1024 * 1024) {
      setIsSubmitting(false);
      return showAlert("Ошибка", "Размер фото не должен превышать 5МБ");
    }
    const data = new FormData();
    data.append("name", cleanName);
    data.append("price", priceNum.toString());
    data.append("description", cleanDesc);
    data.append("quantities", qtyNum.toString());
    if (newProduct.image) {
      data.append("image", newProduct.image);
    }
    try {
      let response;
      if (editingProductId) {
        response = await api.put(`/seller/products/${editingProductId}`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        response = await api.post("/seller/products", data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      if (response.data.success) {
        const savedProduct = response.data.product;
        setProducts((prev) =>
          editingProductId ? prev.map((p) => (p.id === editingProductId ? savedProduct : p)) : [savedProduct, ...prev],
        );
        handleCloseModal();
        showAlert("Успех", editingProductId ? "Товар обновлен!" : "Товар добавлен!");
      }
    } catch (err: any) {
      logError(user?.email || "unknown", "saveProduct", err);
      showAlert("Ошибка", err.response?.data?.error || "Не удалось сохранить товар");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = (productId: number) => {
    showConfirm(
      "Удаление товара",
      "Вы уверены, что хотите удалить этот товар? Это действие нельзя отменить.",
      async () => {
        try {
          const response = await api.delete(`/seller/products/${productId}`);
          if (response.data.success) {
            setProducts((prev) => prev.filter((p: any) => p.id !== productId));
            showAlert("Успех", "Товар успешно удален");
          }
        } catch (err: any) {
          if (user) {
            logError(user.email, "WEB_RegisterSeller: handleDeleteProduct", err);
          }
          const errorMsg = err.response?.data?.error || "Не удалось удалить товар";
          showAlert("Ошибка", errorMsg);
        }
      },
      "Удалить",
    );
  };
  const handleEditClick = (product: IProduct) => {
    setEditingProductId(product.id);
    setNewProduct({
      name: product.name,
      price: product.price,
      description: product.description,
      quantities: product.quantities,
      image: null,
      preview: product.image_url || "",
    });
    setIsProductModalOpen(true);
  };
  if (loading) {
    return (
      <div className="loading-container">
        <p>Загрузка данных профиля...</p>
      </div>
    );
  }
  if (user?.role === "seller") {
    return (
      <div className="seller-dashboard-layout">
        <aside className="seller-dashboard__sidebar">
          <div className="seller-sidebar-header">
            <h3>Управление магазином</h3>
          </div>

          <div className="seller-settings-form">
            <div className="setting-group">
              <label>Название</label>
              <input
                type="text"
                value={formData.shop_name}
                onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                className="sidebar-input"
              />
            </div>
            <div className="setting-group">
              <label>Время работы</label>
              <div className="time-row">
                <input
                  type="time"
                  value={formData.opening_time}
                  onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                />
                <span>-</span>
                <input
                  type="time"
                  value={formData.closing_time}
                  onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                />
              </div>
            </div>
            <div className="setting-group">
              <label>Реквизиты</label>
              <textarea
                value={formData.payment_details}
                onChange={(e) => setFormData({ ...formData, payment_details: e.target.value })}
              />
            </div>
            <div className="setting-group">
              <label>Местоположение</label>
              <div className="sidebar-map-container">
                <LocationPicker
                  onLocationSelect={handleLocationChange}
                  initialPos={[formData.location_lat, formData.location_lng]}
                />
              </div>
              <p className="location-hint">Кликните по карте, чтобы изменить адрес</p>
            </div>
            <button
              className="save-settings-btn"
              onClick={() => {
                handleChangeData();
              }}
            >
              Сохранить изменения
            </button>
          </div>
        </aside>
        <main className="seller-dashboard__content">
          <header className="content-header">
            <h2>Все товары</h2>
            <button className="add-product-btn" onClick={() => setIsProductModalOpen(true)}>
              + Добавить товар
            </button>
          </header>
          <div className="products-placeholder">
            <div className="products-grid">
              {products.map((p: any) => (
                <div key={p.id} className="product-card">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} />
                  ) : (
                    <div className="img-placeholder">Нет фото</div>
                  )}
                  <h4>{p.name}</h4>
                  <p className="price">{p.price} грн</p>
                  <p className="qty">Количество: {parseFloat(p.quantities).toFixed(3)} кг/шт</p>
                  <div className="product-card-actions">
                    <button className="edit-btn" onClick={() => handleEditClick(p)}>
                      Редактировать
                    </button>
                    <button className="delete-btn" onClick={() => handleDeleteProduct(p.id)}>
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
        {isProductModalOpen && (
          <div className="product-modal-backdrop">
            <div className="product-modal-content">
              <h3>{editingProductId ? "Редактировать товар" : "Добавить новый товар"}</h3>
              <div className="product-modal-body">
                <div className="image-upload-section">
                  {newProduct.preview ? (
                    <img src={newProduct.preview} alt="Preview" className="img-preview" />
                  ) : (
                    <div className="img-placeholder">Нет фото</div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageChange} id="file-input" />
                  <label htmlFor="file-input" className="file-label">
                    Выбрать фото
                  </label>
                </div>
                <div className="inputs-section">
                  <input
                    type="text"
                    placeholder="Название товара"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="Цена (грн)"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  />
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Кол-во / Вес (кг)"
                    className="seller-form-input--half"
                    value={newProduct.quantities}
                    onChange={(e) => setNewProduct({ ...newProduct, quantities: e.target.value })}
                  />
                  <textarea
                    placeholder="Описание товара"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="product-modal-footer">
                <button className="btn-cancel" onClick={handleCloseModal}>
                  Отмена
                </button>
                <button
                  className="btn-save"
                  onClick={saveProduct}
                  disabled={isSubmitting || !newProduct.name || !newProduct.price}
                >
                  {isSubmitting ? "Сохранение..." : editingProductId ? "Сохранить" : "Создать"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="register-seller-page">
      <div className="seller-form-container">
        <h2 className="seller-form-container__title">Регистрация продавца</h2>
        {step === 1 && (
          <div className="seller-form-step">
            <p className="seller-form-step__text">Введите номер телефона магазина:</p>
            <input
              type="tel"
              className="seller-form-input"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+380..."
            />
            <button className="seller-form-btn" onClick={handleStepOne}>
              Далее
            </button>
          </div>
        )}
        {step === 3 && (
          <div className="seller-form-step">
            <input
              type="text"
              className="seller-form-input"
              placeholder="Название магазина"
              value={formData.shop_name}
              onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
            />
            <div className="seller-form-row">
              <input
                type="time"
                className="seller-form-input seller-form-input--half"
                value={formData.opening_time}
                onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
              />
              <input
                type="time"
                className="seller-form-input seller-form-input--half"
                value={formData.closing_time}
                onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
              />
            </div>
            <textarea
              className="seller-form-textarea"
              placeholder="Реквизиты для оплаты"
              value={formData.payment_details}
              onChange={(e) => setFormData({ ...formData, payment_details: e.target.value })}
            />
            <LocationPicker onLocationSelect={handleLocationChange} />
            <button className="seller-form-btn seller-form-btn--submit" onClick={handleFinish}>
              Завершить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
