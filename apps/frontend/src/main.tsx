import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './app/App';
import './index.css';

/**
 * Bootstrap React application.
 * Preconditions: #root exists in index.html.
 * Postconditions: App is rendered inside StrictMode.
 */
function bootstrap() {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root container not found');
  }

  createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
