/**
 * AuthModal - Authentication modal overlay rendered as a React Portal.
 * Manages the modal lifecycle: open/close, backdrop click, Escape key,
 * ARIA accessibility attributes, view routing, and transitions.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import { useEffect, useRef, useCallback, useState, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from './useFocusTrap';

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
  isSubmitting = false,
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

  // Transition state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedView, setDisplayedView] = useState<AuthView>(initialView);
  const [viewVisible, setViewVisible] = useState(true);

  // Container height animation
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);

  // Integrate focus trap
  useFocusTrap(modalRef, isOpen);

  const { t } = useTranslation();

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
    }
  }, [isOpen, initialView]);

  // Measure content height for smooth container animation
  useEffect(() => {
    if (contentRef.current && isOpen) {
      const height = contentRef.current.scrollHeight;
      setContainerHeight(height);
    }
  }, [displayedView, isOpen]);

  // Handle view navigation with transition animation
  const handleNavigate = useCallback(
    (newView: AuthView) => {
      if (newView === currentView || isTransitioning) return;

      // Clear errors on view switch (Req 9.2)
      setFormError(null);

      setIsTransitioning(true);
      setViewVisible(false); // Start exit animation (opacity-0 scale-95)

      // After exit animation (150ms), switch view and start enter animation
      setTimeout(() => {
        setCurrentView(newView);
        setDisplayedView(newView);

        // Small delay to allow DOM update before enter animation
        requestAnimationFrame(() => {
          setViewVisible(true); // Start enter animation (opacity-100 scale-100)
          setIsTransitioning(false);

          // Auto-focus first input after transition completes (Req 9.5)
          setTimeout(() => {
            if (contentRef.current) {
              const firstInput = contentRef.current.querySelector<HTMLElement>(
                'input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
              );
              if (firstInput) {
                firstInput.focus();
              }
            }
          }, 200); // Wait for enter animation to complete
        });
      }, 150); // Exit animation duration
    },
    [currentView, isTransitioning],
  );

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

  // Transition classes for view content
  const viewTransitionClasses = viewVisible
    ? 'opacity-100 scale-100 transition-all duration-200 ease-out'
    : 'opacity-0 scale-95 transition-all duration-150 ease-in';

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
          <div data-testid="login-view">
            <h2
              id={HEADING_ID}
              className="font-headline text-[2rem] font-bold text-on-surface tracking-tight mb-8"
            >
              {t('auth.login.title')}
            </h2>
            <div>Login placeholder</div>
            <button
              type="button"
              data-testid="nav-to-signup"
              onClick={() => handleNavigate('signup')}
            >
              {t('auth.login.signUp')}
            </button>
            <button
              type="button"
              data-testid="nav-to-forgot-password"
              onClick={() => handleNavigate('forgot-password')}
            >
              {t('auth.login.forgotPassword')}
            </button>
          </div>
        );
      case 'signup':
        return (
          <div data-testid="signup-view">
            <h2
              id={HEADING_ID}
              className="font-headline text-[2rem] font-bold text-on-surface tracking-tight mb-8"
            >
              {t('auth.signup.title')}
            </h2>
            <div>Signup placeholder</div>
            <button
              type="button"
              data-testid="nav-to-login"
              onClick={() => handleNavigate('login')}
            >
              {t('auth.signup.backToLogin')}
            </button>
          </div>
        );
      case 'forgot-password':
        return (
          <div data-testid="forgot-password-view">
            <h2
              id={HEADING_ID}
              className="font-headline text-[2rem] font-bold text-on-surface tracking-tight mb-8"
            >
              {t('auth.forgotPassword.title')}
            </h2>
            <div>Forgot password placeholder</div>
            <button
              type="button"
              data-testid="nav-to-login-from-forgot"
              onClick={() => handleNavigate('login')}
            >
              {t('auth.forgotPassword.backToLogin')}
            </button>
          </div>
        );
      case 'reset-success':
        return (
          <div data-testid="reset-success-view">
            <h2
              id={HEADING_ID}
              className="font-headline text-[2rem] font-bold text-on-surface tracking-tight mb-8"
            >
              {t('auth.resetSuccess.title')}
            </h2>
            <div>Reset success placeholder</div>
            <button
              type="button"
              data-testid="nav-to-login-from-success"
              onClick={() => handleNavigate('login')}
            >
              {t('auth.resetSuccess.backToLogin')}
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return createPortal(
    <AuthModalContext.Provider value={contextValue}>
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
          style={{
            height: containerHeight ? `${containerHeight}px` : 'auto',
            transition: 'height 200ms ease-out',
          }}
          data-testid="auth-modal-container"
        >
          {/* Top gradient bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-container opacity-80" />

          {/* Content area with transition */}
          <div ref={contentRef} className="p-10">
            {formError && (
              <div
                className="bg-error-container text-on-error-container rounded-lg p-4 mb-8 flex items-start gap-3"
                data-testid="auth-modal-error"
              >
                <span className="material-symbols-rounded text-on-error-container">error</span>
                <span className="font-headline text-sm font-medium leading-snug">{formError}</span>
              </div>
            )}
            <div className={viewTransitionClasses} data-testid="auth-modal-view-content">
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
