import { createRoot } from 'react-dom/client';
import { createBrowserHost } from './platform/browser-host';
import App from './App';
import './styles/global.css';

/**
 * Entry point for officewrite.com/app.
 *
 * The desktop build gets `window.officewrite` from the Electron preload script;
 * the test harness installs a mock. This installs the real browser bridge, so
 * `platform/index.ts` resolves the same way in all three and nothing in `src/`
 * needs to know which one it is running under.
 */
window.officewrite = createBrowserHost();

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
