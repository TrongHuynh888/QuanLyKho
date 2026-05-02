/**
 * src/main.tsx
 * Đây là điểm bắt đầu (Entry Point) của toàn bộ ứng dụng React.
 * File này đảm nhiệm việc lấy cấu trúc từ `App.tsx` và gắn (render) nó
 * vào thẻ <div id="root"> bên trong file `index.html`.
 * Nó cũng khởi tạo môi trường căn bản (CSS, i18n đa ngôn ngữ).
 */
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './lib/i18n.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
