import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

export default function Disabled() {
    const { logout } = useAuth()
    const navigate = useNavigate()

    async function handleLogout() {
        await logout()
        navigate("/login")
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200
                        p-8 text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center
                          justify-center text-3xl mx-auto mb-4">
                        🚫
                    </div>
                    <h1 className="text-gray-800 text-xl font-bold mb-2">
                        Tài khoản đã bị khoá
                    </h1>
                    <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                        Tài khoản của bạn đã bị quản lý vô hiệu hoá.
                        Vui lòng liên hệ quản lý để được hỗ trợ.
                    </p>
                    <button onClick={handleLogout}
                        className="w-full py-2.5 rounded-xl border border-gray-200
                       text-gray-500 hover:bg-gray-50 hover:text-gray-700
                       text-sm font-medium transition-all">
                        Đăng xuất
                    </button>
                </div>
            </div>
        </div>
    )
}