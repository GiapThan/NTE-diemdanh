import { useState, useEffect } from "react"
import {
    collection, getDocs, addDoc, updateDoc,
    deleteDoc, doc, query, where,
    serverTimestamp
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
import Navbar from "../../components/Navbar"

const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
const SUBJECTS = [
    "Toán", "Lý", "Hóa", "Sinh", "KHTN",
    "Anh văn", "Ngữ văn", "Tiểu học", "Đánh giá năng lực"
]

export default function AdminTemplates() {
    const { currentUser } = useAuth()
    const [templates, setTemplates] = useState([])
    const [teachers, setTeachers] = useState([])
    const [loading, setLoading] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [editItem, setEditItem] = useState(null)

    const blankForm = {
        teacherId: "", className: "", subject: "",
        room: "", effectiveFrom: "", effectiveTo: "",
        isActive: true,
        slots: [{ dayOfWeek: 1, startTime: "17:45", endTime: "19:15" }, { dayOfWeek: 3, startTime: "17:45", endTime: "19:15" }]
    }
    const [form, setForm] = useState(blankForm)

    useEffect(() => { fetchAll() }, [])

    async function fetchAll() {
        setLoading(true)
        try {
            const [tplSnap, teacherSnap] = await Promise.all([
                getDocs(collection(db, "classTemplates")),
                getDocs(query(collection(db, "users"),
                    where("role", "==", "teacher")))
            ])
            setTemplates(tplSnap.docs.map(d => ({ id: d.id, ...d.data() })))
            setTeachers(teacherSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        } catch {
            toast.error("Không thể tải dữ liệu")
        }
        setLoading(false)
    }

    // ── Quản lý slots trong form ──
    function addSlot() {
        setForm(f => ({
            ...f,
            slots: [...f.slots, { dayOfWeek: 1, startTime: "17:45", endTime: "19:15" }]
        }))
    }

    function removeSlot(index) {
        setForm(f => ({
            ...f,
            slots: f.slots.filter((_, i) => i !== index)
        }))
    }

    function updateSlot(index, field, value) {
        setForm(f => ({
            ...f,
            slots: f.slots.map((s, i) =>
                i === index ? { ...s, [field]: value } : s
            )
        }))
    }

    function openEdit(tpl) {
        setEditItem(tpl)
        setForm({
            teacherId: tpl.teacherId,
            className: tpl.className,
            subject: tpl.subject,
            room: tpl.room,
            effectiveFrom: tpl.effectiveFrom,
            effectiveTo: tpl.effectiveTo,
            isActive: tpl.isActive,
            slots: tpl.slots && tpl.slots.length > 0
                ? tpl.slots
                : blankForm.slots
        })
        setShowForm(true)
    }

    function openCreate() {
        setEditItem(null)
        setForm(blankForm)
        setShowForm(true)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.teacherId) return toast.error("Chọn giáo viên")
        if (!form.className.trim()) return toast.error("Nhập tên lớp")
        if (!form.subject.trim()) return toast.error("Nhập môn học")
        if (!form.room.trim()) return toast.error("Nhập phòng học")
        if (form.slots.length === 0) return toast.error("Thêm ít nhất 1 khung giờ")
        if (!form.effectiveFrom || !form.effectiveTo)
            return toast.error("Nhập ngày hiệu lực")

        // Kiểm tra mỗi slot có giờ kết thúc sau giờ bắt đầu
        for (const slot of form.slots) {
            if (slot.startTime >= slot.endTime)
                return toast.error(`Khung giờ ${DAYS[slot.dayOfWeek]} không hợp lệ (giờ kết thúc phải sau giờ bắt đầu)`)
        }

        // Kiểm tra trùng ngày trong tuần (1 ngày chỉ nên có 1 khung giờ)
        const days = form.slots.map(s => s.dayOfWeek)
        if (new Set(days).size !== days.length)
            return toast.error("Không thể chọn trùng 2 khung giờ cho cùng 1 ngày")

        const teacher = teachers.find(t => t.id === form.teacherId)
        const payload = {
            teacherId: form.teacherId,
            teacherName: teacher.displayName,
            teacherCode: teacher.teacherCode,
            className: form.className.trim(),
            subject: form.subject.trim(),
            room: form.room.trim(),
            effectiveFrom: form.effectiveFrom,
            effectiveTo: form.effectiveTo,
            isActive: form.isActive,
            slots: [...form.slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
            updatedAt: serverTimestamp()
        }

        try {
            if (editItem) {
                await updateDoc(doc(db, "classTemplates", editItem.id), payload)
                toast.success("Đã cập nhật lịch")
            } else {
                await addDoc(collection(db, "classTemplates"), {
                    ...payload,
                    createdBy: currentUser.uid,
                    createdAt: serverTimestamp()
                })
                toast.success("Đã tạo lịch")
            }
            setShowForm(false)
            fetchAll()
        } catch (err) {
            toast.error("Có lỗi xảy ra: " + err.message)
        }
    }

    async function handleDelete(tpl) {
        if (!confirm(`Xoá lịch ${tpl.className}?`)) return
        try {
            await deleteDoc(doc(db, "classTemplates", tpl.id))
            toast.success("Đã xoá")
            fetchAll()
        } catch {
            toast.error("Có lỗi xảy ra")
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 lg:pl-56">
            <Navbar />
            <div className="pt-16 lg:pt-0 p-4 md:p-8">

                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">Lịch dạy cố định</h1>
                    <button onClick={openCreate}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5
                       rounded-xl text-sm font-semibold transition-all">
                        + Thêm lớp
                    </button>
                </div>

                {loading ? (
                    <div className="text-gray-400 text-center py-12">Đang tải...</div>
                ) : templates.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4">📅</div>
                        <p className="text-gray-400">Chưa có lịch cố định nào</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {templates.map(tpl => (
                            <div key={tpl.id}
                                className="bg-white border border-gray-200 rounded-2xl p-5
                              shadow-sm">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="text-gray-800 font-bold text-base">
                                            {tpl.className}
                                        </div>
                                        <div className="text-gray-500 text-sm">{tpl.subject}</div>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium
                    ${tpl.isActive
                                            ? "bg-green-50 text-green-600"
                                            : "bg-red-50 text-red-500"}`}>
                                        {tpl.isActive ? "Đang dạy" : "Dừng"}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-1.5 text-sm text-gray-600">
                                    <div>👨‍🏫 {tpl.teacherName} ({tpl.teacherCode})</div>
                                    <div>📍 {tpl.room}</div>

                                    {/* Danh sách khung giờ */}
                                    <div className="flex flex-col gap-1 mt-2">
                                        {(tpl.slots || []).map((slot, i) => (
                                            <div key={i}
                                                className="flex items-center gap-2 bg-orange-50
                                      rounded-lg px-2.5 py-1.5 text-xs">
                                                <span className="bg-orange-500 text-white font-bold
                                         rounded-md px-1.5 py-0.5 w-9 text-center">
                                                    {DAYS[slot.dayOfWeek]}
                                                </span>
                                                <span className="text-orange-700 font-medium">
                                                    {slot.startTime} – {slot.endTime}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="text-gray-400 text-xs mt-1">
                                        {tpl.effectiveFrom} → {tpl.effectiveTo}
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <button onClick={() => openEdit(tpl)}
                                        className="flex-1 py-2 rounded-xl bg-gray-100
                               hover:bg-gray-200 text-gray-600 text-xs
                               font-medium transition-all">
                                        Sửa
                                    </button>
                                    <button onClick={() => handleDelete(tpl)}
                                        className="flex-1 py-2 rounded-xl border border-red-200
                               hover:bg-red-50 text-red-500 text-xs
                               font-medium transition-all">
                                        Xoá
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Form thêm/sửa */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm
                        flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-gray-200 rounded-2xl
                          p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-gray-800 font-bold text-lg mb-5">
                            {editItem ? "Sửa lịch dạy" : "Thêm lớp mới"}
                        </h3>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                            <div className="flex flex-col gap-1.5">
                                <label className="text-gray-600 text-xs">Giáo viên</label>
                                <select value={form.teacherId}
                                    onChange={e => setForm({ ...form, teacherId: e.target.value })}
                                    className="bg-gray-50 border border-gray-200 rounded-xl
                             px-3 py-2.5 text-gray-800 text-sm outline-none
                             focus:border-orange-400">
                                    <option value="">-- Chọn giáo viên --</option>
                                    {teachers.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.displayName} ({t.teacherCode}) — {t.subject}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-gray-600 text-xs">Tên lớp</label>
                                    <input value={form.className}
                                        onChange={e => setForm({ ...form, className: e.target.value })}
                                        placeholder="12A1" required
                                        className="bg-gray-50 border border-gray-200 rounded-xl
                               px-3 py-2.5 text-gray-800 text-sm outline-none
                               placeholder-gray-400 focus:border-orange-400" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-gray-600 text-xs">Phòng</label>
                                    <input value={form.room}
                                        onChange={e => setForm({ ...form, room: e.target.value })}
                                        placeholder="CS1 P.2" required
                                        className="bg-gray-50 border border-gray-200 rounded-xl
                               px-3 py-2.5 text-gray-800 text-sm outline-none
                               placeholder-gray-400 focus:border-orange-400" />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-gray-600 text-xs">Môn học</label>
                                <select value={form.subject}
                                    onChange={e => setForm({ ...form, subject: e.target.value })}
                                    required
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 text-sm outline-none focus:border-orange-400">
                                    <option value="">-- Chọn môn học --</option>
                                    {SUBJECTS.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Khung giờ học — slots */}
                            <div className="flex flex-col gap-2">
                                <label className="text-gray-600 text-xs">Khung giờ học</label>

                                {form.slots.map((slot, i) => (
                                    <div key={i}
                                        className="flex items-center gap-2 bg-gray-50
                                  border border-gray-200 rounded-xl p-2.5">
                                        <select value={slot.dayOfWeek}
                                            onChange={e => updateSlot(i, "dayOfWeek", Number(e.target.value))}
                                            className="bg-white border border-gray-200 rounded-lg
                                 px-2 py-2 text-gray-800 text-sm outline-none
                                 focus:border-orange-400 w-20">
                                            {DAYS.map((d, idx) => (
                                                <option key={idx} value={idx}>{d}</option>
                                            ))}
                                        </select>

                                        <input type="time" value={slot.startTime}
                                            onChange={e => updateSlot(i, "startTime", e.target.value)}
                                            className="bg-white border border-gray-200 rounded-lg
                                 px-2 py-2 text-gray-800 text-sm outline-none
                                 focus:border-orange-400 flex-1" />

                                        <span className="text-gray-400 text-sm">→</span>

                                        <input type="time" value={slot.endTime}
                                            onChange={e => updateSlot(i, "endTime", e.target.value)}
                                            className="bg-white border border-gray-200 rounded-lg
                                 px-2 py-2 text-gray-800 text-sm outline-none
                                 focus:border-orange-400 flex-1" />

                                        <button type="button" onClick={() => removeSlot(i)}
                                            disabled={form.slots.length === 1}
                                            className="text-gray-400 hover:text-red-500
                                 disabled:opacity-30 disabled:cursor-not-allowed
                                 text-lg px-1 transition-colors">
                                            ✕
                                        </button>
                                    </div>
                                ))}

                                <button type="button" onClick={addSlot}
                                    className="flex items-center justify-center gap-2 py-2
                             rounded-xl border border-dashed border-gray-300
                             text-gray-500 hover:border-orange-400
                             hover:text-orange-500 text-sm font-medium
                             transition-all">
                                    + Thêm khung giờ
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-gray-600 text-xs">Hiệu lực từ</label>
                                    <input type="date" value={form.effectiveFrom}
                                        onChange={e => setForm({ ...form, effectiveFrom: e.target.value })}
                                        className="bg-gray-50 border border-gray-200 rounded-xl
                               px-3 py-2.5 text-gray-800 text-sm outline-none
                               focus:border-orange-400" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-gray-600 text-xs">Đến ngày</label>
                                    <input type="date" value={form.effectiveTo}
                                        onChange={e => setForm({ ...form, effectiveTo: e.target.value })}
                                        className="bg-gray-50 border border-gray-200 rounded-xl
                               px-3 py-2.5 text-gray-800 text-sm outline-none
                               focus:border-orange-400" />
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="isActive" checked={form.isActive}
                                    onChange={e => setForm({ ...form, isActive: e.target.checked })}
                                    className="w-4 h-4 accent-orange-500" />
                                <label htmlFor="isActive" className="text-gray-600 text-sm">
                                    Đang hoạt động
                                </label>
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button type="button" onClick={() => setShowForm(false)}
                                    className="flex-1 py-3 rounded-xl border border-gray-200
                             text-gray-500 hover:bg-gray-50 text-sm font-medium">
                                    Huỷ
                                </button>
                                <button type="submit"
                                    className="flex-1 py-3 rounded-xl bg-orange-500
                             hover:bg-orange-600 text-white text-sm
                             font-semibold transition-all">
                                    {editItem ? "Cập nhật" : "Tạo lịch"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}