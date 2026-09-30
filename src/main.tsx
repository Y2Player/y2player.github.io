import React from 'react';
import ReactDOM from 'react-dom/client';
import PocketApp from './pocket/PocketApp.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PocketApp />
  </React.StrictMode>,
);
