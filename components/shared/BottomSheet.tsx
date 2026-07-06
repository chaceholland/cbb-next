'use client';

/**
 * Pass 3 D4 — shared responsive modal shell.
 * Mobile (<640px): slide-up bottom sheet (partial height, drag handle).
 * >=sm: centered modal, visually matching the existing inline modal wrappers.
 * Copy-portable: only depends on react, react-dom, framer-motion, ./cn.
 */
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './cn';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Extra classes for the panel (e.g. background overrides). */
  className?: string;
  /** Max width on >=sm screens. Default matches the CBB modals. */
  maxWidthClass?: string;
  /** z-index class for overlay+panel. */
  zClass?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  className,
  maxWidthClass = 'sm:max-w-2xl',
  zClass = 'z-50',
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm', zClass)}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 48 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={cn(
              'fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none',
              zClass,
            )}
          >
            <div
              className={cn(
                'relative bg-slate-800 shadow-2xl shadow-black/30 w-full flex flex-col pointer-events-auto',
                'rounded-t-3xl sm:rounded-3xl max-h-[88vh] sm:max-h-[85vh]',
                maxWidthClass,
                className,
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sm:hidden pt-2 pb-1 flex justify-center shrink-0" aria-hidden>
                <span className="block h-1.5 w-10 rounded-full bg-slate-600" />
              </div>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
