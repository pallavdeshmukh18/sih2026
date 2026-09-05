import { useEffect, useRef } from 'react';

export const useScrollReveal = (options = { threshold: 0.1, triggerOnce: true }) => {
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          if (options.triggerOnce) {
            observer.unobserve(entry.target);
          }
        } else if (!options.triggerOnce) {
          entry.target.classList.remove('is-revealed');
        }
      },
      options
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, [options.threshold, options.triggerOnce]);

  return ref;
};
