/**
 * TopNavBar - Application top navigation bar
 * Requirements: 7.6, 7.7, 8.1, 18.1, 19.2
 */

import { UserAvatar } from './UserAvatar';
import { DocumentTitleBar } from './DocumentTitleBar';
import { UserMenuAuthenticated } from './UserMenuAuthenticated';
import { UserMenuGuest } from './UserMenuGuest';
import { useAccessContext } from '../services/authStore';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface TopNavBarProps {
  documentTitle: string;
  hasUnsavedChanges: boolean;
  onNew: () => void;
  onSave: () => void;
  onOpenPreferences?: () => void;
  /** Authenticated user's display name; omit for anonymous/guest. */
  userName?: string;
  /** Authenticated user's email address; omit for anonymous/guest. */
  userEmail?: string;
  /** AuraBrain dirty state — true when content differs from last sync (Req 3.3, 3.4) */
  isDirty?: boolean;
  /** AuraBrain syncing state — true while sync is in progress (Req 1.1) */
  isSyncing?: boolean;
  /** Called when the user renames the document via the title bar. */
  onRename?: (newTitle: string) => void;
  /** Currently active top-level tab */
  activeTab?: 'editor' | 'library' | 'archive';
  /** Called when the user clicks a nav tab button */
  onTabChange?: (tab: 'editor' | 'library' | 'archive') => void;
  /** Called when guest clicks Sign In */
  onSignIn?: () => void;
  /** Called when authenticated user clicks Sign Out */
  onSignOut?: () => void;
  /** Whether sign-out is currently in progress */
  isSigningOut?: boolean;
  /** Called when user clicks My Library in the authenticated menu */
  onOpenLibrary?: () => void;
  /** Called when user clicks profile header in the authenticated menu */
  onOpenProfile?: () => void;
  /** Whether session restoration is in progress (shows pulsing avatar) */
  isRestoringSession?: boolean;
}

export function TopNavBar({
  documentTitle,
  hasUnsavedChanges,
  onNew,
  onSave,
  onOpenPreferences,
  userName,
  userEmail: _userEmail,
  isDirty = false,
  isSyncing = false,
  onRename,
  activeTab = 'editor',
  onTabChange,
  onSignIn,
  onSignOut,
  isSigningOut = false,
  onOpenLibrary,
  onOpenProfile,
  isRestoringSession = false,
}: TopNavBarProps) {
  const { t } = useTranslation();
  const accessContext = useAccessContext();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const focusedIndexRef = useRef<number>(-1);

  // Close menu with fade-out animation (Req 7.7)
  const closeMenu = useCallback(() => {
    if (!isUserMenuOpen || isClosing) return;
    setIsClosing(true);
    // Wait for fade-out animation to complete (150ms)
    setTimeout(() => {
      setIsUserMenuOpen(false);
      setIsClosing(false);
      focusedIndexRef.current = -1;
    }, 150);
  }, [isUserMenuOpen, isClosing]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen, closeMenu]);

  // Window blur close (Req 7.7)
  useEffect(() => {
    if (isUserMenuOpen) {
      window.addEventListener('blur', closeMenu);
    }
    return () => window.removeEventListener('blur', closeMenu);
  }, [isUserMenuOpen, closeMenu]);

  // Keyboard navigation (Req 7.6)
  const handleMenuKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!isUserMenuOpen) return;

    // Query focusable buttons within the popover
    const container = userMenuRef.current?.querySelector('[data-testid="user-menu-popover"]');
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    if (items.length === 0) return;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        focusedIndexRef.current = (focusedIndexRef.current + 1) % items.length;
        items[focusedIndexRef.current]?.focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        focusedIndexRef.current = focusedIndexRef.current <= 0
          ? items.length - 1
          : focusedIndexRef.current - 1;
        items[focusedIndexRef.current]?.focus();
        break;
      }
      case 'Enter': {
        event.preventDefault();
        if (focusedIndexRef.current >= 0 && items[focusedIndexRef.current]) {
          items[focusedIndexRef.current].click();
        }
        break;
      }
      case 'Escape': {
        event.preventDefault();
        closeMenu();
        break;
      }
    }
  }, [isUserMenuOpen, closeMenu]);

  const toggleMenu = () => {
    if (isUserMenuOpen) {
      closeMenu();
    } else {
      setIsUserMenuOpen(true);
      focusedIndexRef.current = -1;
    }
  };

  return (
    <>
      <header
        data-testid="top-nav-bar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 'var(--topnav-height)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem',
          background: 'var(--md-sys-color-surface)',
          fontFamily: 'var(--font-family-ui)',
        }}
      >
        {/* Left: Logo + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <span
            data-testid="app-title"
            style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--md-sys-color-on-surface)', letterSpacing: '-0.01em' }}
          >
            WordAI
          </span>
          <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <button
              data-testid="nav-drafts"
              onClick={() => onTabChange?.('editor')}
              style={{
                background: 'none',
                border: 'none',
                padding: '0',
                paddingBottom: '2px',
                cursor: 'pointer',
                fontFamily: 'var(--font-family-ui)',
                fontSize: 'var(--font-size-sm)',
                color: activeTab === 'editor' ? 'var(--md-sys-color-primary)' : '#5a5a5a',
                fontWeight: activeTab === 'editor' ? 600 : 400,
                borderBottom: activeTab === 'editor' ? '2px solid var(--md-sys-color-primary)' : '2px solid transparent',
              }}
            >
              {t('nav.drafts')}
            </button>
            <button
              data-testid="nav-archive"
              onClick={() => onTabChange?.('archive')}
              style={{
                background: 'none',
                border: 'none',
                padding: '0',
                paddingBottom: '2px',
                cursor: 'pointer',
                fontFamily: 'var(--font-family-ui)',
                fontSize: 'var(--font-size-sm)',
                color: activeTab === 'archive' ? 'var(--md-sys-color-primary)' : '#5a5a5a',
                fontWeight: activeTab === 'archive' ? 600 : 400,
                borderBottom: activeTab === 'archive' ? '2px solid var(--md-sys-color-primary)' : '2px solid transparent',
              }}
            >
              {t('nav.archive')}
            </button>
            <button
              data-testid="nav-library"
              onClick={() => onTabChange?.('library')}
              style={{
                background: 'none',
                border: 'none',
                padding: '0',
                paddingBottom: '2px',
                cursor: 'pointer',
                fontFamily: 'var(--font-family-ui)',
                fontSize: 'var(--font-size-sm)',
                color: activeTab === 'library' ? 'var(--md-sys-color-primary)' : '#5a5a5a',
                fontWeight: activeTab === 'library' ? 600 : 400,
                borderBottom: activeTab === 'library' ? '2px solid var(--md-sys-color-primary)' : '2px solid transparent',
              }}
            >
              {t('nav.library')}
            </button>
          </nav>
        </div>

        {/* Center: doc title via DocumentTitleBar (Req 3.1–3.4) */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <DocumentTitleBar
            intentName={documentTitle || null}
            isDirty={isDirty}
            isSyncing={isSyncing}
            onRename={onRename}
          />
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            data-testid="save-button"
            onClick={onSave}
            title={hasUnsavedChanges ? t('nav.export') : t('nav.export')}
            style={{
              background: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              padding: '6px 16px',
              cursor: 'pointer',
              fontFamily: 'var(--font-family-ui)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
            }}
          >
            {t('nav.export')}
          </button>
          <button
            data-testid="new-button"
            onClick={onNew}
            style={{
              background: 'none',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
            title={t('nav.newDocument')}
          >
            <span className="material-symbols-outlined">add</span>
          </button>
          <button
            onClick={onOpenPreferences}
            title={t('nav.preferences')}
            style={{
              background: 'none',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
          >
            <span className="material-symbols-outlined">settings</span>
          </button>

          {/* User Menu Popover — Req 7.6, 7.7, 8.1 */}
          <div
            ref={userMenuRef}
            style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            onKeyDown={handleMenuKeyDown}
          >
            {/* Avatar trigger */}
            {accessContext ? (
              /* Authenticated avatar trigger */
              <span
                style={{
                  borderRadius: '50%',
                  display: 'inline-flex',
                  boxShadow: isUserMenuOpen ? '0 0 0 2px var(--md-sys-color-primary)' : 'none',
                  transition: 'box-shadow 0.15s',
                }}
              >
                <UserAvatar
                  name={userName}
                  size={32}
                  onClick={toggleMenu}
                />
              </span>
            ) : (
              /* Guest avatar trigger — Req 8.1 */
              <button
                type="button"
                onClick={toggleMenu}
                data-testid="guest-avatar-trigger"
                aria-label="User menu"
                className={isRestoringSession ? 'animate-pulse' : ''}
                style={{
                  background: 'none',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--md-sys-color-on-surface-variant)',
                  opacity: isRestoringSession ? 0.6 : 1,
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '24px' }}>
                  account_circle
                </span>
              </button>
            )}

            {/* Popover menu */}
            {isUserMenuOpen && (
              <div
                data-testid="user-menu-popover"
                className={`transition-opacity duration-150 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: 0,
                  zIndex: 200,
                }}
                role="menu"
                aria-label="User menu"
              >
                {accessContext ? (
                  <UserMenuAuthenticated
                    user={{
                      displayName: accessContext.user.display_name,
                      email: accessContext.user.email,
                      avatarUrl: accessContext.user.avatar_url ?? undefined,
                      plan: accessContext.entitlement.plan_code !== 'free'
                        ? accessContext.entitlement.plan_code.toUpperCase()
                        : undefined,
                    }}
                    onSignOut={() => {
                      onSignOut?.();
                      closeMenu();
                    }}
                    onOpenLibrary={() => {
                      onOpenLibrary?.();
                      closeMenu();
                    }}
                    onOpenProfile={() => {
                      onOpenProfile?.();
                      closeMenu();
                    }}
                    isSigningOut={isSigningOut}
                  />
                ) : (
                  <UserMenuGuest
                    onSignIn={() => {
                      onSignIn?.();
                      closeMenu();
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Divider */}
      <div style={{ position: 'fixed', top: 'var(--topnav-height)', left: 0, right: 0, height: '1px', background: 'var(--md-sys-color-surface-container)', zIndex: 50 }} />
    </>
  );
}

export default TopNavBar;
