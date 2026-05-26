import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ProfileProvider } from './context/ProfileContext';
import { ThemeProvider } from './context/ThemeContext';
import RequireProfile from './context/RequireProfile';
import Dashboard from './pages/Dashboard';
import StudySessionPage from './pages/StudySessionPage';
import SessionDetail from './pages/SessionDetail';
import SignIn from './pages/SignIn';
import Settings from './pages/Settings';

function App() {
  return (
    <ThemeProvider>
      <ProfileProvider>
        <Router>
          <div className="app-wrapper">
            <Routes>
              <Route path="/welcome" element={<SignIn />} />
              <Route
                path="/"
                element={
                  <RequireProfile>
                    <Dashboard />
                  </RequireProfile>
                }
              />
              <Route
                path="/session"
                element={
                  <RequireProfile>
                    <StudySessionPage />
                  </RequireProfile>
                }
              />
              <Route
                path="/sessions/:id"
                element={
                  <RequireProfile>
                    <SessionDetail />
                  </RequireProfile>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireProfile>
                    <Settings />
                  </RequireProfile>
                }
              />
            </Routes>
          </div>
        </Router>
      </ProfileProvider>
    </ThemeProvider>
  );
}

export default App;
