import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import PrivateRoute from "./components/PrivateRoute"

import Login from "./pages/Login"
import Register from "./pages/Register"
import Pending from "./pages/Pending"
import Disabled from "./pages/Disabled"

import AdminDashboard from "./pages/admin/Dashboard"
import AdminUsers from "./pages/admin/Users"
import AdminTemplates from "./pages/admin/Templates"
import AdminSchedules from "./pages/admin/Schedules"
import AdminReports from "./pages/admin/Reports"
import AdminSettings from "./pages/admin/Settings"

import SupervisorCheckin from "./pages/supervisor/Checkin"

import TeacherSchedule from "./pages/teacher/Schedule"
import TeacherSummary from "./pages/teacher/Summary"

function HomeRedirect() {
  const { userProfile } = useAuth()
  if (!userProfile) return null
  if (userProfile.role === "admin") return <Navigate to="/admin" />
  if (userProfile.role === "supervisor") return <Navigate to="/supervisor" />
  if (userProfile.role === "teacher") return <Navigate to="/teacher" />
  return <Navigate to="/pending" />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/pending" element={<Pending />} />
      <Route path="/disabled" element={<Disabled />} />

      <Route path="/" element={
        <PrivateRoute><HomeRedirect /></PrivateRoute>
      } />

      {/* Admin */}
      <Route path="/admin" element={
        <PrivateRoute allowedRoles={["admin"]}><AdminDashboard /></PrivateRoute>
      } />
      <Route path="/admin/users" element={
        <PrivateRoute allowedRoles={["admin"]}><AdminUsers /></PrivateRoute>
      } />
      <Route path="/admin/templates" element={
        <PrivateRoute allowedRoles={["admin"]}><AdminTemplates /></PrivateRoute>
      } />
      <Route path="/admin/schedules" element={
        <PrivateRoute allowedRoles={["admin"]}><AdminSchedules /></PrivateRoute>
      } />
      <Route path="/admin/reports" element={
        <PrivateRoute allowedRoles={["admin"]}><AdminReports /></PrivateRoute>
      } />
      <Route path="/admin/settings" element={
        <PrivateRoute allowedRoles={["admin"]}><AdminSettings /></PrivateRoute>
      } />

      {/* Supervisor */}
      <Route path="/supervisor" element={
        <PrivateRoute allowedRoles={["supervisor"]}><SupervisorCheckin /></PrivateRoute>
      } />

      {/* Teacher */}
      <Route path="/teacher" element={
        <PrivateRoute allowedRoles={["teacher"]}><TeacherSchedule /></PrivateRoute>
      } />
      <Route path="/teacher/summary" element={
        <PrivateRoute allowedRoles={["teacher"]}><TeacherSummary /></PrivateRoute>
      } />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}