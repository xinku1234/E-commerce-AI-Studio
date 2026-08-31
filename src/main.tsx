import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerAppRemount } from './utils/appRemount';
import { installDomResilience } from './utils/domResilience';
import './index.css';

// Installed before the first render so every commit is protected against
// managed nodes being moved by browser extensions.
installDomResilience();

const container = document.getElementById('root')!;

const tree = (
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

let root = createRoot(container);
root.render(tree);

// Last-resort recovery: throw away the React root and the container markup, then
// mount again from scratch.
registerAppRemount(() => {
  try {
    root.unmount();
  } catch (error) {
    console.warn('Unmount during recovery failed, forcing a clean container:', error);
  }
  container.textContent = '';
  root = createRoot(container);
  root.render(tree);
});
