import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/features/auth/AuthContext'
import { ThemeProvider } from '@/features/theme/ThemeContext'
import { ToastProvider } from '@/contexts/ToastContext'
import LoginPage from '@/features/auth/LoginPage'
import AppLayout from '@/components/layout/AppLayout'
import DashboardPage from '@/features/dashboard/DashboardPage'
import CheckInPage from '@/features/checkin/CheckInPage'
import CheckOutPage from '@/features/checkout/CheckOutPage'
import UsersPage from '@/features/users/UsersPage'
import ServicesPage from '@/features/services/ServicesPage'
import SettingsPage from '@/features/settings/SettingsPage'
import ClassesPage from '@/features/classes/ClassesPage'
import ReportsPage from '@/features/reports/ReportsPage'
import ProfilePage from '@/features/profile/ProfilePage'
import ChildrenPage from '@/features/children/ChildrenPage'
import AttendancePage from '@/features/attendance/AttendancePage'
import SchedulePage from '@/features/schedule/SchedulePage'
import TermsPage from '@/features/legal/TermsPage'
import PrivacyPage from '@/features/legal/PrivacyPage'
import NotFoundPage from '@/features/errors/NotFoundPage'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'ADMIN') return <Navigate to="/checkin" replace />
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/terms"   element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/login"   element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<AdminRoute><DashboardPage /></AdminRoute>} />
                    <Route path="/checkin" element={<CheckInPage />} />
                    <Route path="/checkout" element={<CheckOutPage />} />
                    <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
                    <Route path="/services" element={<AdminRoute><ServicesPage /></AdminRoute>} />
                    <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
                    <Route path="/classes" element={<AdminRoute><ClassesPage /></AdminRoute>} />
                    <Route path="/reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
                    <Route path="/children" element={<ChildrenPage />} />
                    <Route path="/attendance" element={<AttendancePage />} />
                    <Route path="/schedule" element={<SchedulePage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </AppLayout>
              </PrivateRoute>
            }
          />
        </Routes>
      </ToastProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
