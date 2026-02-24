'use client';

import { useEffect, useState, RefObject } from 'react';

interface UseStickyOptions {
  offset?: number; // Offset from top before becoming sticky
}

export function useSticky(ref: RefObject<HTMLElement>, options: UseStickyOptions = {}) {
  const { offset = 0 } = options;
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the element's top is at or above the threshold, it's sticky
        setIsSticky(!entry.isIntersecting);
      },
      {
        threshold: [1],
        rootMargin: `-${offset}px 0px 0px 0px`,
      }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, offset]);

  return isSticky;
}
