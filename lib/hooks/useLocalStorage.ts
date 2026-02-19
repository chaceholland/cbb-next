'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const storedValueRef = useRef<T>(storedValue);

  // Keep ref in sync with state
  useEffect(() => {
    storedValueRef.current = storedValue;
  }, [storedValue]);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) setStoredValue(JSON.parse(item));
    } catch (e) { console.error(e); }
  }, [key]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Use ref to get the latest value instead of closure
      const valueToStore = value instanceof Function ? value(storedValueRef.current) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (e) { console.error(e); }
  }, [key]);

  return [storedValue, setValue] as const;
}
