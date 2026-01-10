import React, { createContext, useContext, useState, useCallback } from "react";
import "./ModalContext.css";

interface ModalOptions {
  title: string;
  message: string;
  onConfirm: () => void;
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
}

interface ModalContextType {
  showAlert: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string) => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ModalOptions>({
    title: "",
    message: "",
    onConfirm: () => {},
    showCancel: false,
  });

  const showAlert = useCallback((title: string, message: string) => {
    setConfig({
      title,
      message,
      onConfirm: () => setIsOpen(false),
      showCancel: false,
      confirmText: "Ок",
    });
    setIsOpen(true);
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmText = "Да") => {
    setConfig({
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setIsOpen(false);
      },
      showCancel: true,
      confirmText,
      cancelText: "Отмена",
    });
    setIsOpen(true);
  }, []);

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {isOpen && (
        <div className="modal-overlay" onClick={() => !config.showCancel && setIsOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-container__title">{config.title}</h3>
            <p className="modal-container__text">{config.message}</p>
            <div className="modal-container__actions">
              {config.showCancel && (
                <button className="modal-btn modal-btn--cancel" onClick={() => setIsOpen(false)}>
                  {config.cancelText}
                </button>
              )}
              <button className="modal-btn modal-btn--confirm" onClick={config.onConfirm}>
                {config.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
};
