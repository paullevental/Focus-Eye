import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CoverPage from './pages/CoverPage';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <div className="app-wrapper">
        <Routes>
          {/* Dashboard is now the main entry point */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/setup" element={<CoverPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
