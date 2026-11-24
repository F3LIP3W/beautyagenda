import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { RouterProvider } from './lib/router.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { ToastProvider } from './contexts/ToastContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </RouterProvider>
  </StrictMode>,
);

// PWA: registra o service worker apenas em produção
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.error('Service worker não registrado', err));
  });
}
