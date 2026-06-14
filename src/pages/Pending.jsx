import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

const ROLE_LABEL = { teacher: "Giáo viên", supervisor: "Giám thị" }

export default function Pending() {
    const { userProfile, logout } = useAuth()
    const navigate = useNavigate()

    async function handleLogout() {
        await logout()
        navigate("/login")
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center
                    justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200
                        p-8 text-center">
                    <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center
                          justify-center text-3xl mx-auto mb-4">
                        ⏳
                    </div>
                    <h1 className="text-gray-800 text-xl font-bold mb-2">
                        Chờ xác nhận tài khoản
                    </h1>
                    <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                        Xin chào{" "}
                        <span className="text-gray-700 font-semibold">
                            {userProfile?.displayName}
                        </span>
                        , tài khoản đang chờ quản lý xét duyệt.
                    </p>

                    {/* Thông tin */}
                    <div className="bg-gray-50 rounded-xl p-4 text-left mb-6
                          flex flex-col divide-y divide-gray-100">
                        {[
                            {
                                label: "Email",
                                value: userProfile?.email
                            },
                            {
                                label: "Vai trò đăng ký",
                                value: ROLE_LABEL[userProfile?.requestedRole]
                            },
                            ...(userProfile?.subject
                                ? [{ label: "Môn dạy", value: userProfile.subject }]
                                : [])
                        ].map(row => (
                            <div key={row.label}
                                className="flex justify-between items-center py-2.5">
                                <span className="text-gray-400 text-sm">{row.label}</span>
                                <span className="text-gray-700 text-sm font-medium">
                                    {row.value}
                                </span>
                            </div>
                        ))}
                        <div className="flex justify-between items-center py-2.5">
                            <span className="text-gray-400 text-sm">Trạng thái</span>
                            <span className="bg-yellow-100 text-yellow-700 border
                               border-yellow-200 rounded-full px-3 py-0.5
                               text-xs font-semibold">
                                Chờ duyệt
                            </span>
                        </div>
                    </div>

                    <p className="text-gray-300 text-xs mb-5">
                        Liên hệ quản lý nếu chờ quá 24 giờ.
                    </p>
                    <button onClick={handleLogout}
                        className="w-full py-2.5 rounded-xl border border-gray-200
                       text-gray-400 hover:bg-gray-50 hover:text-gray-600
                       text-sm font-medium transition-all">
                        Đăng xuất
                    </button>
                </div>
            </div>
        </div>
    )
}