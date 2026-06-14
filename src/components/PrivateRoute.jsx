import { Navigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

export default function PrivateRoute({ children, allowedRoles }) {
    const { currentUser, userProfile } = useAuth()
    if (!currentUser) return <Navigate to="/login" />
    if (!userProfile) return null
    if (userProfile.role === "pending") return <Navigate to="/pending" />
    if (userProfile.isActive === false) return <Navigate to="/disabled" />
    if (allowedRoles && !allowedRoles.includes(userProfile.role))
        return <Navigate to="/" />
    return children
}