import { useState, useEffect } from "react"
import Calendar from "react-calendar"
import "react-calendar/dist/Calendar.css"
import {
    collection, query, where, getDocs,
    updateDoc, doc, serverTimestamp
} from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import toast from "react-hot-toast"
import Navbar from "../../components/Navbar"
import ScheduleCard from "../../components/ScheduleCard"

export default function TeacherSchedule() {
    const { currentUser } = useAuth()
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [showCalendar, setShowCalendar] = useState(false)
    const [schedules, setSchedules] = useState([])
    const [loading, setLoading] = useState(false)

    const dateStr = format(selectedDate, "yyyy-MM-dd")

    useEffect(() => { fetchSchedules() }, [selectedDate])

    async function fetchSchedules() {
        setLoading(true)
        try {
            const q = query(
                collection(db, "schedules"),
                where("date", "==", dateStr),
                where("teacherId", "==", currentUser.uid),
                where("isCancelled", "==", false)
            )
            const snap = await getDocs(q)
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            data.sort((a, b) => a.startTime.localeCompare(b.startTime))
            setSchedules(data)
        } catch (err) {
            toast.error("Không thể tải lịch dạy")
        }
        setLoading(false)
    }

    async function handleDone(schedule) {
        try {
            await updateDoc(doc(db, "schedules", schedule.id), {
                teacherDoneAt: serverTimestamp(),
                status: "done"
            })
            toast.success("Đã xác nhận hoàn thành tiết dạy!")
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
                        <h1 className="text-2xl font-bold">Lịch dạy</h1>
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
                                role="teacher"
                                onDone={handleDone}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}