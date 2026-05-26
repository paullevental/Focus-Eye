import { Navigate, useLocation } from 'react-router-dom';
import { useProfile } from './ProfileContext';
import type { ReactNode } from 'react';

/**
 * Auth gate: if the user has no profile in context, redirect them to /welcome.
 * The original target is preserved in location.state so SignIn can bounce them
 * back after they finish signing in.
 */
export default function RequireProfile({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const location = useLocation();

  if (!profile) {
    return <Navigate to="/welcome" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}
