import { useState, useEffect } from "react"
import Calendar from "react-calendar"
import "react-calendar/dist/Calendar.css"
import {
    collection, query, where, getDocs,
    updateDoc, doc, serverTimestamp, Timestamp
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { format, isAfter, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import toast from "react-hot-toast"
import Navbar from "../../components/Navbar"
import ScheduleCard from "../../components/ScheduleCard"

const LATE_REASONS = [
    "Lỗi mạng, không điểm danh đúng giờ được",
    "Bận công việc khác",
    "Quên điểm danh",
    "Khác (nhập lý do)"
]

export default function SupervisorCheckin() {

    const { currentUser } = useAuth()
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [showCalendar, setShowCalendar] = useState(false)
    const [schedules, setSchedules] = useState([])
    const [loading, setLoading] = useState(false)

    // Hộp thoại nhập giờ thủ công
    const [dialog, setDialog] = useState(null) // schedule object
    const [manualTime, setManualTime] = useState("")
    const [lateReason, setLateReason] = useState(LATE_REASONS[0])
    const [customReason, setCustomReason] = useState("")
    const [confirming, setConfirming] = useState(null)

    const dateStr = format(selectedDate, "yyyy-MM-dd")

    useEffect(() => { fetchSchedules() }, [selectedDate])

    async function fetchSchedules() {
        setLoading(true)
        try {
            const q = query(
                collection(db, "schedules"),
                where("date", "==", dateStr),
                where("isCancelled", "==", false)
            )
            const snap = await getDocs(q)
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            data.sort((a, b) => a.startTime.localeCompare(b.startTime))
            setSchedules(data)
        } catch {
            toast.error("Không thể tải lịch dạy")
        }
        setLoading(false)
    }

    // isLate = true nghĩa là giám thị bấm sau khi tiết kết thúc → mở dialog nhập giờ
    function handleCheckin(schedule, isLate) {
        if (isLate) {
            setManualTime(schedule.startTime)
            setLateReason(LATE_REASONS[0])
            setCustomReason("")
            setDialog(schedule)
        } else {
            setConfirming(schedule.id)
        }
    }

    function cancelConfirm() {
        setConfirming(null)
    }

    function confirmCheckin(schedule) {
        submitCheckin(schedule, null)
        setConfirming(null)
    }

    async function submitCheckin(schedule, overrideTime, reasonText) {
        if (overrideTime && !reasonText?.trim()) {
            return toast.error("Vui lòng nhập lý do điểm danh trễ")
        }
        try {
            let checkInTimestamp

            if (overrideTime) {
                // Giám thị nhập giờ thủ công
                const [h, m] = overrideTime.split(":").map(Number)
                const d = new Date(`${schedule.date}T00:00:00`)
                d.setHours(h, m, 0)
                checkInTimestamp = Timestamp.fromDate(d)
            } else {
                checkInTimestamp = serverTimestamp()
            }

            // Tính số phút trễ
            const [sh, sm] = schedule.startTime.split(":").map(Number)
            const scheduledStart = new Date(`${schedule.date}T${schedule.startTime}:00`)
            const checkInDate = overrideTime
                ? (() => {
                    const [h, m] = overrideTime.split(":").map(Number)
                    const d = new Date(`${schedule.date}T00:00:00`)
                    d.setHours(h, m, 0)
                    return d
                })()
                : new Date()

            const lateMs = checkInDate - scheduledStart
            const lateMinutes = lateMs > 0 ? Math.floor(lateMs / 60000) : 0

            await updateDoc(doc(db, "schedules", schedule.id), {
                supervisorCheckedIn: true,
                checkInTime: checkInTimestamp,
                checkInNote: overrideTime ? reasonText.trim() : "",
                recordedBy: currentUser.uid,
                lateMinutes,
                isLate: lateMinutes > 0
            })

            toast.success("Điểm danh thành công!")
            setDialog(null)
            setConfirming(null)
            fetchSchedules()
        } catch {
            toast.error("Có lỗi xảy ra, thử lại sau")
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800
                    lg:pl-56 font-['Segoe_UI',sans-serif]">
            <Navbar />

            <div className="pt-16 lg:pt-0 p-4 md:p-8 max-w-2xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-6 mt-2">
                    <div>
                        <h1 className="text-2xl font-bold">Điểm danh</h1>
                        <p className="text-gray-800 text-sm mt-0.5">
                            {format(selectedDate, "EEEE, dd/MM/yyyy", { locale: vi })}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCalendar(!showCalendar)}
                        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600
                       px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    >
                        📅 Chọn ngày
                    </button>
                </div>

                {/* Calendar popup */}
                {showCalendar && (
                    <div className="mb-6 flex justify-center">
                        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                            <Calendar
                                onChange={(date) => {
                                    setSelectedDate(date)
                                    setShowCalendar(false)
                                }}
                                value={selectedDate}
                                locale="vi-VN"
                            />
                        </div>
                    </div>
                )}

                {/* Danh sách tiết */}
                {loading ? (
                    <div className="text-center text-gray-800/40 py-12">Đang tải...</div>
                ) : schedules.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4">📭</div>
                        <p className="text-gray-800/40">Không có tiết dạy ngày này</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <p className="text-gray-800/40 text-sm">{schedules.length} tiết dạy</p>
                        {schedules.map(s => (
                            <ScheduleCard
                                key={s.id}
                                schedule={s}
                                role="supervisor"
                                onCheckin={handleCheckin}
                                isConfirming={confirming === s.id}
                                onConfirm={confirmCheckin}
                                onCancelConfirm={cancelConfirm}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Dialog nhập giờ thủ công */}
            {dialog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm
                        flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-gray-200 rounded-2xl
                p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="text-gray-800 font-bold text-lg mb-1">
                            Nhập giờ điểm danh trễ
                        </h3>
                        <p className="text-gray-400 text-sm mb-4">
                            {dialog.teacherName} — {dialog.className}
                        </p>
                        <label className="text-gray-600 text-sm block mb-1.5">
                            Giờ giáo viên đến lớp
                        </label>
                        <input
                            type="time"
                            value={manualTime}
                            onChange={e => setManualTime(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl
             px-4 py-3 text-gray-800 text-base outline-none
             focus:border-orange-400 mb-4"
                        />

                        <label className="text-gray-600 text-sm block mb-1.5">
                            Lý do điểm danh trễ
                        </label>
                        <select
                            value={lateReason}
                            onChange={e => setLateReason(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl
             px-4 py-3 text-gray-800 text-sm outline-none
             focus:border-orange-400 mb-3"
                        >
                            {LATE_REASONS.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>

                        {lateReason === "Khác (nhập lý do)" && (
                            <input
                                type="text"
                                value={customReason}
                                onChange={e => setCustomReason(e.target.value)}
                                placeholder="Nhập lý do cụ thể..."
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl
               px-4 py-3 text-gray-800 text-sm outline-none
               placeholder-gray-400 focus:border-orange-400 mb-4"
                            />
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDialog(null)}
                                className="flex-1 py-3 rounded-xl border border-gray-200
             text-gray-500 hover:bg-gray-50 text-sm font-medium"
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={() => {
                                    const reasonText = lateReason === "Khác (nhập lý do)"
                                        ? customReason
                                        : lateReason
                                    submitCheckin(dialog, manualTime, reasonText)
                                }}
                                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600
             text-white text-sm font-semibold transition-all"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}