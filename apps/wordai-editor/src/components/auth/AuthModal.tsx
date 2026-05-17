/**
 * AuthModal - Authentication modal overlay rendered as a React Portal.
 * Manages the modal lifecycle: open/close, backdrop click, Escape key,
 * and ARIA accessibility attributes.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8
 */

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'login' | 'signup';
  /** When true, suppresses backdrop click and Escape key close */
  isSubmitting?: boolean;
  children?: React.ReactNode;
}

const HEADING_ID = 'auth-modal-heading';

export function AuthModal({
  isOpen,
  onClose,
  initialView: _initialView,
  isSubmitting = false,
  children,
}: AuthModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element when modal opens
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Handle Escape key close (suppressed during loading)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    },
    [onClose, isSubmitting],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Handle backdrop click (suppressed during loading)
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !isSubmitting) {
        onClose();
      }
    },
    [onClose, isSubmitting],
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      data-testid="auth-modal-backdrop"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={HEADING_ID}
        className="bg-surface-container-lowest/80 backdrop-blur-[20px] shadow-ambient-glow rounded-xl w-full max-w-md relative overflow-hidden transform transition-all scale-100"
        data-testid="auth-modal-container"
      >
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-container opacity-80" />

        {/* Content area */}
        <div className="p-10">
          {children || (
            <h2
              id={HEADING_ID}
              className="font-headline text-[2rem] font-bold text-on-surface tracking-tight mb-8"
            >
              Đăng nhập
            </h2>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export { HEADING_ID as AUTH_MODAL_HEADING_ID };
