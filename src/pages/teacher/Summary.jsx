import { useState, useEffect } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import toast from "react-hot-toast"
import Navbar from "../../components/Navbar"
import MiniCalendar from "../../components/MiniCalendar"

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function TeacherSummary() {
    const { currentUser } = useAuth()
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const [schedules, setSchedules] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => { fetchData() }, [month, year])

    async function fetchData() {
        setLoading(true)
        const start = `${year}-${String(month).padStart(2, "0")}-01`
        const end = `${year}-${String(month).padStart(2, "0")}-31`
        try {
            const snap = await getDocs(query(
                collection(db, "schedules"),
                where("teacherId", "==", currentUser.uid)
            ))
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(s => !s.isCancelled && s.date >= start && s.date <= end)
                .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
            setSchedules(data)
        } catch (err) {
            console.error(err)
            toast.error("Không thể tải dữ liệu: " + err.message)
        }
        setLoading(false)
    }

    const totalSessions = schedules.length
    const doneSessions = schedules.filter(s => s.teacherDoneAt).length
    const lateSessions = schedules.filter(s => s.isLate).length

    const officialList = schedules.filter(s => s.type === "regular" || s.type === "makeup")
    const extraList = schedules.filter(s => s.type === "extra")
    const supportList = schedules.filter(s => s.type === "support")

    const officialGroups = Object.entries(
        officialList.reduce((acc, s) => {
            (acc[s.className] = acc[s.className] || []).push(s)
            return acc
        }, {})
    ).sort(([a], [b]) => a.localeCompare(b))

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 lg:pl-56">
            <Navbar />
            <div className="pt-16 lg:pt-0 p-4 md:p-8">

                {/* Header */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <h1 className="text-2xl font-bold">Tổng hợp tháng</h1>
                    <div className="flex gap-2 ml-auto">
                        <select value={month} onChange={e => setMonth(+e.target.value)}
                            className="bg-white border border-gray-200 rounded-xl
                         px-3 py-2 text-gray-700 text-sm outline-none
                         focus:border-orange-400">
                            {MONTHS.map(m => <option key={m} value={m}>Tháng {m}</option>)}
                        </select>
                        <select value={year} onChange={e => setYear(+e.target.value)}
                            className="bg-white border border-gray-200 rounded-xl
                         px-3 py-2 text-gray-700 text-sm outline-none
                         focus:border-orange-400">
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="text-gray-400 text-center py-12">Đang tải...</div>
                ) : (
                    <>
                        {/* Thống kê nhanh */}
                            <div className="grid grid-cols-3 gap-3 mb-6">
                                {[
                                    { label: "Tổng buổi", value: totalSessions, color: "text-gray-800" },
                                    { label: "Hoàn thành", value: doneSessions, color: "text-green-600" },
                                    { label: "Trễ", value: lateSessions, color: "text-orange-500" },
                                ].map(s => (
                                <div key={s.label}
                                    className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                                    <div className="text-gray-400 text-xs mt-1">{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {schedules.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="text-5xl mb-4">📭</div>
                                <p className="text-gray-400">Không có buổi dạy nào trong tháng này</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6">

                                {/* Lớp chính thức — nhóm theo tên lớp */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <h2 className="text-gray-700 font-semibold text-sm">Lớp chính thức</h2>
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium
                                     bg-blue-50 text-blue-600">
                                            {officialList.length} buổi
                                        </span>
                                    </div>

                                    {officialGroups.length === 0 ? (
                                        <div className="text-gray-300 text-sm py-4 text-center
                                    bg-white border border-gray-100 rounded-2xl">
                                            Không có
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-4">
                                                        {officialGroups.map(([className, rows]) => (
                                                            <div key={className}
                                                                className="rounded-2xl border border-gray-200 bg-white
                  shadow-sm overflow-hidden">
                                                                <div className="flex items-center justify-between
                    bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                                                                    <span className="text-gray-800 font-semibold text-sm">
                                                                        {className}
                                                                    </span>
                                                                    <span className="text-xs text-gray-400">
                                                                        {rows.length} buổi
                                                                    </span>
                                                                </div>

                                                                <div className="p-4 border-b border-gray-200 flex justify-center
                    md:justify-start">
                                                                    <MiniCalendar schedulesInClass={rows} month={month} year={year} />
                                                                </div>

                                                                <SessionTable rows={rows} />
                                                            </div>
                                                        ))}
                                        </div>
                                    )}
                                </div>

                                {/* Lớp tăng cường */}
                                <SimpleSection
                                    title="Lớp tăng cường"
                                    badgeColor="bg-amber-50 text-amber-600"
                                    list={extraList}
                                    showClass
                                />

                                {/* Lớp hỗ trợ (dạy thay) */}
                                <SimpleSection
                                    title="Lớp hỗ trợ (dạy thay)"
                                    badgeColor="bg-purple-50 text-purple-600"
                                    list={supportList}
                                    showClass
                                    showOriginal
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

// ── Bảng hiển thị các buổi trong 1 nhóm đã group theo lớp ──
function SessionTable({ rows, showClass, showOriginal }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="text-left py-2.5 px-4 font-medium">Ngày</th>
                        {showClass && (
                            <th className="text-left py-2.5 px-4 font-medium">Lớp</th>
                        )}
                        <th className="text-left py-2.5 px-4 font-medium">Giờ học</th>
                        {showOriginal && (
                            <th className="text-left py-2.5 px-4 font-medium">Dạy thay cho</th>
                        )}
                        <th className="text-left py-2.5 px-4 font-medium">Giờ done</th>
                        <th className="text-left py-2.5 px-4 font-medium">Trạng thái</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(s => (
                        <tr key={s.id} className="border-t border-gray-100">
                            <td className="py-2.5 px-4 text-gray-700 whitespace-nowrap">
                                {format(parseISO(s.date), "dd/MM/yyyy", { locale: vi })}
                                <div className="text-gray-400 text-xs">
                                    {format(parseISO(s.date), "EEEE", { locale: vi })}
                                </div>
                            </td>
                            {showClass && (
                                <td className="py-2.5 px-4 text-gray-800 font-medium">
                                    {s.className}
                                    <div className="text-gray-400 text-xs">{s.subject}</div>
                                </td>
                            )}
                            <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                                {s.startTime}–{s.endTime}
                            </td>
                            {showOriginal && (
                                <td className="py-2.5 px-4 text-gray-500">
                                    {s.originalTeacherName || "—"}
                                </td>
                            )}
                            <td className="py-2.5 px-4">
                                {s.teacherDoneAt ? (
                                    <span className="text-green-600 font-medium">
                                        {format(s.teacherDoneAt.toDate(), "HH:mm")}
                                    </span>
                                ) : (
                                    <span className="text-gray-300">—</span>
                                )}
                            </td>
                            <td className="py-2.5 px-4">
                                {s.teacherDoneAt ? (
                                    <span className="text-xs bg-green-50 text-green-600
                                   px-2 py-0.5 rounded-full font-medium">
                                        Hoàn thành
                                    </span>
                                ) : s.supervisorCheckedIn ? (
                                    <span className="text-xs bg-violet-50 text-violet-600
                                   px-2 py-0.5 rounded-full font-medium">
                                        Đã điểm danh
                                        {s.isLate && (
                                            <span className="text-red-500 ml-1">
                                                (trễ {s.lateMinutes}p)
                                            </span>
                                        )}
                                    </span>
                                ) : (
                                    <span className="text-xs bg-gray-100 text-gray-400
                                   px-2 py-0.5 rounded-full font-medium">
                                        Chưa
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// ── Section đơn (tăng cường / hỗ trợ) — không nhóm theo lớp ──
function SimpleSection({ title, badgeColor, list, showClass, showOriginal }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <h2 className="text-gray-700 font-semibold text-sm">{title}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>
                    {list.length} buổi
                </span>
            </div>
            {list.length === 0 ? (
                <div className="text-gray-300 text-sm py-4 text-center
                        bg-white border border-gray-100 rounded-2xl">
                    Không có
                </div>
            ) : (
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <SessionTable rows={list} showClass={showClass} showOriginal={showOriginal} />
                </div>
            )}
        </div>
    )
}