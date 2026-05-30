import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export function BottomSheet({ isOpen, onClose, title, children }) {
  const sheetRef = useRef(null);

  // Close on Escape key press and manage body scroll
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Trap focus inside bottom sheet
  useEffect(() => {
    if (!isOpen) return;
    const focusableElements = sheetRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex="0"]'
    );
    if (!focusableElements || focusableElements.length === 0) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleTab);
    firstElement.focus();

    return () => {
      window.removeEventListener('keydown', handleTab);
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Drawer Container */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bottom-sheet-title"
            className="relative w-full max-h-[85vh] bg-obsidian-900 border-t border-obsidian-750 rounded-t-3xl p-6 shadow-2xl flex flex-col z-10"
          >
            {/* Grab handle/pill for swipe indicator */}
            <div className="w-12 h-1.5 bg-obsidian-700 rounded-full mx-auto mb-4 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 id="bottom-sheet-title" className="text-base font-bold text-white font-display">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 bg-obsidian-800 hover:bg-obsidian-700 text-slate-400 hover:text-white rounded-lg transition-colors"
                aria-label="Close sheet"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content area - scrollable */}
            <div className="overflow-y-auto pr-1 flex-1 pb-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
