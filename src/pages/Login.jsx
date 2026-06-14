import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { getAuth, sendPasswordResetEmail } from "firebase/auth"
import toast from "react-hot-toast"

export default function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ email: "", password: "" })
    const [loading, setLoading] = useState(false)
    const [resetLoading, setResetLoading] = useState(false)

    async function handleForgotPassword() {
        if (!form.email.trim())
            return toast.error("Nhập email vào ô trên trước")
        setResetLoading(true)
        try {
            const auth = getAuth()
            await sendPasswordResetEmail(auth, form.email)
            toast.success("Đã gửi email đặt lại mật khẩu, kiểm tra hộp thư!")
        } catch (err) {
            if (err.code === "auth/user-not-found")
                toast.error("Email này chưa được đăng ký")
            else
                toast.error("Có lỗi xảy ra, thử lại sau")
        }
        setResetLoading(false)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setLoading(true)
        try {
            await login(form.email, form.password)
            navigate("/")
        } catch (err) {
            if (err.code === "auth/invalid-credential")
                toast.error("Email hoặc mật khẩu không đúng")
            else
                toast.error("Đăng nhập thất bại, thử lại sau")
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center
                    justify-center p-4">
            <div className="w-full max-w-sm">

                {/* Logo */}
                <div className="text-center mb-8">
                    <img src="/logo.jpg" alt="Logo"
                        className="w-14 h-14 rounded-2xl object-cover mx-auto mb-4
                    shadow-lg shadow-orange-200" />
                    <h1 className="text-gray-800 text-2xl font-bold">Điểm Danh</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Hệ thống điểm danh giáo viên
                    </p>
                </div>


                {/* Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-gray-700 font-semibold text-base mb-5">
                        Đăng nhập
                    </h2>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-gray-600 text-sm font-medium">Email</label>
                            <input type="email" required
                                placeholder="email@example.com"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                className="border border-gray-200 rounded-xl px-4 py-2.5
                           text-gray-800 text-sm outline-none bg-gray-50
                           focus:border-orange-400 focus:bg-white
                           transition-colors placeholder-gray-400" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-gray-600 text-sm font-medium">
                                    Mật khẩu
                                </label>
                                <button type="button" onClick={handleForgotPassword}
                                    disabled={resetLoading}
                                    className="text-orange-500 hover:text-orange-600 text-xs
               font-medium disabled:opacity-50 transition-colors">
                                    {resetLoading ? "Đang gửi..." : "Quên mật khẩu?"}
                                </button>
                            </div>
                            <input type="password" required
                                placeholder="••••••••"
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                className="border border-gray-200 rounded-xl px-4 py-2.5
                           text-gray-800 text-sm outline-none bg-gray-50
                           focus:border-orange-400 focus:bg-white
                           transition-colors placeholder-gray-400" />
                        </div>
                        <button type="submit" disabled={loading}
                            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50
                         text-gray-800 font-semibold py-2.5 rounded-xl text-sm
                         transition-all shadow-sm shadow-orange-200 mt-1">
                            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-gray-400 text-sm mt-5">
                    Chưa có tài khoản?{" "}
                    <Link to="/register"
                        className="text-orange-500 hover:text-orange-600 font-semibold">
                        Đăng ký
                    </Link>
                </p>
            </div>
        </div>
    )
}