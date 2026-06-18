import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ConvexAppProvider } from './lib/convex.ts';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexAppProvider>
      <App />
    </ConvexAppProvider>
  </StrictMode>,
);
