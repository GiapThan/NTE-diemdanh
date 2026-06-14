import { useState, useEffect } from "react"
import {
    collection, query, where, getDocs,
    updateDoc, deleteDoc, doc
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { format } from "date-fns"
import toast from "react-hot-toast"
import Navbar from "../../components/Navbar"

const ROLE_LABEL = { teacher: "Giáo viên", supervisor: "Giám thị", admin: "Quản lý" }
const SUBJECT_CODE = {
    "Toán": "TOAN",
    "Lý": "LY",
    "Hóa": "HOA",
    "Sinh": "SINH",
    "KHTN": "KHTN",
    "Anh văn": "ANH",
    "Ngữ văn": "VAN",
    "Tiểu học": "TH",
    "Đánh giá năng lực": "DGNL",
}

function getCodePrefix(role, subject) {
    if (role === "supervisor") return "GT"
    return SUBJECT_CODE[subject] || "GV"
}

export default function AdminUsers() {
    const { currentUser } = useAuth()
    const [pending, setPending] = useState([])
    const [approved, setApproved] = useState([])
    const [tab, setTab] = useState("pending")
    const [loading, setLoading] = useState(false)

    // Form duyệt
    const [approveForm, setApproveForm] = useState({})

    useEffect(() => { fetchUsers() }, [])

    async function fetchUsers() {
        setLoading(true)
        try {
            const [pendingSnap, approvedSnap] = await Promise.all([
                getDocs(query(collection(db, "users"), where("role", "==", "pending"))),
                getDocs(query(collection(db, "users"),
                    where("role", "in", ["teacher", "supervisor", "admin"])))
            ])
            setPending(pendingSnap.docs.map(d => ({ id: d.id, ...d.data() })))
            setApproved(approvedSnap.docs.map(d => ({ id: d.id, ...d.data() })))

            // Đếm số mã đã dùng theo từng prefix (từ các tài khoản đã duyệt)
            const usedCount = {}
            approvedSnap.docs.forEach(d => {
                const code = d.data().teacherCode || ""
                const match = code.match(/^([A-Z]+)_(\d+)$/)
                if (match) {
                    const prefix = match[1]
                    const num = parseInt(match[2], 10)
                    usedCount[prefix] = Math.max(usedCount[prefix] || 0, num)
                }
            })

            // Sắp xếp pending theo thời gian đăng ký để đánh số đúng thứ tự
            const pendingDocs = [...pendingSnap.docs].sort((a, b) => {
                const ta = a.data().createdAt?.toMillis?.() || 0
                const tb = b.data().createdAt?.toMillis?.() || 0
                return ta - tb
            })

            // Khởi tạo form duyệt — tự sinh mã theo prefix + số thứ tự tiếp theo
            const forms = {}
            pendingDocs.forEach(d => {
                const data = d.data()
                const role = data.requestedRole || "teacher"
                const prefix = getCodePrefix(role, data.subject)

                usedCount[prefix] = (usedCount[prefix] || 0) + 1
                const code = `${prefix}_${String(usedCount[prefix]).padStart(2, "0")}`

                forms[d.id] = { role, teacherCode: code }
            })
            setApproveForm(forms)
        } catch {
            toast.error("Không thể tải danh sách tài khoản")
        }
        setLoading(false)
    }

    async function handleApprove(user) {
        const form = approveForm[user.id]
        if (!form.teacherCode.trim())
            return toast.error("Vui lòng nhập mã")

        try {
            await updateDoc(doc(db, "users", user.id), {
                role: form.role,
                teacherCode: form.teacherCode.trim(),
                isActive: true,
                approvedBy: currentUser.uid,
                approvedAt: new Date()
            })
            toast.success(`Đã duyệt tài khoản ${user.displayName}`)
            fetchUsers()
        } catch {
            toast.error("Có lỗi xảy ra")
        }
    }

    async function handleReject(user) {
        if (!confirm(`Xác nhận từ chối tài khoản ${user.displayName}?`)) return
        try {
            await deleteDoc(doc(db, "users", user.id))
            toast.success("Đã từ chối tài khoản")
            fetchUsers()
        } catch {
            toast.error("Có lỗi xảy ra")
        }
    }

    async function handleDeactivate(user) {
        if (!confirm(`Xác nhận vô hiệu hoá tài khoản ${user.displayName}?`)) return
        try {
            await updateDoc(doc(db, "users", user.id), { isActive: false })
            toast.success("Đã vô hiệu hoá tài khoản")
            fetchUsers()
        } catch {
            toast.error("Có lỗi xảy ra")
        }
    }

    async function handleActivate(user) {
        if (!confirm(`Xác nhận mở lại tài khoản ${user.displayName}?`)) return
        try {
            await updateDoc(doc(db, "users", user.id), { isActive: true })
            toast.success("Đã mở lại tài khoản")
            fetchUsers()
        } catch {
            toast.error("Có lỗi xảy ra")
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 lg:pl-56
                    font-['Segoe_UI',sans-serif]">
            <Navbar />
            <div className="pt-16 lg:pt-0 p-4 md:p-8">

                <h1 className="text-2xl font-bold mb-6">Quản lý tài khoản</h1>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {[
                        { key: "pending", label: "Chờ duyệt", count: pending.length },
                        { key: "approved", label: "Đã duyệt", count: approved.length }
                    ].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-semibold
                          flex items-center gap-2 transition-all
                ${tab === t.key
                                    ? "bg-orange-500 text-gray-800"
                                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>
                            {t.label}
                            {t.count > 0 && (
                                <span className={`text-xs px-2 py-0.5 rounded-full
                  ${tab === t.key ? "bg-white/20" : "bg-gray-100"}`}>
                                    {t.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="text-gray-800/40 text-center py-12">Đang tải...</div>
                ) : tab === "pending" ? (
                    pending.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="text-5xl mb-4">✅</div>
                            <p className="text-gray-800/40">Không có tài khoản chờ duyệt</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 max-w-2xl">
                            {pending.map(user => (
                                <div key={user.id}
                                    className="bg-white border border-gray-200 rounded-2xl p-5">
                                    {/* Thông tin user */}
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br
                                    from-violet-500 to-purple-600 flex items-center
                                    justify-center text-gray-800 font-bold flex-shrink-0">
                                            {user.displayName?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-gray-800 font-semibold">{user.displayName}</div>
                                            <div className="text-gray-800/40 text-sm">{user.email}</div>
                                            <div className="flex gap-2 mt-1 flex-wrap">
                                                <span className="text-xs bg-gray-100 text-gray-800/60
                                         px-2 py-0.5 rounded-full">
                                                    Đăng ký: {ROLE_LABEL[user.requestedRole]}
                                                </span>
                                                {user.subject && (
                                                    <span className="text-xs bg-gray-100 text-gray-800/60
                                           px-2 py-0.5 rounded-full">
                                                        Môn: {user.subject}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Form duyệt */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-gray-800 text-xs">Cấp quyền</label>
                                            <select
                                                value={approveForm[user.id]?.role || "teacher"}
                                                onChange={e => {
                                                    const newRole = e.target.value
                                                    const oldCode = approveForm[user.id]?.teacherCode || ""
                                                    const numPart = oldCode.match(/_(\d+)$/)?.[1] || "01"
                                                    const newPrefix = newRole === "supervisor"
                                                    ? "GT"
                                                    : getCodePrefix("teacher", user.subject)
                                                    setApproveForm({
                                                        ...approveForm,
                                                        [user.id]: {
                                                            role: newRole,
                                                            teacherCode: `${newPrefix}_${numPart}`
                                                        }
                                                    })
                                                }}
                                                className="bg-gray-100 border border-white/15 rounded-xl
                                   px-3 py-2.5 text-gray-800 text-sm outline-none">
                                                <option value="teacher">Giáo viên</option>
                                                <option value="supervisor">Giám thị</option>
                                                <option value="admin">Quản lý</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-gray-600 text-xs">
                                                Mã {approveForm[user.id]?.role === "supervisor" ? "giám thị" : "giáo viên"}
                                            </label>
                                            <input
                                                type="text"
                                                value={approveForm[user.id]?.teacherCode || ""}
                                                onChange={e => setApproveForm({
                                                    ...approveForm,
                                                    [user.id]: {
                                                        ...approveForm[user.id],
                                                        teacherCode: e.target.value.toUpperCase()
                                                    }
                                                })}
                                                className="bg-gray-100 border border-gray-200 rounded-xl
               px-3 py-2.5 text-gray-800 text-sm outline-none
               font-mono"
                                            />
                                        </div>
                                    </div>

                                    {/* Nút hành động */}
                                    <div className="flex gap-3">
                                        <button onClick={() => handleReject(user)}
                                            className="flex-1 py-2.5 rounded-xl border border-red-500/30
                                 text-red-400 hover:bg-red-500/10 text-sm
                                 font-medium transition-all">
                                            Từ chối
                                        </button>
                                        <button onClick={() => handleApprove(user)}
                                            className="flex-1 py-2.5 rounded-xl bg-orange-500
                                 hover:bg-orange-600 text-gray-800 text-sm
                                 font-semibold transition-all">
                                            Duyệt ✓
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-800/40 border-b border-gray-200">
                                    <th className="text-left py-3 px-4 font-medium">Họ tên</th>
                                    <th className="text-left py-3 px-4 font-medium">Email</th>
                                    <th className="text-left py-3 px-4 font-medium">Vai trò</th>
                                    <th className="text-left py-3 px-4 font-medium">Mã GV</th>
                                    <th className="text-left py-3 px-4 font-medium">Trạng thái</th>
                                    <th className="text-left py-3 px-4 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {approved.map(user => (
                                    <tr key={user.id}
                                        className="border-b border-white/5 hover:bg-white/3">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br
                                        from-violet-500 to-purple-600 flex items-center
                                        justify-center text-gray-800 font-bold text-xs
                                        flex-shrink-0">
                                                    {user.displayName?.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-gray-800 font-medium">
                                                    {user.displayName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-gray-800">{user.email}</td>
                                        <td className="py-3 px-4">
                                            <span className="bg-violet-500/20 text-violet-300
                                       px-2 py-1 rounded-lg text-xs font-medium">
                                                {ROLE_LABEL[user.role]}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-gray-800">
                                            {user.teacherCode || "—"}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-medium
                        ${user.isActive
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-red-500/20 text-red-400"}`}>
                                                {user.isActive ? "Hoạt động" : "Đã khoá"}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            {user.role !== "admin" && (
                                                user.isActive ? (
                                                    <button onClick={() => handleDeactivate(user)}
                                                        className="text-xs text-gray-400 hover:text-red-500
                   transition-colors">
                                                        Vô hiệu hoá
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleActivate(user)}
                                                        className="text-xs text-gray-400 hover:text-green-600
                   font-medium transition-colors">
                                                        Mở lại
                                                    </button>
                                                )
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}