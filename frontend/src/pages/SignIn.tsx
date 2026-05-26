import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import './SignIn.css';

interface FromState { from?: string }

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError('Please enter your first name.');
      return;
    }
    signIn({ firstName, lastName });
    const dest = (location.state as FromState | null)?.from || '/';
    navigate(dest, { replace: true });
  };

  return (
    <div className="signin-shell">
      <div className="signin-bg" aria-hidden />

      <main className="signin-card">
        <div className="signin-badge">
          <Sparkles size={14} /> Welcome to FocusEye
        </div>
        <h1 className="signin-title">Let's get you set up.</h1>
        <p className="signin-subtitle">
          Tell us your name so we can label your sessions. Nothing leaves your device beyond this.
        </p>

        <form className="signin-form" onSubmit={handleSubmit}>
          <label className="signin-field">
            <span>First name</span>
            <input
              autoFocus
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={40}
              placeholder="Paul"
            />
          </label>

          <label className="signin-field">
            <span>Last name <em>(optional)</em></span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={40}
              placeholder="Levental"
            />
          </label>

          {error && <p className="signin-error">{error}</p>}

          <button type="submit" className="signin-submit">
            Continue <ArrowRight size={16} />
          </button>
        </form>

        <p className="signin-footnote">
          You can change this anytime from the profile menu in the top-right.
        </p>
      </main>
    </div>
  );
}
