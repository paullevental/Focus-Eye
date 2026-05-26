import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className={`theme-toggle-icon ${isDark ? 'is-dark' : ''}`}>
        {isDark ? <Moon size={16} /> : <Sun size={16} />}
      </span>
    </button>
  );
}
