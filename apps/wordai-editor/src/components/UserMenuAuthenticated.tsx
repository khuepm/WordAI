/**
 * UserMenuAuthenticated - Authenticated user menu popover content.
 * Displays user profile header, My Library link, and Sign Out button.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useTranslation } from 'react-i18next';

export interface UserMenuAuthenticatedProps {
  user: {
    displayName: string;
    email: string;
    avatarUrl?: string;
    plan?: string;
  };
  onSignOut: () => void;
  onOpenLibrary?: () => void;
  onOpenProfile?: () => void;
  isSigningOut?: boolean;
}

export function UserMenuAuthenticated({
  user,
  onSignOut,
  onOpenLibrary,
  onOpenProfile,
  isSigningOut = false,
}: UserMenuAuthenticatedProps) {
  const { t } = useTranslation();

  return (
    <div
      className="bg-surface-container-lowest/80 backdrop-blur-[20px] rounded-xl outline outline-1 outline-outline-variant/15 shadow-[0_-5px_40px_rgba(25,28,29,0.04)]"
      data-testid="user-menu-authenticated"
    >
      {/* Header Block — Req 7.2 */}
      <button
        type="button"
        onClick={onOpenProfile}
        className={`w-full text-left p-5 flex items-center gap-4 hover:bg-surface-container-low rounded-t-xl transition-colors ${isSigningOut ? 'pointer-events-none opacity-50' : ''
          }`}
        data-testid="user-menu-profile-button"
      >
        {/* Avatar with online indicator */}
        <div className="relative flex-shrink-0">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center">
              <span className="material-symbols-rounded text-on-surface-variant text-2xl">
                person
              </span>
            </div>
          )}
          {/* Online indicator */}
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#10b981] border-2 border-surface-container-lowest rounded-full" />
        </div>

        {/* Name, plan badge, email */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-on-surface truncate tracking-tight">
              {user.displayName}
            </span>
            {user.plan && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-gradient-to-br from-primary to-primary-container text-on-primary flex-shrink-0">
                {user.plan}
              </span>
            )}
          </div>
          <span className="text-sm text-on-surface-variant truncate block">
            {user.email}
          </span>
        </div>
      </button>

      {/* Tonal divider — Req 7.3 */}
      <div className="h-2 bg-surface-container-low" />

      {/* Menu items section */}
      <div className="p-2">
        {/* My Library — Req 7.4 */}
        <button
          type="button"
          onClick={onOpenLibrary}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-on-surface hover:bg-surface-container-low text-sm font-medium transition-colors ${isSigningOut ? 'pointer-events-none opacity-50' : ''
            }`}
          data-testid="user-menu-library-button"
        >
          <span className="material-symbols-rounded text-outline text-xl">
            folder
          </span>
          {t('userMenu.myLibrary')}
        </button>
      </div>

      {/* Tonal divider — Req 7.3 */}
      <div className="h-2 bg-surface-container-low" />

      {/* Sign Out section — Req 7.5 */}
      <div className="p-2">
        <button
          type="button"
          onClick={onSignOut}
          disabled={isSigningOut}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isSigningOut
            ? 'text-error opacity-70 pointer-events-none'
            : 'text-error hover:bg-error-container hover:text-on-error-container'
            }`}
          data-testid="user-menu-signout-button"
        >
          {isSigningOut ? (
            <span className="material-symbols-rounded animate-spin text-error text-[18px]">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-rounded text-xl">logout</span>
          )}
          {t('userMenu.signOut')}
        </button>
      </div>
    </div>
  );
}
