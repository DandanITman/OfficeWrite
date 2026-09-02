import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { isPlatformAvailable } from './platform';
import { UnavailableScreen } from './platform/UnavailableScreen';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isPlatformAvailable() ? <App /> : <UnavailableScreen />}</StrictMode>,
);
