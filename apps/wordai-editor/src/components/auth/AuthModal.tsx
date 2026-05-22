/**
 * AuthModal - Authentication modal overlay rendered as a React Portal.
 * Manages the modal lifecycle: open/close, backdrop click, Escape key,
 * ARIA accessibility attributes, view routing, and transitions.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import { useEffect, useRef, useCallback, useState, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './useFocusTrap';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { ResetSuccessView } from './ResetSuccessView';

export type AuthView = 'login' | 'signup' | 'forgot-password' | 'reset-success';

// Context for child forms to access navigation and shared state
export interface AuthModalContextValue {
  currentView: AuthView;
  sharedEmail: string;
  setSharedEmail: (email: string) => void;
  onNavigate: (view: AuthView) => void;
  formError: string | null;
  setFormError: (error: string | null) => void;
  isSubmitting: boolean;
  /** Called before auth store update on sign-up success (Req 15.4) */
  onSignUpSuccess?: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal(): AuthModalContextValue {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used within an AuthModal');
  }
  return context;
}


export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'login' | 'signup';
  /** When true, suppresses backdrop click and Escape key close */
  isSubmitting?: boolean;
  /** Called before auth store update on sign-up success (Req 15.4 — signals upload-on-signup) */
  onSignUpSuccess?: () => void;
  children?: React.ReactNode;
}

const HEADING_ID = 'auth-modal-heading';

export function AuthModal({
  isOpen,
  onClose,
  initialView = 'login',
  isSubmitting: isSubmittingProp = false,
  onSignUpSuccess,
  children,
}: AuthModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // View routing state
  const [currentView, setCurrentView] = useState<AuthView>(initialView);
  const [sharedEmail, setSharedEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transition state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedView, setDisplayedView] = useState<AuthView>(initialView);
  const [viewVisible, setViewVisible] = useState(true);

  // Integrate focus trap
  useFocusTrap(modalRef, isOpen);

  // Store the previously focused element when modal opens
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Reset view when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentView(initialView);
      setDisplayedView(initialView);
      setViewVisible(true);
      setFormError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialView]);

  // Handle view navigation with transition animation
  const handleNavigate = useCallback(
    (newView: AuthView) => {
      if (newView === currentView || isTransitioning) return;

      // Clear errors on view switch (Req 9.2)
      setFormError(null);

      setIsTransitioning(true);
      setViewVisible(false);

      setTimeout(() => {
        setCurrentView(newView);
        setDisplayedView(newView);

        requestAnimationFrame(() => {
          setViewVisible(true);
          setIsTransitioning(false);

          // Auto-focus first input after transition
          setTimeout(() => {
            if (contentRef.current) {
              const firstInput = contentRef.current.querySelector<HTMLElement>(
                'input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
              );
              if (firstInput) {
                firstInput.focus();
              }
            }
          }, 200);
        });
      }, 150);
    },
    [currentView, isTransitioning],
  );

  // Handle Escape key close (suppressed during loading)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting && !isSubmittingProp) {
        onClose();
      }
    },
    [onClose, isSubmitting, isSubmittingProp],
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
      if (e.target === e.currentTarget && !isSubmitting && !isSubmittingProp) {
        onClose();
      }
    },
    [onClose, isSubmitting, isSubmittingProp],
  );

  if (!isOpen) return null;

  // Context value for child forms
  const contextValue: AuthModalContextValue = {
    currentView,
    sharedEmail,
    setSharedEmail,
    onNavigate: handleNavigate,
    formError,
    setFormError,
    isSubmitting,
    onSignUpSuccess,
  };

  // Render view content based on currentView
  const renderViewContent = () => {
    if (children) return children;

    switch (displayedView) {
      case 'login':
        return (
          <LoginForm
            email={sharedEmail}
            onEmailChange={setSharedEmail}
            onNavigate={(view) => handleNavigate(view)}
            onSuccess={onClose}
            onError={setFormError}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
            error={formError}
            clearError={() => setFormError(null)}
          />
        );
      case 'signup':
        return (
          <SignUpForm
            email={sharedEmail}
            onEmailChange={setSharedEmail}
            onNavigate={(view) => handleNavigate(view)}
            onSuccess={onClose}
            onError={setFormError}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
            error={formError}
            clearError={() => setFormError(null)}
            onBeforeSuccess={onSignUpSuccess}
          />
        );
      case 'forgot-password':
        return (
          <ForgotPasswordForm
            email={sharedEmail}
            onEmailChange={setSharedEmail}
            onNavigate={(view) => handleNavigate(view)}
            onError={setFormError}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
            error={formError}
            clearError={() => setFormError(null)}
          />
        );
      case 'reset-success':
        return (
          <ResetSuccessView
            onNavigate={(view) => handleNavigate(view)}
          />
        );
      default:
        return null;
    }
  };

  return createPortal(
    <AuthModalContext.Provider value={contextValue}>
      {/* Backdrop */}
      <div
        onClick={handleBackdropClick}
        data-testid="auth-modal-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(46, 49, 50, 0.4)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          padding: '1rem',
        }}
      >
        {/* Modal Container — Glassmorphism */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={HEADING_ID}
          data-testid="auth-modal-container"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px -5px rgba(67, 67, 213, 0.08)',
            borderRadius: '0.75rem',
            width: '100%',
            maxWidth: '28rem',
            position: 'relative',
            overflow: 'hidden',
            transform: 'scale(1)',
            transition: 'transform 0.2s',
          }}
        >
          {/* Top gradient bar */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '4px',
              background: 'linear-gradient(to right, var(--md-sys-color-primary, #4343d5), var(--md-sys-color-primary-container, #5d5fef))',
              opacity: 0.8,
            }}
          />

          {/* Content area */}
          <div ref={contentRef} style={{ padding: '2.5rem' }}>
            <div
              data-testid="auth-modal-view-content"
              style={{
                opacity: viewVisible ? 1 : 0,
                transform: viewVisible ? 'scale(1)' : 'scale(0.95)',
                transition: viewVisible
                  ? 'opacity 0.2s ease-out, transform 0.2s ease-out'
                  : 'opacity 0.15s ease-in, transform 0.15s ease-in',
              }}
            >
              {renderViewContent()}
            </div>
          </div>
        </div>
      </div>
    </AuthModalContext.Provider>,
    document.body,
  );
}

// Export internal state/handlers for testing and child component integration
export { HEADING_ID as AUTH_MODAL_HEADING_ID };
