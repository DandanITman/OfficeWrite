import { createRoot } from 'react-dom/client';
import { installMockOfficewrite } from '../../../tests/helpers/mock-officewrite';
import App from '../src/App';
import '../src/styles/global.css';

document.documentElement.setAttribute('data-test-mode', 'true');
installMockOfficewrite(window);

createRoot(document.getElementById('root')!).render(<App />);
