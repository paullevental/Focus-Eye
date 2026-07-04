import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface Profile {
  firstName: string;
  lastName: string;
}

interface ProfileContextValue {
  profile: Profile | null;
  signIn: (p: Profile) => void;
  signOut: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
}

const STORAGE_KEY = 'focus-user-profile';
const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

function loadStored(): Profile | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p.firstName === 'string' && p.firstName.trim()) {
      return {
        firstName: p.firstName.trim(),
        lastName: typeof p.lastName === 'string' ? p.lastName.trim() : '',
      };
    }
  } catch {
    // fall through and treat as no profile
  }
  return null;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(loadStored);

  useEffect(() => {
    if (profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(STORAGE_KEY);
  }, [profile]);

  const signIn = useCallback((p: Profile) => {
    const firstName = p.firstName.trim();
    if (!firstName) return;
    setProfile({ firstName, lastName: p.lastName?.trim() ?? '' });
  }, []);

  const signOut = useCallback(() => setProfile(null), []);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const merged: Profile = {
        firstName: patch.firstName?.trim() || prev.firstName,
        lastName:
          patch.lastName !== undefined ? patch.lastName.trim() : prev.lastName,
      };
      return merged;
    });
  }, []);

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, signIn, signOut, updateProfile }),
    [profile, signIn, signOut, updateProfile]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives with its provider by design
export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}

/** Convenience: returns the firstName as the API username, or empty string. */
// eslint-disable-next-line react-refresh/only-export-components -- hook lives with its provider by design
export function useUsername(): string {
  const { profile } = useProfile();
  return profile?.firstName ?? '';
}
