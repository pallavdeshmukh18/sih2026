import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Find the element with the hash ID
      const element = document.getElementById(hash.slice(1));
      if (element) {
        // Wait a tiny bit for the page content to render/mount
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
        return () => clearTimeout(timer);
      } else {
        setTimeout(() => {
          document.documentElement.style.scrollBehavior = 'auto';
          window.scrollTo(0, 0);
          document.documentElement.style.scrollBehavior = '';
        }, 10);
      }
    } else {
      setTimeout(() => {
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, 0);
        document.documentElement.style.scrollBehavior = '';
      }, 10);
    }
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
