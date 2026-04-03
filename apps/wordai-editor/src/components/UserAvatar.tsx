/**
 * UserAvatar - Displays a boring-avatars avatar for a user.
 * Falls back to an anonymous animal alias when no authenticated user is provided.
 */

import Avatar from 'boring-avatars';
import { getAnonymousAlias } from '../utils/anonymousAlias';

const PALETTE = ['#92A1C6', '#146A7C', '#F0AB3D', '#C271B4', '#C20D90'];

interface UserAvatarProps {
  /** Display name of the authenticated user. Leave undefined if not logged in. */
  name?: string;
  size?: number;
  /** Called when the avatar button is clicked. */
  onClick?: () => void;
}

export function UserAvatar({ name, size = 32, onClick }: UserAvatarProps) {
  const displayName = name ?? getAnonymousAlias();

  return (
    <button
      onClick={onClick}
      title={displayName}
      aria-label={`User: ${displayName}`}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        overflow: 'hidden',
      }}
    >
      <Avatar
        name={displayName}
        variant="beam"
        size={size}
        colors={PALETTE}
      />
    </button>
  );
}
