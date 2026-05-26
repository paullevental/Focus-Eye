import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Save } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import ThemeToggle from '../components/ThemeToggle';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const { profile, updateProfile, signOut } = useProfile();

  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    updateProfile({ firstName, lastName });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const handleSignOut = () => {
    if (!window.confirm('Sign out? Your local profile will be cleared.')) return;
    signOut();
    navigate('/welcome', { replace: true });
  };

  return (
    <div className="settings-shell">
      <nav className="settings-topbar">
        <button className="settings-back" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <ThemeToggle />
      </nav>

      <main className="settings-main">
        <header className="settings-header">
          <h1>Profile</h1>
          <p>Update how you appear and manage your local account.</p>
        </header>

        <form className="settings-card" onSubmit={handleSave}>
          <label className="settings-field">
            <span>First name</span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={40}
            />
          </label>
          <label className="settings-field">
            <span>Last name</span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={40}
            />
          </label>

          <div className="settings-actions">
            <button type="submit" className="settings-save">
              <Save size={16} /> {saved ? 'Saved' : 'Save changes'}
            </button>
          </div>
        </form>

        <section className="settings-card danger">
          <div className="settings-row-text">
            <h2>Sign out</h2>
            <p>
              FocusEye keeps your profile in your browser only. Signing out clears it
              from this device.
            </p>
          </div>
          <button type="button" className="settings-signout" onClick={handleSignOut}>
            <LogOut size={16} /> Sign out
          </button>
        </section>
      </main>
    </div>
  );
}
