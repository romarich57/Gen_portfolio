import React from 'react';
import { RouterProvider } from 'react-router-dom';

import router from './router';
import QueryProvider from './providers/QueryProvider';
import ThemeProvider from './providers/ThemeProvider';
import AuthBootstrap from './providers/AuthBootstrap';

/**
 * Root application component.
 * Preconditions: router defined.
 * Postconditions: providers wrap RouterProvider.
 */
function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthBootstrap>
          <RouterProvider router={router} />
        </AuthBootstrap>
      </ThemeProvider>
    </QueryProvider>
  );
}

export default App;
