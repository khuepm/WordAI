/**
 * UserMenuGuest - Guest user menu popover content.
 * Displays an info banner inviting the user to sign in, a Sign In / Sign Up button,
 * and an Explore Features link.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import { useTranslation } from 'react-i18next';

export interface UserMenuGuestProps {
  onSignIn: () => void;
  onExploreFeatures?: () => void;
}

export function UserMenuGuest({ onSignIn, onExploreFeatures }: UserMenuGuestProps) {
  const { t } = useTranslation();

  return (
    <div
      className="w-[340px] bg-surface-container-lowest/80 backdrop-blur-[20px] rounded-[1.25rem] border border-outline-variant/15 shadow-[0_24px_60px_-10px_rgba(25,28,29,0.06)]"
      data-testid="user-menu-guest"
    >
      {/* Info banner — Req 8.3 */}
      <div className="p-6 bg-primary/5 border-b border-outline-variant/10">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-rounded fill text-primary text-[1.125rem]">
              auto_awesome
            </span>
          </div>
          <p className="text-[0.9rem] font-medium leading-[1.6] text-on-surface-variant">
            {t('userMenu.guestBanner', {
              defaultValue:
                'Sign in to sync your theme, typography, and unlock powerful AI models across all devices.',
            })}
          </p>
        </div>
      </div>

      {/* Actions section */}
      <div className="p-6 flex flex-col items-center gap-4">
        {/* Sign In / Sign Up button — Req 8.4, 8.6 */}
        <button
          type="button"
          onClick={onSignIn}
          className="group w-full bg-primary text-on-primary py-[0.875rem] px-5 rounded-[0.75rem] font-semibold text-[0.95rem] tracking-wide flex items-center justify-center gap-2 transition-shadow hover:shadow-[0_0_16px_rgba(67,67,213,0.4)]"
          data-testid="user-menu-signin-button"
        >
          {t('userMenu.signInSignUp', { defaultValue: 'Sign In / Sign Up' })}
          <span className="material-symbols-rounded text-[1.25rem] transition-transform group-hover:translate-x-1">
            arrow_right_alt
          </span>
        </button>

        {/* Explore Features link — Req 8.5 */}
        {onExploreFeatures && (
          <button
            type="button"
            onClick={onExploreFeatures}
            className="text-[0.8rem] font-medium text-outline hover:text-primary uppercase tracking-[0.05em] transition-colors bg-transparent border-none cursor-pointer"
            data-testid="user-menu-explore-button"
          >
            {t('userMenu.exploreFeatures', { defaultValue: 'Explore Features' })}
          </button>
        )}
      </div>
    </div>
  );
}
