import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import MvpApp from './MvpApp';

createRoot(document.getElementById('root')!).render(<React.StrictMode><MvpApp/></React.StrictMode>);
