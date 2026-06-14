import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

const NAV = {
    admin: [
        { path: "/admin", label: "Tổng quan", icon: "📊" },
        { path: "/admin/users", label: "Tài khoản", icon: "👥" },
        { path: "/admin/templates", label: "Lịch cố định", icon: "📅" },
        { path: "/admin/schedules", label: "Lịch tháng", icon: "🗓️" },
        { path: "/admin/reports", label: "Báo cáo", icon: "📈" },
        { path: "/admin/settings", label: "Cài đặt", icon: "⚙️" },
    ],
    supervisor: [
        { path: "/supervisor", label: "Điểm danh", icon: "✅" },
    ],
    teacher: [
        { path: "/teacher", label: "Lịch dạy", icon: "📅" },
        { path: "/teacher/summary", label: "Tổng hợp", icon: "📊" },
    ]
}

const ROLE_LABEL = {
    admin: "Quản lý", supervisor: "Giám thị", teacher: "Giáo viên"
}

export default function Navbar() {
    const { userProfile, logout } = useAuth()
    const location = useLocation()
    const [open, setOpen] = useState(false)
    const role = userProfile?.role
    const items = NAV[role] || []

    const NavLinks = ({ onClick }) => (
        <>
            {items.map(item => {
                const active = location.pathname === item.path
                return (
                    <Link key={item.path} to={item.path}
                        onClick={onClick}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl
                        text-sm font-medium transition-all
              ${active
                                ? "bg-orange-50 text-orange-600 border-l-2 border-orange-500"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
                        <span className="text-base">{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                )
            })}
        </>
    )

    return (
        <>
            {/* Mobile topbar */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50
                      bg-white border-b border-gray-200
                      flex items-center justify-between px-4 h-14">
                <div className="flex items-center gap-2">
                    <span className="text-xl">📋</span>
                    <span className="text-gray-800 font-bold text-base">Chấm Công</span>
                </div>
                <button onClick={() => setOpen(!open)}
                    className="text-gray-500 text-xl p-1">
                    {open ? "✕" : "☰"}
                </button>
            </div>

            {/* Mobile menu */}
            {open && (
                <div className="lg:hidden fixed top-14 left-0 right-0 z-40
                        bg-white border-b border-gray-200 p-4
                        flex flex-col gap-1 shadow-lg">
                    <NavLinks onClick={() => setOpen(false)} />
                    <div className="border-t border-gray-100 mt-2 pt-2">
                        <button onClick={logout}
                            className="w-full text-left px-3 py-2.5 text-sm
                               text-gray-400 hover:text-gray-700
                               hover:bg-gray-50 rounded-xl transition-all">
                            🚪 Đăng xuất
                        </button>
                    </div>
                </div>
            )}

            {/* Desktop sidebar */}
            <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0
                        w-56 bg-white border-r border-gray-200 z-50">

                {/* Logo */}
                <div className="flex items-center gap-3 px-5 h-16
                border-b border-gray-100">
                    <img src="/logo.jpg" alt="Logo"
                        className="w-8 h-8 rounded-lg object-cover" />
                    <div>
                        <div className="text-gray-800 font-bold text-sm">Điểm Danh</div>
                        <div className="text-gray-400 text-xs">{ROLE_LABEL[role]}</div>
                    </div>
                </div>

                {/* Menu */}
                <div className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
                    <NavLinks />
                </div>

                {/* User info */}
                <div className="border-t border-gray-100 p-3">
                    <div className="flex items-center gap-3 px-2 py-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center
                            justify-center text-orange-600 font-bold text-sm
                            flex-shrink-0">
                            {userProfile?.displayName?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <div className="text-gray-800 text-xs font-semibold truncate">
                                {userProfile?.displayName}
                            </div>
                            <div className="text-gray-400 text-xs truncate">
                                {userProfile?.email}
                            </div>
                        </div>
                    </div>
                    <button onClick={logout}
                        className="w-full text-left px-3 py-2 text-xs text-gray-400
                             hover:text-gray-700 hover:bg-gray-50
                             rounded-lg transition-all">
                        🚪 Đăng xuất
                    </button>
                </div>
            </aside>
        </>
    )
}