import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startRenderWorker } from './render-worker';
import './styles.css';

if (new URLSearchParams(location.search).has('render')) startRenderWorker();
else createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
