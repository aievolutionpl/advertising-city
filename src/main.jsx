import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './game-ui.css';
import './mobile-ui.css';
import './drive-ui.css';
import './ui-polish.css';
import { SceneGate, PerfBadge } from './ui/SceneGate.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <SceneGate />
    <PerfBadge />
  </React.StrictMode>,
);
