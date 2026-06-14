import { useState, useEffect } from "react"
import {
    collection, getDocs, addDoc, updateDoc, deleteDoc,
    doc, query, where, writeBatch,
    serverTimestamp
} from "firebase/firestore"
import Calendar from "react-calendar"
import "react-calendar/dist/Calendar.css"
import { format, getDaysInMonth, getDay, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import toast from "react-hot-toast"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import Navbar from "../../components/Navbar"

const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const SUBJECTS = [
    "Toán", "Lý", "Hóa", "Sinh", "KHTN",
    "Anh văn", "Ngữ văn", "Tiểu học", "Đánh giá năng lực"
]
const SESSION_TYPES = [
    { value: "extra", label: "Tăng cường" },
    { value: "support", label: "Hỗ trợ" },
    { value: "makeup", label: "Bù buổi" },
]

export default function AdminSchedules() {
    const { currentUser } = useAuth()
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const [schedules, setSchedules] = useState([])
    const [templates, setTemplates] = useState([])
    const [teachers, setTeachers] = useState([])
    const [loading, setLoading] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [selectedTpls, setSelectedTpls] = useState([])
    const [showGenPanel, setShowGenPanel] = useState(false)
    const [subDialog, setSubDialog] = useState(null)
    const [subTeacherId, setSubTeacherId] = useState("")
    const [subNote, setSubNote] = useState("")

    // Form thêm buổi thủ công
    const [showForm, setShowForm] = useState(false)
    const [editItem, setEditItem] = useState(null)
    const blankForm = {
        teacherId: "", className: "", subject: "",
        room: "", date: "", startTime: "", endTime: "",
        type: "extra"
    }
    const [form, setForm] = useState(blankForm)

    // Filter
    const [filterTeacher, setFilterTeacher] = useState("")
    const [viewMode, setViewMode] = useState("month")
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [showCalendar, setShowCalendar] = useState(false)

    useEffect(() => { fetchData() }, [month, year])

    async function fetchData() {
        setLoading(true)
        const start = `${year}-${String(month).padStart(2, "0")}-01`
        const end = `${year}-${String(month).padStart(2, "0")}-31`
        try {
            const [schSnap, tplSnap, teacherSnap] = await Promise.all([
                getDocs(query(collection(db, "schedules"),
                    where("date", ">=", start), where("date", "<=", end))),
                getDocs(query(collection(db, "classTemplates"),
                    where("isActive", "==", true))),
                getDocs(query(collection(db, "users"),
                    where("role", "==", "teacher")))
            ])
            setSchedules(schSnap.docs.map(d => ({ id: d.id, ...d.data() })))
            setTemplates(tplSnap.docs.map(d => ({ id: d.id, ...d.data() })))
            setTeachers(teacherSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        } catch {
            toast.error("Không thể tải dữ liệu")
        }
        setLoading(false)
    }

    // Tạo lịch hàng loạt từ templates
    async function generateSchedules() {
        if (selectedTpls.length === 0)
            return toast.error("Chọn ít nhất 1 lớp để tạo lịch")

        const targets = templates.filter(t => selectedTpls.includes(t.id))

        if (!confirm(`Tạo lịch tháng ${month}/${year} cho ${targets.length} lớp đã chọn?`))
            return
        setGenerating(true)
        try {
            const daysInMonth = getDaysInMonth(new Date(year, month - 1))
            const batch = writeBatch(db)
            let count = 0

            for (const tpl of targets) {
                // Kiểm tra template còn hiệu lực trong tháng này
                const mStart = `${year}-${String(month).padStart(2, "0")}-01`
                const mEnd = `${year}-${String(month).padStart(2, "0")}-${daysInMonth}`
                if (tpl.effectiveTo < mStart || tpl.effectiveFrom > mEnd) continue

                for (let d = 1; d <= daysInMonth; d++) {
                    const date = new Date(year, month - 1, d)
                    const dateStr = format(date, "yyyy-MM-dd")
                    const dow = getDay(date) // 0=CN, 1=T2...

                    // Tìm slot khớp với ngày trong tuần này
                    const slot = (tpl.slots || []).find(s => s.dayOfWeek === dow)
                    if (!slot) continue
                    if (dateStr < tpl.effectiveFrom || dateStr > tpl.effectiveTo) continue

                    // Kiểm tra đã có buổi này chưa (cùng template + cùng ngày + cùng giờ)
                    const exists = schedules.some(s =>
                        s.templateId === tpl.id
                        && s.date === dateStr
                        && s.startTime === slot.startTime
                    )
                    if (exists) continue

                    const ref = doc(collection(db, "schedules"))
                    batch.set(ref, {
                        templateId: tpl.id,
                        type: "regular",
                        teacherId: tpl.teacherId,
                        teacherName: tpl.teacherName,
                        teacherCode: tpl.teacherCode,
                        className: tpl.className,
                        subject: tpl.subject,
                        room: tpl.room,
                        date: dateStr,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        status: "pending",
                        isCancelled: false,
                        isSubstituted: false,
                        originalTeacherId: null,
                        originalTeacherName: null,
                        supervisorCheckedIn: false,
                        checkInTime: null,
                        checkInNote: "",
                        recordedBy: null,
                        lateMinutes: 0,
                        isLate: false,
                        teacherDoneAt: null,
                        teacherNote: "",
                        createdBy: currentUser.uid,
                        createdAt: serverTimestamp()
                    })
                    count++
                }
            }

            await batch.commit()
            toast.success(`Đã tạo ${count} buổi dạy cho ${targets.length} lớp`)
            setSelectedTpls([])
            setShowGenPanel(false)
            fetchData()
        } catch (err) {
            toast.error("Có lỗi xảy ra: " + err.message)
        }
        setGenerating(false)
    }

    function toggleSelectTpl(id) {
        setSelectedTpls(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    function toggleSelectAll() {
        setSelectedTpls(prev =>
            prev.length === templates.length ? [] : templates.map(t => t.id)
        )
    }

    async function handleCancel(schedule) {
        const reason = prompt("Lý do huỷ buổi:")
        if (reason === null) return
        try {
            await updateDoc(doc(db, "schedules", schedule.id), {
                isCancelled: true,
                cancelReason: reason || "Không có lý do",
                cancelledBy: currentUser.uid,
                cancelledAt: serverTimestamp()
            })
            toast.success("Đã huỷ buổi dạy")
            fetchData()
        } catch { toast.error("Có lỗi xảy ra") }
    }

    async function handleRestore(schedule) {
        try {
            await updateDoc(doc(db, "schedules", schedule.id), {
                isCancelled: false, cancelReason: "",
                cancelledBy: null, cancelledAt: null
            })
            toast.success("Đã khôi phục buổi dạy")
            fetchData()
        } catch { toast.error("Có lỗi xảy ra") }
    }

    function openSubstitute(schedule) {
        setSubDialog(schedule)
        setSubTeacherId("")
        setSubNote("")
    }

    async function confirmSubstitute() {
        if (!subTeacherId) return toast.error("Chọn giáo viên dạy thay")
        const sub = teachers.find(t => t.id === subTeacherId)
        if (!sub) return toast.error("Không tìm thấy giáo viên")

        try {
            await updateDoc(doc(db, "schedules", subDialog.id), {
                type: "support",        // tiết Hỗ trợ
                isSubstituted: true,
                originalTeacherId: subDialog.teacherId,
                originalTeacherName: subDialog.teacherName,
                teacherId: sub.id,
                teacherName: sub.displayName,
                teacherCode: sub.teacherCode,
                substituteNote: subNote,
                substitutedBy: currentUser.uid,
                substitutedAt: serverTimestamp()
            })
            toast.success("Đã đổi giáo viên dạy thay")
            setSubDialog(null)
            fetchData()
        } catch { toast.error("Có lỗi xảy ra") }
    }

    async function handleAddExtra(e) {
        e.preventDefault()
        if (!form.teacherId) return toast.error("Chọn giáo viên")
        const teacher = teachers.find(t => t.id === form.teacherId)
        try {
            await addDoc(collection(db, "schedules"), {
                templateId: null,
                type: form.type,
                teacherId: teacher.id,
                teacherName: teacher.displayName,
                teacherCode: teacher.teacherCode,
                className: form.className,
                subject: form.subject,
                room: form.room,
                date: form.date,
                startTime: form.startTime,
                endTime: form.endTime,
                status: "pending",
                isCancelled: false,
                isSubstituted: false,
                originalTeacherId: null,
                originalTeacherName: null,
                supervisorCheckedIn: false,
                checkInTime: null,
                checkInNote: "",
                recordedBy: null,
                lateMinutes: 0,
                isLate: false,
                teacherDoneAt: null,
                teacherNote: "",
                createdBy: currentUser.uid,
                createdAt: serverTimestamp()
            })
            toast.success("Đã thêm buổi dạy")
            setShowForm(false)
            fetchData()
        } catch { toast.error("Có lỗi xảy ra") }
    }

    const selectedDateStr = format(selectedDate, "yyyy-MM-dd")

    const filtered = schedules
        .filter(s => !filterTeacher || s.teacherId === filterTeacher)
        .filter(s => viewMode === "month" || s.date === selectedDateStr)
        .sort((a, b) => a.date.localeCompare(b.date)
            || a.startTime.localeCompare(b.startTime))

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 lg:pl-56
                    font-['Segoe_UI',sans-serif]">
            <Navbar />
            <div className="pt-16 lg:pt-0 p-4 md:p-8">

                {/* Header */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <h1 className="text-2xl font-bold">Lịch tháng</h1>
                    <div className="flex gap-2 ml-auto flex-wrap">
                        <select value={month} onChange={e => setMonth(+e.target.value)}
                            className="bg-gray-100 border border-white/15 rounded-xl
                         px-3 py-2 text-gray-800 text-sm outline-none">
                            {MONTHS.map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                        <select value={year} onChange={e => setYear(+e.target.value)}
                            className="bg-gray-100 border border-white/15 rounded-xl
                         px-3 py-2 text-gray-800 text-sm outline-none">
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Actions */}
                {/* Dòng 1: điều khiển chế độ xem */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className="flex bg-gray-100 rounded-xl p-1">
                        <button onClick={() => setViewMode("month")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium
                          transition-all
                ${viewMode === "month"
                                    ? "bg-white text-gray-800 shadow-sm"
                                    : "text-gray-500"}`}>
                            Cả tháng
                        </button>
                        <button onClick={() => setViewMode("day")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium
                          transition-all
                ${viewMode === "day"
                                    ? "bg-white text-gray-800 shadow-sm"
                                    : "text-gray-500"}`}>
                            Theo ngày
                        </button>
                    </div>

                    {/* Chọn ngày — luôn chiếm chỗ, ẩn bằng invisible khi ở mode tháng */}
                    <div className={`relative ${viewMode === "day" ? "" : "invisible"}`}>
                        <button onClick={() => setShowCalendar(!showCalendar)}
                            className="bg-white border border-gray-200 px-4 py-2
                         rounded-xl text-sm font-medium text-gray-700
                         hover:border-orange-400 transition-all
                         flex items-center gap-2">
                            📅 {format(selectedDate, "dd/MM/yyyy", { locale: vi })}
                        </button>

                        {showCalendar && viewMode === "day" && (
                            <div className="absolute top-full left-0 mt-2 z-50
                              bg-white rounded-2xl shadow-2xl border
                              border-gray-200 overflow-hidden">
                                <Calendar
                                    onChange={(date) => {
                                        setSelectedDate(date)
                                        setShowCalendar(false)
                                        setMonth(date.getMonth() + 1)
                                        setYear(date.getFullYear())
                                    }}
                                    value={selectedDate}
                                    locale="vi-VN"
                                />
                            </div>
                        )}
                    </div>

                    {/* Filter giáo viên — đẩy sang phải */}
                    <select value={filterTeacher}
                        onChange={e => setFilterTeacher(e.target.value)}
                        className="bg-white border border-gray-200 rounded-xl
                       px-3 py-2 text-gray-700 text-sm outline-none
                       ml-auto focus:border-orange-400">
                        <option value="">Tất cả giáo viên</option>
                        {teachers.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.displayName} ({t.teacherCode})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Dòng 2: hành động — vị trí cố định, không phụ thuộc viewMode */}
                <div className="flex flex-wrap gap-3 mb-6">
                    <button onClick={() => setShowGenPanel(!showGenPanel)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white
                       px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
                        ⚡ Tạo lịch từ template
                    </button>
                    <button onClick={() => { setEditItem(null); setForm(blankForm); setShowForm(true) }}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5
                       rounded-xl text-sm font-semibold transition-all">
                        + Thêm buổi lẻ
                    </button>
                </div>

                {/* Panel chọn template để tạo lịch */}
                {showGenPanel && (
                    <div className="bg-white border border-gray-200 rounded-2xl
                          p-5 mb-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-gray-800">
                                    Chọn lớp để tạo lịch tháng {month}/{year}
                                </h3>
                                <p className="text-gray-400 text-xs mt-0.5">
                                    Chỉ các lớp được chọn mới được tạo lịch
                                </p>
                            </div>
                            <button onClick={toggleSelectAll}
                                className="text-orange-500 text-sm font-medium
                           hover:text-orange-600 transition-colors">
                                {selectedTpls.length === templates.length
                                    ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                            </button>
                        </div>

                        {templates.length === 0 ? (
                            <p className="text-gray-400 text-sm text-center py-6">
                                Chưa có lịch cố định nào — tạo ở trang "Lịch cố định" trước
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                                {templates.map(tpl => (
                                    <label key={tpl.id}
                                        className={`flex items-center gap-3 rounded-xl border p-3
                               cursor-pointer transition-all
                      ${selectedTpls.includes(tpl.id)
                                                ? "bg-orange-50 border-orange-300"
                                                : "bg-gray-50 border-gray-200 hover:border-gray-300"}`}>
                                        <input type="checkbox"
                                            checked={selectedTpls.includes(tpl.id)}
                                            onChange={() => toggleSelectTpl(tpl.id)}
                                            className="w-4 h-4 accent-orange-500 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-gray-800 font-semibold text-sm">
                                                {tpl.className} — {tpl.subject}
                                            </div>
                                            <div className="text-gray-400 text-xs truncate">
                                                {tpl.teacherName} ·{" "}
                                                {(tpl.slots || []).map(s =>
                                                    `${DAYS[s.dayOfWeek]} ${s.startTime}`
                                                ).join(", ")}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => { setShowGenPanel(false); setSelectedTpls([]) }}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200
                           text-gray-500 hover:bg-gray-50 text-sm font-medium
                           transition-all">
                                Huỷ
                            </button>
                            <button onClick={generateSchedules}
                                disabled={generating || selectedTpls.length === 0}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-600
                           hover:bg-emerald-700 disabled:opacity-50
                           text-white text-sm font-semibold transition-all">
                                {generating
                                    ? "Đang tạo..."
                                    : `Tạo lịch cho ${selectedTpls.length} lớp đã chọn`}
                            </button>
                        </div>
                    </div>
                )}

                {/* Thống kê nhanh */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {[
                        {
                            label: "Tổng buổi", value: filtered.length,
                            color: "text-gray-800"
                        },
                        {
                            label: "Đã dạy",
                            value: filtered.filter(s => s.teacherDoneAt).length,
                            color: "text-green-400"
                        },
                        {
                            label: "Đã điểm danh",
                            value: filtered.filter(s => s.supervisorCheckedIn).length,
                            color: "text-orange-500"
                        },
                        {
                            label: "Đã huỷ",
                            value: schedules.filter(s =>
                                filterTeacher ? s.teacherId === filterTeacher : true
                            ).filter(s => s.isCancelled).length,
                            color: "text-red-400"
                        },
                    ].map(stat => (
                        <div key={stat.label}
                            className="bg-white border border-gray-200 rounded-2xl p-4">
                            <div className={`text-2xl font-bold ${stat.color}`}>
                                {stat.value}
                            </div>
                            <div className="text-gray-800/40 text-xs mt-1">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Tiêu đề danh sách */}
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-gray-500 text-sm font-semibold">
                        {viewMode === "month"
                            ? `Lịch tháng ${month}/${year}`
                            : `Lịch ngày ${format(selectedDate, "dd/MM/yyyy", { locale: vi })}`}
                        {filterTeacher && (
                            <span className="text-gray-400">
                                {" "}— {teachers.find(t => t.id === filterTeacher)?.displayName}
                            </span>
                        )}
                    </h2>
                    <span className="text-gray-400 text-sm">
                        {filtered.length} buổi
                    </span>
                </div>

                {/* Danh sách */}
                {loading ? (
                    <div className="text-gray-800 text-center py-12">Đang tải...</div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {filtered.map(s => (
                            <div key={s.id}
                                className={`flex flex-wrap md:flex-nowrap items-center gap-3
                            rounded-2xl border p-4 transition-all
                  ${s.isCancelled
                                        ? "bg-red-500/10 border-red-500/20 opacity-60"
                                        : s.teacherDoneAt
                                            ? "bg-green-500/10 border-green-500/20"
                                            : s.supervisorCheckedIn
                                                ? "bg-violet-500/10 border-violet-500/20"
                                                : "bg-white border-gray-200"}`}>

                                {/* Ngày */}
                                <div className="w-16 text-center flex-shrink-0">
                                    <div className="text-gray-800 text-xs">
                                        {DAYS[getDay(parseISO(s.date))]}
                                    </div>
                                    <div className="text-gray-800 font-bold text-lg leading-none">
                                        {s.date.slice(8)}
                                    </div>
                                    <div className="text-gray-800/30 text-xs">/{s.date.slice(5, 7)}</div>
                                </div>

                                {/* Thông tin */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-gray-800 font-semibold">{s.className}</span>
                                        <span className="text-gray-800 text-sm">{s.subject}</span>
                                        {s.type === "extra" && (
                                            <span className="text-xs bg-blue-50 text-blue-600
                   px-2 py-0.5 rounded-full">Tăng cường</span>
                                        )}
                                        {s.type === "support" && (
                                            <span className="text-xs bg-purple-50 text-purple-600
                   px-2 py-0.5 rounded-full">Hỗ trợ</span>
                                        )}
                                        {s.type === "makeup" && (
                                            <span className="text-xs bg-pink-50 text-pink-600
                   px-2 py-0.5 rounded-full">Bù buổi</span>
                                        )}
                                        {s.isSubstituted && (
                                            <span className="text-xs bg-yellow-500/20 text-yellow-400
                                       px-2 py-0.5 rounded-full">Dạy thay</span>
                                        )}
                                        {s.isCancelled && (
                                            <span className="text-xs bg-red-500/20 text-red-400
                                       px-2 py-0.5 rounded-full">Đã huỷ</span>
                                        )}
                                    </div>
                                    <div className="font-semibold text-xs mt-1 flex gap-3 flex-wrap">
                                        <span>👨‍🏫 {s.teacherName}</span>
                                        <span>🕐 {s.startTime}–{s.endTime}</span>
                                        <span>📍 {s.room}</span>
                                    </div>
                                </div>

                                {/* Nút thao tác */}
                                <div className="flex gap-2 flex-shrink-0">
                                    {!s.isCancelled ? (
                                        <>
                                            <button onClick={() => openSubstitute(s)}
                                                className="px-3 py-1.5 rounded-lg bg-yellow-50
             text-yellow-600 text-xs font-medium
             hover:bg-yellow-100 transition-all">
                                                Đổi GV
                                            </button>
                                            <button onClick={() => handleCancel(s)}
                                                className="px-3 py-1.5 rounded-lg bg-red-500/20
                                   text-red-400 text-xs font-medium
                                   hover:bg-red-500/30 transition-all">
                                                Huỷ
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => handleRestore(s)}
                                            className="px-3 py-1.5 rounded-lg bg-gray-100
                                 text-gray-800 text-xs font-medium
                                 hover:bg-white/20 transition-all">
                                            Khôi phục
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Dialog đổi giáo viên dạy thay */}
            {subDialog && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm
                        flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-gray-200 rounded-2xl
                          p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-gray-800 font-bold text-lg mb-1">
                            Đổi giáo viên dạy thay
                        </h3>
                        <p className="text-gray-400 text-sm mb-4">
                            {subDialog.className} — {subDialog.subject} ·{" "}
                            {subDialog.date} · {subDialog.startTime}–{subDialog.endTime}
                        </p>

                        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
                            <span className="text-gray-400">Giáo viên hiện tại: </span>
                            <span className="text-gray-800 font-medium">
                                {subDialog.teacherName}
                            </span>
                        </div>

                        <div className="flex flex-col gap-1.5 mb-4">
                            <label className="text-gray-600 text-xs">
                                Giáo viên dạy thay (môn {subDialog.subject})
                            </label>
                            <select value={subTeacherId}
                                onChange={e => setSubTeacherId(e.target.value)}
                                className="bg-gray-50 border border-gray-200 rounded-xl
                           px-3 py-2.5 text-gray-800 text-sm outline-none
                           focus:border-orange-400">
                                <option value="">-- Chọn giáo viên --</option>
                                {teachers
                                    .filter(t => t.subject === subDialog.subject
                                        && t.id !== subDialog.teacherId)
                                    .map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.displayName} ({t.teacherCode})
                                        </option>
                                    ))}
                            </select>
                            {teachers.filter(t => t.subject === subDialog.subject
                                && t.id !== subDialog.teacherId).length === 0 && (
                                    <p className="text-orange-500 text-xs mt-1">
                                        Không có giáo viên khác dạy môn {subDialog.subject}
                                    </p>
                                )}
                        </div>

                        <div className="flex flex-col gap-1.5 mb-5">
                            <label className="text-gray-600 text-xs">Lý do thay thế</label>
                            <input value={subNote} onChange={e => setSubNote(e.target.value)}
                                placeholder="GV chính nghỉ bệnh..."
                                className="bg-gray-50 border border-gray-200 rounded-xl
                           px-3 py-2.5 text-gray-800 text-sm outline-none
                           placeholder-gray-400 focus:border-orange-400" />
                        </div>

                        <div className="bg-purple-50 text-purple-600 text-xs
                            rounded-xl px-3 py-2 mb-4">
                            ℹ️ Buổi này sẽ được đánh dấu là <strong>Hỗ trợ</strong> và
                            chuyển sang lịch dạy của giáo viên được chọn.
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setSubDialog(null)}
                                className="flex-1 py-3 rounded-xl border border-gray-200
                           text-gray-500 hover:bg-gray-50 text-sm font-medium">
                                Huỷ
                            </button>
                            <button onClick={confirmSubstitute}
                                className="flex-1 py-3 rounded-xl bg-orange-500
                           hover:bg-orange-600 text-white text-sm
                           font-semibold transition-all">
                                Xác nhận đổi GV
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Form thêm buổi lẻ */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm
                        flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-gray-200 rounded-2xl
                          p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-gray-800 font-bold text-lg mb-5">
                            Thêm buổi dạy
                        </h3>
                        <form onSubmit={handleAddExtra} className="flex flex-col gap-4">

                            <div className="flex flex-col gap-1.5">
                                <label className="text-gray-600 text-xs">Loại buổi</label>
                                <select value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value })}
                                    className="bg-gray-50 border border-gray-200 rounded-xl
               px-3 py-2.5 text-gray-800 text-sm outline-none
               focus:border-orange-400">
                                    {SESSION_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-gray-800 text-xs">Giáo viên</label>
                                <select value={form.teacherId}
                                    onChange={e => setForm({ ...form, teacherId: e.target.value })}
                                    className="bg-gray-100 border border-white/15 rounded-xl
                             px-3 py-2.5 text-gray-800 text-sm outline-none">
                                    <option value="">-- Chọn --</option>
                                    {teachers.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.displayName} ({t.teacherCode})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-gray-800 text-xs">Lớp</label>
                                    <input value={form.className} placeholder="12A1" required
                                        onChange={e => setForm({ ...form, className: e.target.value })}
                                        className="bg-gray-100 border border-white/15 rounded-xl
                               px-3 py-2.5 text-gray-800 text-sm outline-none
                               placeholder-white/30" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-gray-800 text-xs">Phòng</label>
                                    <input value={form.room} placeholder="P.201" required
                                        onChange={e => setForm({ ...form, room: e.target.value })}
                                        className="bg-gray-100 border border-white/15 rounded-xl
                               px-3 py-2.5 text-gray-800 text-sm outline-none
                               placeholder-white/30" />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-gray-600 text-xs">Môn học</label>
                                <select value={form.subject} required
                                    onChange={e => setForm({ ...form, subject: e.target.value })}
                                    className="bg-gray-50 border border-gray-200 rounded-xl
               px-3 py-2.5 text-gray-800 text-sm outline-none
               focus:border-orange-400">
                                    <option value="">-- Chọn môn học --</option>
                                    {SUBJECTS.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-gray-800 text-xs">Ngày dạy</label>
                                <input type="date" value={form.date} required
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="bg-gray-100 border border-white/15 rounded-xl
                             px-3 py-2.5 text-gray-800 text-sm outline-none" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-gray-800 text-xs">Giờ bắt đầu</label>
                                    <input type="time" value={form.startTime} required
                                        onChange={e => setForm({ ...form, startTime: e.target.value })}
                                        className="bg-gray-100 border border-white/15 rounded-xl
                               px-3 py-2.5 text-gray-800 text-sm outline-none" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-gray-800 text-xs">Giờ kết thúc</label>
                                    <input type="time" value={form.endTime} required
                                        onChange={e => setForm({ ...form, endTime: e.target.value })}
                                        className="bg-gray-100 border border-white/15 rounded-xl
                               px-3 py-2.5 text-gray-800 text-sm outline-none" />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button type="button" onClick={() => setShowForm(false)}
                                    className="flex-1 py-3 rounded-xl border border-white/15
                             text-gray-800 text-sm font-medium">
                                    Huỷ
                                </button>
                                <button type="submit"
                                    className="flex-1 py-3 rounded-xl bg-orange-500
                             hover:bg-orange-600 text-gray-800 text-sm
                             font-semibold transition-all">
                                    Thêm buổi
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}