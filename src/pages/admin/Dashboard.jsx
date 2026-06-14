import { useState, useEffect } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../../firebase/config"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Link } from "react-router-dom"
import toast from "react-hot-toast"
import Navbar from "../../components/Navbar"

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [stats, setStats] = useState({
        teachers: 0, pending: 0,
        todayTotal: 0, todayCheckedIn: 0, todayDone: 0,
        monthTotal: 0, monthDone: 0, monthLate: 0
    })
    const [todaySchedules, setTodaySchedules] = useState([])
    const [pendingUsers, setPendingUsers] = useState([])

    const today = format(new Date(), "yyyy-MM-dd")
    const monthStart = today.slice(0, 7) + "-01"
    const monthEnd = today.slice(0, 7) + "-31"
    const dateLabel = format(new Date(), "EEEE, dd/MM/yyyy", { locale: vi })

    useEffect(() => {
        fetchAll()
    }, [])

    async function fetchAll() {
        setLoading(true)
        setError(null)
        try {
            // Fetch từng cái riêng lẻ để dễ debug
            const teacherSnap = await getDocs(
                query(collection(db, "users"), where("role", "==", "teacher"))
            )
            const pendingSnap = await getDocs(
                query(collection(db, "users"), where("role", "==", "pending"))
            )
            const todaySnap = await getDocs(
                query(collection(db, "schedules"), where("date", "==", today))
            )
            const monthSnap = await getDocs(
                query(collection(db, "schedules"),
                    where("date", ">=", monthStart),
                    where("date", "<=", monthEnd))
            )

            const todayList = todaySnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(s => !s.isCancelled)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))

            const monthList = monthSnap.docs
                .map(d => d.data())
                .filter(s => !s.isCancelled)

            setTodaySchedules(todayList)
            setPendingUsers(pendingSnap.docs.map(d => ({ id: d.id, ...d.data() })))
            setStats({
                teachers: teacherSnap.size,
                pending: pendingSnap.size,
                todayTotal: todayList.length,
                todayCheckedIn: todayList.filter(s => s.supervisorCheckedIn).length,
                todayDone: todayList.filter(s => s.teacherDoneAt).length,
                monthTotal: monthList.length,
                monthDone: monthList.filter(s => s.teacherDoneAt).length,
                monthLate: monthList.filter(s => s.isLate).length,
            })
        } catch (err) {
            console.error(err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Nếu có lỗi → hiển thị lỗi thay vì màn hình trắng
    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 text-gray-800 lg:pl-56
                      font-['Segoe_UI',sans-serif]">
                <Navbar />
                <div className="pt-16 lg:pt-0 p-8">
                    <div className="bg-red-500/10 border border-red-500/30
                          rounded-2xl p-6 max-w-lg">
                        <div className="text-red-400 font-bold mb-2">Lỗi tải dữ liệu</div>
                        <div className="text-red-300/70 text-sm font-mono">{error}</div>
                        <button onClick={fetchAll}
                            className="mt-4 px-4 py-2 bg-red-500/20 text-red-400
                         rounded-xl text-sm hover:bg-red-500/30 transition-all">
                            Thử lại
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 lg:pl-56
                    font-['Segoe_UI',sans-serif]">
            <Navbar />
            <div className="pt-16 lg:pt-0 p-4 md:p-8">

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold">Tổng quan</h1>
                    <p className="text-gray-800 text-sm mt-1">{dateLabel}</p>
                </div>

                {/* Loading */}
                {loading ? (
                    <div className="flex flex-col gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i}
                                className="bg-white border border-gray-200
                              rounded-2xl p-5 animate-pulse h-20" />
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Cảnh báo chờ duyệt */}
                        {pendingUsers.length > 0 && (
                            <Link to="/admin/users">
                                <div className="bg-yellow-500/10 border border-yellow-500/30
                                rounded-2xl p-4 mb-6 flex items-center gap-3
                                hover:bg-yellow-500/15 transition-all">
                                    <span className="text-2xl">⚠️</span>
                                    <div>
                                        <div className="text-yellow-400 font-semibold text-sm">
                                            Có {pendingUsers.length} tài khoản chờ duyệt
                                        </div>
                                        <div className="text-yellow-400/60 text-xs mt-0.5">
                                            Bấm để xem và duyệt
                                        </div>
                                    </div>
                                    <span className="ml-auto text-yellow-400/60">→</span>
                                </div>
                            </Link>
                        )}

                        {/* Stats hôm nay */}
                        <div className="mb-6">
                            <p className="text-gray-800/40 text-xs font-semibold uppercase
                            tracking-widest mb-3">Hôm nay</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {[
                                    {
                                        label: "Tổng tiết", value: stats.todayTotal,
                                        color: "text-gray-800"
                                    },
                                    {
                                        label: "Đã điểm danh", value: stats.todayCheckedIn,
                                        color: "text-orange-500"
                                    },
                                    {
                                        label: "GV đã done", value: stats.todayDone,
                                        color: "text-green-400"
                                    },
                                ].map(s => (
                                    <div key={s.label}
                                        className="bg-white border border-gray-200 rounded-2xl p-5">
                                        <div className={`text-3xl font-bold ${s.color}`}>
                                            {s.value}
                                        </div>
                                        <div className="text-gray-800/40 text-xs mt-1">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Stats tháng */}
                        <div className="mb-8">
                            <p className="text-gray-800/40 text-xs font-semibold uppercase
                            tracking-widest mb-3">
                                Tháng {today.slice(5, 7)}/{today.slice(0, 4)}
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    {
                                        label: "Tổng buổi", value: stats.monthTotal,
                                        color: "text-gray-800"
                                    },
                                    {
                                        label: "Hoàn thành", value: stats.monthDone,
                                        color: "text-green-400"
                                    },
                                    {
                                        label: "Trễ", value: stats.monthLate,
                                        color: "text-orange-500"
                                    },
                                    {
                                        label: "Giáo viên", value: stats.teachers,
                                        color: "text-orange-500"
                                    },
                                ].map(s => (
                                    <div key={s.label}
                                        className="bg-white border border-gray-200 rounded-2xl p-5">
                                        <div className={`text-3xl font-bold ${s.color}`}>
                                            {s.value}
                                        </div>
                                        <div className="text-gray-800/40 text-xs mt-1">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Lịch hôm nay */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-gray-800/40 text-xs font-semibold uppercase
                              tracking-widest">
                                    Lịch hôm nay ({todaySchedules.length} tiết)
                                </p>
                                <Link to="/admin/schedules"
                                    className="text-orange-500 text-xs hover:underline">
                                    Xem tất cả →
                                </Link>
                            </div>

                            {todaySchedules.length === 0 ? (
                                <div className="text-center py-10 text-gray-800/30 text-sm">
                                    Không có tiết dạy hôm nay
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {todaySchedules.map(s => (
                                        <div key={s.id}
                                            className={`flex items-center gap-4 rounded-2xl border p-4
                        ${s.teacherDoneAt
                                                    ? "bg-green-500/10 border-green-500/20"
                                                    : s.supervisorCheckedIn
                                                        ? "bg-violet-500/10 border-violet-500/20"
                                                        : "bg-white border-gray-200"}`}>
                                            <div className="text-center w-14 flex-shrink-0">
                                                <div className="text-gray-800 font-bold text-sm">
                                                    {s.startTime}
                                                </div>
                                                <div className="text-gray-800/30 text-xs">{s.endTime}</div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-gray-800 font-semibold text-sm">
                                                    {s.className}
                                                    <span className="text-gray-800/40 font-normal ml-2 text-xs">
                                                        {s.subject}
                                                    </span>
                                                </div>
                                                <div className="text-gray-800/40 text-xs mt-0.5">
                                                    👨‍🏫 {s.teacherName} · 📍 {s.room}
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0">
                                                {s.teacherDoneAt ? (
                                                    <span className="text-xs bg-green-500/20 text-green-400
                                           px-2 py-1 rounded-full">Hoàn thành</span>
                                                ) : s.supervisorCheckedIn ? (
                                                    <span className="text-xs bg-violet-500/20 text-orange-500
                                           px-2 py-1 rounded-full">Điểm danh</span>
                                                ) : (
                                                    <span className="text-xs bg-gray-100 text-gray-800/40
                                           px-2 py-1 rounded-full">Chờ</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}