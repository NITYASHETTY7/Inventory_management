import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // Check local storage or system preference on mount
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsLight(true);
      document.documentElement.classList.add('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    if (isLight) {
      document.documentElement.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
      setIsLight(false);
    } else {
      document.documentElement.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
      setIsLight(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-neutral-300 hover:text-white hover:bg-white/10 text-xs font-bold font-mono tracking-widest uppercase transition-all shadow-lg"
      title="Toggle Theme"
    >
      {isLight ? 'Dark Theme' : 'Light Theme'}
    </button>
  );
}
