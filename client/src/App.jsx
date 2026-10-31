import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProjectDiscoveryPage from './pages/ProjectDiscoveryPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ProjectDetailsPage from './pages/ProjectDetailsPage';
import EditProjectPage from './pages/EditProjectPage';
import SupervisorDirectoryPage from './pages/SupervisorDirectoryPage';
import SupervisorDashboardPage from './pages/SupervisorDashboardPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-container">
          <Navbar />

          <main style={{ flex: 1 }}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/projects" element={<ProjectDiscoveryPage />} />
              <Route path="/projects/:id" element={<ProjectDetailsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Student Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/new"
                element={
                  <ProtectedRoute>
                    <CreateProjectPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:id/edit"
                element={
                  <ProtectedRoute>
                    <EditProjectPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Supervisor Management Routes */}
              <Route
                path="/supervisors"
                element={
                  <ProtectedRoute>
                    <SupervisorDirectoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/supervisor/dashboard"
                element={
                  <ProtectedRoute>
                    <SupervisorDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Catch-All */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <footer className="footer">
            <div className="container">
              <p>ProjectForge — EE4207 University Web Application Development Mini Project</p>
              <p style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
                Built with MongoDB, Express.js, React.js, and Node.js.
              </p>
            </div>
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
