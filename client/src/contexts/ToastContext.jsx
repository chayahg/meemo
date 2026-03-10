import React, { createContext, useContext, useState, useCallback } from 'react';
import '../Toast.css';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState(null); // { message, onConfirm, onCancel, showCancel }

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove after 4.5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showConfirm = useCallback((message, onConfirm, onCancel = null, showCancel = true) => {
    setConfirmConfig({ message, onConfirm, onCancel, showCancel });
  }, []);

  const handleConfirm = () => {
    if (confirmConfig?.onConfirm) {
      confirmConfig.onConfirm();
    }
    setConfirmConfig(null);
  };

  const handleCancel = () => {
    if (confirmConfig?.onCancel) {
      confirmConfig.onCancel();
    }
    setConfirmConfig(null);
  };

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}
      
      {/* Toast Overlay */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-message toast-${toast.type}`}>
            <div className="toast-content">
              {toast.type === 'error' && <span className="toast-icon">❌</span>}
              {toast.type === 'success' && <span className="toast-icon">✅</span>}
              {toast.type === 'info' && <span className="toast-icon">ℹ️</span>}
              <p>{toast.message}</p>
            </div>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>✕</button>
          </div>
        ))}
      </div>

      {/* Confirm Modal Overlay */}
      {confirmConfig && (
        <div className="confirm-modal-overlay" onClick={handleCancel}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-content">
              <span className="confirm-icon">⚠️</span>
              <p>{confirmConfig.message}</p>
            </div>
            <div className="confirm-modal-actions">
              {confirmConfig.showCancel && (
                <button className="confirm-btn-cancel" onClick={handleCancel}>
                  Cancel
                </button>
              )}
              <button className="confirm-btn-confirm" onClick={handleConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
