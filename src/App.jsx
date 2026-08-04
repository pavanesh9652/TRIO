import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import NewOrder from './pages/NewOrder';
import Orders from './pages/Orders';
import AdminMenu from './pages/AdminMenu';
import OrderLogs from './pages/OrderLogs';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/orders/new" element={<NewOrder />} />
            <Route path="/orders" element={<Orders />} />
            <Route
              path="/admin/menu"
              element={
                <ProtectedRoute adminOnly>
                  <AdminMenu />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/logs"
              element={
                <ProtectedRoute adminOnly>
                  <OrderLogs />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/orders/new" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
