/**
 * Unit tests for UserMenuAuthenticated component
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  UserMenuAuthenticated,
  type UserMenuAuthenticatedProps,
} from './UserMenuAuthenticated';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function renderMenu(overrides: Partial<UserMenuAuthenticatedProps> = {}) {
  const defaultProps: UserMenuAuthenticatedProps = {
    user: {
      displayName: 'John Doe',
      email: 'john@example.com',
    },
    onSignOut: vi.fn(),
    ...overrides,
  };
  return { ...render(<UserMenuAuthenticated {...defaultProps} />), props: defaultProps };
}

describe('UserMenuAuthenticated', () => {
  describe('Popover container (Req 7.1)', () => {
    it('renders with correct popover styling classes', () => {
      renderMenu();
      const container = screen.getByTestId('user-menu-authenticated');
      expect(container).toHaveClass('bg-surface-container-lowest/80');
      expect(container).toHaveClass('backdrop-blur-[20px]');
      expect(container).toHaveClass('rounded-xl');
    });
  });

  describe('Header Block (Req 7.2)', () => {
    it('displays user display name', () => {
      renderMenu();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('displays user email', () => {
      renderMenu();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('displays plan badge when plan is provided', () => {
      renderMenu({ user: { displayName: 'Jane', email: 'jane@test.com', plan: 'PRO' } });
      expect(screen.getByText('PRO')).toBeInTheDocument();
    });

    it('does not display plan badge when plan is not provided', () => {
      renderMenu();
      expect(screen.queryByText('PRO')).not.toBeInTheDocument();
    });

    it('displays avatar image when avatarUrl is provided', () => {
      renderMenu({
        user: {
          displayName: 'Jane',
          email: 'jane@test.com',
          avatarUrl: 'https://example.com/avatar.png',
        },
      });
      const img = screen.getByAltText('Jane');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
    });

    it('displays fallback person icon when no avatarUrl', () => {
      renderMenu();
      expect(screen.getByText('person')).toBeInTheDocument();
    });

    it('calls onOpenProfile when header block is clicked', () => {
      const onOpenProfile = vi.fn();
      renderMenu({ onOpenProfile });
      fireEvent.click(screen.getByTestId('user-menu-profile-button'));
      expect(onOpenProfile).toHaveBeenCalledTimes(1);
    });

    it('renders online indicator', () => {
      const { container } = renderMenu();
      const indicator = container.querySelector('.bg-\\[\\#10b981\\]');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Tonal dividers (Req 7.3)', () => {
    it('renders tonal dividers with correct classes', () => {
      const { container } = renderMenu();
      const dividers = container.querySelectorAll('.h-2.bg-surface-container-low');
      expect(dividers.length).toBe(2);
    });
  });

  describe('My Library item (Req 7.4)', () => {
    it('renders My Library button with folder icon', () => {
      renderMenu();
      expect(screen.getByText('folder')).toBeInTheDocument();
      expect(screen.getByTestId('user-menu-library-button')).toBeInTheDocument();
    });

    it('calls onOpenLibrary when clicked', () => {
      const onOpenLibrary = vi.fn();
      renderMenu({ onOpenLibrary });
      fireEvent.click(screen.getByTestId('user-menu-library-button'));
      expect(onOpenLibrary).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sign Out item (Req 7.5)', () => {
    it('renders Sign Out button with logout icon', () => {
      renderMenu();
      expect(screen.getByText('logout')).toBeInTheDocument();
      expect(screen.getByTestId('user-menu-signout-button')).toBeInTheDocument();
    });

    it('calls onSignOut when clicked', () => {
      const onSignOut = vi.fn();
      renderMenu({ onSignOut });
      fireEvent.click(screen.getByTestId('user-menu-signout-button'));
      expect(onSignOut).toHaveBeenCalledTimes(1);
    });

    it('has error text color styling', () => {
      renderMenu();
      const btn = screen.getByTestId('user-menu-signout-button');
      expect(btn).toHaveClass('text-error');
    });
  });

  describe('isSigningOut state (Req 11.4)', () => {
    it('shows spinning progress_activity icon when isSigningOut is true', () => {
      renderMenu({ isSigningOut: true });
      const spinner = screen.getByText('progress_activity');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
      expect(spinner).toHaveClass('text-error');
    });

    it('hides logout icon when isSigningOut is true', () => {
      renderMenu({ isSigningOut: true });
      expect(screen.queryByText('logout')).not.toBeInTheDocument();
    });

    it('disables other menu items when isSigningOut is true', () => {
      renderMenu({ isSigningOut: true });
      const profileBtn = screen.getByTestId('user-menu-profile-button');
      const libraryBtn = screen.getByTestId('user-menu-library-button');
      expect(profileBtn).toHaveClass('pointer-events-none');
      expect(profileBtn).toHaveClass('opacity-50');
      expect(libraryBtn).toHaveClass('pointer-events-none');
      expect(libraryBtn).toHaveClass('opacity-50');
    });

    it('does not disable items when isSigningOut is false', () => {
      renderMenu({ isSigningOut: false });
      const profileBtn = screen.getByTestId('user-menu-profile-button');
      const libraryBtn = screen.getByTestId('user-menu-library-button');
      expect(profileBtn).not.toHaveClass('pointer-events-none');
      expect(libraryBtn).not.toHaveClass('pointer-events-none');
    });
  });
});
