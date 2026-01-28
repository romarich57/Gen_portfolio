import React from 'react';

import Button from '@/components/ui/Button';
import { useTheme } from '@/app/providers/ThemeProvider';

/**
 * Theme toggle button.
 * Preconditions: ThemeProvider mounted.
 * Postconditions: toggles theme between light and dark.
 */
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
      {theme === 'dark' ? 'Light' : 'Dark'}
    </Button>
  );
}

export default ThemeToggle;
