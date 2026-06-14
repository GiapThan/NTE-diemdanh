import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import toast from "react-hot-toast"

const SUBJECTS = [
    "Toán", "Lý", "Hóa", "Sinh", "KHTN",
    "Anh văn", "Ngữ văn", "Tiểu học", "Đánh giá năng lực"
]

export default function Register() {
    const { register } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({
        displayName: "", email: "", password: "",
        confirmPassword: "", requestedRole: "teacher", subject: ""
    })
    const [loading, setLoading] = useState(false)

    const set = field => e => setForm({ ...form, [field]: e.target.value })

    async function handleSubmit(e) {
        e.preventDefault()
        if (form.password !== form.confirmPassword)
            return toast.error("Mật khẩu xác nhận không khớp")
        if (form.password.length < 6)
            return toast.error("Mật khẩu phải ít nhất 6 ký tự")
        if (form.requestedRole === "teacher" && !form.subject.trim())
            return toast.error("Vui lòng nhập môn dạy")
        setLoading(true)
        try {
            await register(form)
            toast.success("Đăng ký thành công! Chờ quản lý duyệt.")
            navigate("/pending")
        } catch (err) {
            if (err.code === "auth/email-already-in-use")
                toast.error("Email này đã được đăng ký")
            else
                toast.error("Đăng ký thất bại, thử lại sau")
        }
        setLoading(false)
    }

    const inputCls = `border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800
                    text-sm outline-none bg-gray-50 focus:border-orange-400
                    focus:bg-white transition-colors placeholder-gray-400`

    return (
        <div className="min-h-screen bg-gray-50 flex items-center
                    justify-center p-4">
            <div className="w-full max-w-md">

                {/* Logo */}
                <div className="text-center mb-8">
                    <img src="/logo.jpg" alt="Logo"
                        className="w-14 h-14 rounded-2xl object-cover mx-auto mb-4
                    shadow-lg shadow-orange-200" />
                    <h1 className="text-gray-800 text-2xl font-bold">Đăng ký tài khoản</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Tài khoản cần được quản lý xét duyệt
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                        <div className="flex flex-col gap-1.5">
                            <label className="text-gray-600 text-sm font-medium">
                                Họ và tên <span className="text-red-400">*</span>
                            </label>
                            <input type="text" required placeholder="Nguyễn Văn A"
                                value={form.displayName} onChange={set("displayName")}
                                className={inputCls} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-gray-600 text-sm font-medium">
                                Email <span className="text-red-400">*</span>
                            </label>
                            <input type="email" required placeholder="email@example.com"
                                value={form.email} onChange={set("email")}
                                className={inputCls} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-gray-600 text-sm font-medium">
                                    Mật khẩu <span className="text-red-400">*</span>
                                </label>
                                <input type="password" required placeholder="••••••••"
                                    value={form.password} onChange={set("password")}
                                    className={inputCls} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-gray-600 text-sm font-medium">
                                    Xác nhận <span className="text-red-400">*</span>
                                </label>
                                <input type="password" required placeholder="••••••••"
                                    value={form.confirmPassword} onChange={set("confirmPassword")}
                                    className={inputCls} />
                            </div>
                        </div>

                        {/* Vai trò */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-gray-600 text-sm font-medium">
                                Vai trò <span className="text-red-400">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { val: "teacher", label: "👨‍🏫 Giáo viên" },
                                    { val: "supervisor", label: "👁️ Giám thị" }
                                ].map(r => (
                                    <button key={r.val} type="button"
                                        onClick={() => setForm({ ...form, requestedRole: r.val })}
                                        className={`py-2.5 rounded-xl border text-sm font-medium
                                transition-all
                      ${form.requestedRole === r.val
                                                ? "bg-orange-50 border-orange-400 text-orange-600"
                                                : "bg-gray-50 border-gray-200 text-gray-500"
                                            }`}>
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Môn dạy */}
                        {form.requestedRole === "teacher" && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-gray-600 text-sm font-medium">
                                    Môn dạy <span className="text-red-400">*</span>
                                </label>
                                <select value={form.subject} onChange={set("subject")}
                                    className={inputCls}>
                                    <option value="">-- Chọn môn dạy --</option>
                                    {SUBJECTS.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button type="submit" disabled={loading}
                            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50
                         text-gray-800 font-semibold py-2.5 rounded-xl text-sm
                         transition-all shadow-sm shadow-orange-200 mt-1">
                            {loading ? "Đang đăng ký..." : "Đăng ký tài khoản"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-gray-400 text-sm mt-5">
                    Đã có tài khoản?{" "}
                    <Link to="/login"
                        className="text-orange-500 hover:text-orange-600 font-semibold">
                        Đăng nhập
                    </Link>
                </p>
            </div>
        </div>
    )
}