/**
 * Unit tests for UserMenuGuest component
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserMenuGuest, type UserMenuGuestProps } from './UserMenuGuest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

function renderMenu(overrides: Partial<UserMenuGuestProps> = {}) {
  const defaultProps: UserMenuGuestProps = {
    onSignIn: vi.fn(),
    ...overrides,
  };
  return { ...render(<UserMenuGuest {...defaultProps} />), props: defaultProps };
}

describe('UserMenuGuest', () => {
  describe('Popover container (Req 8.2)', () => {
    it('renders with correct popover styling classes', () => {
      renderMenu();
      const container = screen.getByTestId('user-menu-guest');
      expect(container).toHaveClass('w-[340px]');
      expect(container).toHaveClass('bg-surface-container-lowest/80');
      expect(container).toHaveClass('backdrop-blur-[20px]');
      expect(container).toHaveClass('rounded-[1.25rem]');
      expect(container).toHaveClass('border');
      expect(container).toHaveClass('border-outline-variant/15');
    });
  });

  describe('Info banner (Req 8.3)', () => {
    it('renders info banner with correct styling', () => {
      const { container } = renderMenu();
      const banner = container.querySelector('.bg-primary\\/5');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveClass('p-6');
      expect(banner).toHaveClass('border-b');
      expect(banner).toHaveClass('border-outline-variant/10');
    });

    it('renders auto_awesome icon in circular container', () => {
      renderMenu();
      expect(screen.getByText('auto_awesome')).toBeInTheDocument();
    });

    it('renders value proposition text', () => {
      renderMenu();
      expect(
        screen.getByText(
          'Sign in to sync your theme, typography, and unlock powerful AI models across all devices.'
        )
      ).toBeInTheDocument();
    });

    it('renders value proposition text with correct styling', () => {
      renderMenu();
      const text = screen.getByText(
        'Sign in to sync your theme, typography, and unlock powerful AI models across all devices.'
      );
      expect(text).toHaveClass('text-[0.9rem]');
      expect(text).toHaveClass('font-medium');
      expect(text).toHaveClass('leading-[1.6]');
      expect(text).toHaveClass('text-on-surface-variant');
    });
  });

  describe('Sign In / Sign Up button (Req 8.4, 8.6)', () => {
    it('renders Sign In / Sign Up button', () => {
      renderMenu();
      expect(screen.getByTestId('user-menu-signin-button')).toBeInTheDocument();
      expect(screen.getByText('Sign In / Sign Up')).toBeInTheDocument();
    });

    it('has correct styling classes', () => {
      renderMenu();
      const btn = screen.getByTestId('user-menu-signin-button');
      expect(btn).toHaveClass('w-full');
      expect(btn).toHaveClass('bg-primary');
      expect(btn).toHaveClass('text-on-primary');
      expect(btn).toHaveClass('py-[0.875rem]');
      expect(btn).toHaveClass('px-5');
      expect(btn).toHaveClass('rounded-[0.75rem]');
      expect(btn).toHaveClass('font-semibold');
      expect(btn).toHaveClass('text-[0.95rem]');
      expect(btn).toHaveClass('tracking-wide');
    });

    it('renders arrow_right_alt icon', () => {
      renderMenu();
      expect(screen.getByText('arrow_right_alt')).toBeInTheDocument();
    });

    it('calls onSignIn when clicked', () => {
      const onSignIn = vi.fn();
      renderMenu({ onSignIn });
      fireEvent.click(screen.getByTestId('user-menu-signin-button'));
      expect(onSignIn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Explore Features link (Req 8.5)', () => {
    it('renders Explore Features link when onExploreFeatures is provided', () => {
      const onExploreFeatures = vi.fn();
      renderMenu({ onExploreFeatures });
      expect(screen.getByTestId('user-menu-explore-button')).toBeInTheDocument();
      expect(screen.getByText('Explore Features')).toBeInTheDocument();
    });

    it('does not render Explore Features link when onExploreFeatures is not provided', () => {
      renderMenu();
      expect(screen.queryByTestId('user-menu-explore-button')).not.toBeInTheDocument();
    });

    it('has correct styling classes', () => {
      const onExploreFeatures = vi.fn();
      renderMenu({ onExploreFeatures });
      const link = screen.getByTestId('user-menu-explore-button');
      expect(link).toHaveClass('text-[0.8rem]');
      expect(link).toHaveClass('font-medium');
      expect(link).toHaveClass('text-outline');
      expect(link).toHaveClass('uppercase');
      expect(link).toHaveClass('tracking-[0.05em]');
    });

    it('calls onExploreFeatures when clicked', () => {
      const onExploreFeatures = vi.fn();
      renderMenu({ onExploreFeatures });
      fireEvent.click(screen.getByTestId('user-menu-explore-button'));
      expect(onExploreFeatures).toHaveBeenCalledTimes(1);
    });
  });

  describe('Guest state restrictions (Req 8.7)', () => {
    it('does not render Profile, Subscription, My Library, or Sign Out items', () => {
      renderMenu();
      expect(screen.queryByText('Profile')).not.toBeInTheDocument();
      expect(screen.queryByText('Subscription')).not.toBeInTheDocument();
      expect(screen.queryByText('My Library')).not.toBeInTheDocument();
      expect(screen.queryByText('Sign Out')).not.toBeInTheDocument();
      expect(screen.queryByText('person')).not.toBeInTheDocument();
      expect(screen.queryByText('logout')).not.toBeInTheDocument();
      expect(screen.queryByText('folder')).not.toBeInTheDocument();
    });
  });
});
