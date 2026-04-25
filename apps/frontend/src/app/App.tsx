import { RouterProvider } from 'react-router-dom';

import router from './router';
import QueryProvider from './providers/QueryProvider';
import ThemeProvider from './providers/ThemeProvider';
import AuthBootstrap from './providers/AuthBootstrap';
import { ToastProvider } from '@/components/common/ToastProvider';
import { CvGeniusI18nProvider } from '@/i18n';

/**
 * Root application component.
 * Preconditions: router defined.
 * Postconditions: providers wrap RouterProvider.
 */
function App() {
  return (
    <ToastProvider>
      <QueryProvider>
        <ThemeProvider>
          <AuthBootstrap>
            <CvGeniusI18nProvider>
              <RouterProvider router={router} />
            </CvGeniusI18nProvider>
          </AuthBootstrap>
        </ThemeProvider>
      </QueryProvider>
    </ToastProvider>
  );
}

export default App;
