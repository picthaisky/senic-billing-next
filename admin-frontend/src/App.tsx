import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TenantsList from './pages/TenantsList';
import PackagesList from './pages/PackagesList';
import Sidebar from './components/Sidebar';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-[var(--color-bg)]">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tenants" element={<TenantsList />} />
              <Route path="/packages" element={<PackagesList />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
