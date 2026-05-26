import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import './UserMenu.css';

/**
 * Top-right profile chip. Click → /settings. Shows the user's initials in a
 * dark avatar and their display name beside it.
 */
export default function UserMenu() {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const displayName = profile
    ? `${profile.firstName}${profile.lastName ? ' ' + profile.lastName : ''}`
    : '';
  const initials =
    (profile?.firstName?.[0] ?? '?') + (profile?.lastName?.[0] ?? '');

  return (
    <button
      type="button"
      className="user-menu"
      onClick={() => navigate('/settings')}
      aria-label="Open profile settings"
    >
      <span className="user-menu-name">{displayName}</span>
      <span className="user-menu-avatar">{initials.trim().toUpperCase()}</span>
    </button>
  );
}
