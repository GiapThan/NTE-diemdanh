import { useState, useEffect } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../../firebase/config"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"
import toast from "react-hot-toast"
import Navbar from "../../components/Navbar"
import MiniCalendar from "../../components/MiniCalendar"

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

const TYPE_LABEL = {
    regular: "Chính thức",
    makeup: "Bù buổi",
    extra: "Tăng cường",
    support: "Hỗ trợ"
}
const TYPE_ORDER = {
    regular: 0,
    makeup: 1,
    extra: 2,
    support: 3
}

export default function AdminReports() {
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const [tab, setTab] = useState("overview") // "overview" | "detail"

    const [schedules, setSchedules] = useState([])
    const [teachers, setTeachers] = useState([])
    const [userMap, setUserMap] = useState({})
    const [loading, setLoading] = useState(false)
    const [selectedTeacherId, setSelectedTeacherId] = useState("")

    useEffect(() => { fetchData() }, [month, year])

    async function fetchData() {
        setLoading(true)
        const start = `${year}-${String(month).padStart(2, "0")}-01`
        const end = `${year}-${String(month).padStart(2, "0")}-31`
        try {
            const [schSnap, userSnap] = await Promise.all([
                getDocs(query(collection(db, "schedules"),
                    where("date", ">=", start),
                    where("date", "<=", end)
                )),
                getDocs(collection(db, "users"))
            ])

            const sch = schSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(s => !s.isCancelled)

            const users = userSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            const map = {}
            users.forEach(u => { map[u.id] = u.displayName })

            setSchedules(sch)
            setTeachers(users.filter(u => u.role === "teacher")
                .sort((a, b) => (a.teacherCode || "").localeCompare(b.teacherCode || "")))
            setUserMap(map)

            if (!selectedTeacherId && users.some(u => u.role === "teacher")) {
                setSelectedTeacherId(users.find(u => u.role === "teacher").id)
            }
        } catch (err) {
            console.error(err)
            toast.error("Không thể tải báo cáo: " + err.message)
        }
        setLoading(false)
    }

    // ── Tab 1: Tổng quan toàn trung tâm ──
    const overviewRows = teachers.map(teacher => {
        const my = schedules.filter(s => s.teacherId === teacher.id)

        const totalSessions = my.length
        const lateSessions = my.filter(s => s.isLate).length

        // Lớp chính thức: regular + makeup, group theo className
        const officialClasses = {}
        my.filter(s => s.type === "regular" || s.type === "makeup")
            .forEach(s => {
                officialClasses[s.className] = (officialClasses[s.className] || 0) + 1
            })

        // Hỗ trợ (dạy thay): group theo className
        const supportClasses = {}
        my.filter(s => s.type === "support")
            .forEach(s => {
                supportClasses[s.className] = (supportClasses[s.className] || 0) + 1
            })

        const extraCount = my.filter(s => s.type === "extra").length

        return {
            uid: teacher.id,
            teacherCode: teacher.teacherCode,
            displayName: teacher.displayName,
            subject: teacher.subject,
            totalSessions,
            lateSessions,
            officialClasses,
            supportClasses,
            extraCount
        }
    }).filter(r => r.totalSessions > 0)

    // ── Tab 2: Chi tiết theo giáo viên ──
    const teacherSchedules = schedules
        .filter(s => s.teacherId === selectedTeacherId)
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))

    const officialList = teacherSchedules.filter(s => s.type === "regular" || s.type === "makeup")
    const extraList = teacherSchedules.filter(s => s.type === "extra")
    const supportList = teacherSchedules.filter(s => s.type === "support")

    // ── Xuất Excel: trang 1 = tổng hợp, các trang sau = chi tiết từng GV ──
    function exportExcel() {
        if (overviewRows.length === 0) return toast.error("Không có dữ liệu")

        const wb = XLSX.utils.book_new()

        // Trang 1: Tổng hợp toàn trung tâm
        const summaryData = overviewRows.map(r => ({
            "Mã GV": r.teacherCode,
            "Họ tên": r.displayName,
            "Môn": r.subject,
            "Tổng buổi": r.totalSessions,
            "Trễ": r.lateSessions,
            "Lớp chính thức": Object.entries(r.officialClasses)
                .map(([c, n]) => `${c}: ${n}`).join(", "),
            "Hỗ trợ": Object.entries(r.supportClasses)
                .map(([c, n]) => `${c}: ${n}`).join(", ") || "—",
            "Tăng cường": r.extraCount,
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Tổng hợp")

        // Các trang tiếp theo: chi tiết từng giáo viên
        overviewRows.forEach(r => {
            const mySchedules = schedules
                .filter(s => s.teacherId === r.uid)
                .sort((a, b) =>
                    (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99)
                    || a.date.localeCompare(b.date)
                    || a.startTime.localeCompare(b.startTime)
                )

            const detailData = mySchedules.map(s => ({
                "Loại": TYPE_LABEL[s.type] || s.type,
                "Lớp": s.className,
                "Môn": s.subject,
                "Ngày": s.date,
                "Giờ học": `${s.startTime}-${s.endTime}`,
                "Dạy thay cho": s.type === "support" ? (s.originalTeacherName || "") : "",
                "Giờ điểm danh": s.checkInTime ? format(s.checkInTime.toDate(), "HH:mm") : "",
                "Giám thị": s.recordedBy ? (userMap[s.recordedBy] || "") : "",
                "Phút trễ": s.lateMinutes || 0,
                "Giờ GV done": s.teacherDoneAt ? format(s.teacherDoneAt.toDate(), "HH:mm") : "",
                "Trạng thái": s.teacherDoneAt
                    ? "Hoàn thành"
                    : s.supervisorCheckedIn ? "Đã điểm danh" : "Chưa"
            }))

            // Tên trang tính: dùng mã GV, tối đa 31 ký tự, đảm bảo duy nhất
            const sheetName = (r.teacherCode || r.displayName).substring(0, 31)
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailData), sheetName)
        })

        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
        saveAs(new Blob([buf], { type: "application/octet-stream" }),
            `bao_cao_${month}_${year}.xlsx`)
        toast.success("Xuất Excel thành công!")
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 lg:pl-56">
            <Navbar />
            <div className="pt-16 lg:pt-0 p-4 md:p-8">

                {/* Header */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <h1 className="text-2xl font-bold">Báo cáo</h1>
                    <div className="flex gap-2 ml-auto flex-wrap">
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

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button onClick={() => setTab("overview")}
                        className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${tab === "overview"
                                ? "bg-orange-500 text-white"
                                : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                        Tổng quan toàn trung tâm
                    </button>
                    <button onClick={() => setTab("detail")}
                        className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${tab === "detail"
                                ? "bg-orange-500 text-white"
                                : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                        Chi tiết giáo viên
                    </button>
                </div>

                {loading ? (
                    <div className="text-gray-400 text-center py-12">Đang tải...</div>

                    // ══════════ TAB 1: TỔNG QUAN ══════════
                ) : tab === "overview" ? (
                    <>
                        <div className="flex justify-end mb-3">
                            <button onClick={exportExcel}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white
                           px-4 py-2 rounded-xl text-sm font-semibold
                           transition-all flex items-center gap-2">
                                📥 Xuất Excel
                            </button>
                        </div>

                        {overviewRows.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="text-5xl mb-4">📊</div>
                                <p className="text-gray-400">Không có dữ liệu tháng này</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-2xl border border-gray-200
                              bg-white shadow-sm">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-500 text-xs">
                                            <th className="text-left py-3 px-4 font-medium">Mã GV</th>
                                            <th className="text-left py-3 px-4 font-medium">Họ tên</th>
                                            <th className="text-left py-3 px-4 font-medium">Tổng</th>
                                            <th className="text-left py-3 px-4 font-medium">Trễ</th>
                                            <th className="text-left py-3 px-4 font-medium">Lớp chính thức</th>
                                            <th className="text-left py-3 px-4 font-medium">Hỗ trợ (dạy thay)</th>
                                            <th className="text-left py-3 px-4 font-medium">Tăng cường</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overviewRows.map(r => (
                                            <tr key={r.uid}
                                                className="border-t border-gray-100 hover:bg-gray-50
                                     transition-colors">
                                                <td className="py-3 px-4 text-gray-500 font-mono text-xs">
                                                    {r.teacherCode}
                                                </td>
                                                <td className="py-3 px-4 text-gray-800 font-medium
                                       whitespace-nowrap">
                                                    {r.displayName}
                                                    <div className="text-gray-400 text-xs">{r.subject}</div>
                                                </td>
                                                <td className="py-3 px-4 text-gray-800 font-bold">
                                                    {r.totalSessions}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={r.lateSessions > 0
                                                        ? "text-orange-500 font-semibold" : "text-gray-300"}>
                                                        {r.lateSessions}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {Object.entries(r.officialClasses).map(([c, n]) => (
                                                            <span key={c}
                                                                className="text-xs bg-blue-50 text-blue-600
                                           px-2 py-0.5 rounded-full font-medium
                                           whitespace-nowrap">
                                                                {c}: {n}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {Object.keys(r.supportClasses).length === 0 ? (
                                                        <span className="text-gray-300">—</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {Object.entries(r.supportClasses).map(([c, n]) => (
                                                                <span key={c}
                                                                    className="text-xs bg-purple-50 text-purple-600
                                             px-2 py-0.5 rounded-full font-medium
                                             whitespace-nowrap">
                                                                    {c}: {n}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {r.extraCount > 0 ? (
                                                        <span className="text-xs bg-amber-50 text-amber-600
                                             px-2 py-0.5 rounded-full font-medium">
                                                            {r.extraCount} buổi
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>

                    // ══════════ TAB 2: CHI TIẾT GIÁO VIÊN ══════════
                ) : (
                    <>
                        {/* Chọn giáo viên */}
                        <div className="mb-5">
                            <select value={selectedTeacherId}
                                onChange={e => setSelectedTeacherId(e.target.value)}
                                className="bg-white border border-gray-200 rounded-xl
                           px-4 py-2.5 text-gray-800 text-sm outline-none
                           focus:border-orange-400 min-w-[260px]">
                                {teachers.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.displayName} ({t.teacherCode}) — {t.subject}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {!selectedTeacherId || teacherSchedules.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="text-5xl mb-4">📭</div>
                                <p className="text-gray-400">
                                    Không có buổi dạy nào trong tháng này
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6">
                                            <DetailSection
                                                title="Lớp chính thức"
                                                badgeColor="bg-blue-50 text-blue-600"
                                                list={officialList}
                                                userMap={userMap}
                                                groupByClass
                                                month={month}
                                                year={year}
                                            />
                                <DetailSection
                                    title="Lớp tăng cường"
                                    badgeColor="bg-amber-50 text-amber-600"
                                    list={extraList}
                                    userMap={userMap}
                                />
                                <DetailSection
                                    title="Lớp hỗ trợ (dạy thay)"
                                    badgeColor="bg-purple-50 text-purple-600"
                                    list={supportList}
                                    userMap={userMap}
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

// ── Component hiển thị 1 nhóm (chính thức / tăng cường / hỗ trợ) ──
function DetailSection({ title, badgeColor, list, userMap, showOriginal,
    groupByClass, month, year }) {
    // Nếu groupByClass: nhóm theo tên lớp, sắp xếp theo tên lớp
    const groups = groupByClass
        ? Object.entries(
            list.reduce((acc, s) => {
                (acc[s.className] = acc[s.className] || []).push(s)
                return acc
            }, {})
        ).sort(([a], [b]) => a.localeCompare(b))
        : [[null, list]]

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
                <div className="flex flex-col gap-4">
                    {groups.map(([className, rows]) => (
                        <div key={className || "all"}
                            className="rounded-2xl border border-gray-200 bg-white
                            shadow-sm overflow-hidden">

                            {/* Header tên lớp — chỉ hiện khi groupByClass */}
                            {groupByClass && (
                                <div className="flex items-center justify-between
                  bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                                    <span className="text-gray-800 font-semibold text-sm">
                                        {className}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {rows.length} buổi
                                    </span>
                                </div>
                            )}

                            {groupByClass && month && year && (
                                <div className="p-4 border-b border-gray-200 flex justify-center
                  md:justify-start">
                                    <MiniCalendar schedulesInClass={rows} month={month} year={year} />
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-500 text-xs">
                                            <th className="text-left py-2.5 px-4 font-medium">Ngày</th>
                                            {!groupByClass && (
                                                <th className="text-left py-2.5 px-4 font-medium">Lớp</th>
                                            )}
                                            <th className="text-left py-2.5 px-4 font-medium">Giờ học</th>
                                            {showOriginal && (
                                                <th className="text-left py-2.5 px-4 font-medium">Dạy thay cho</th>
                                            )}
                                            <th className="text-left py-2.5 px-4 font-medium">Giờ điểm danh</th>
                                            <th className="text-left py-2.5 px-4 font-medium">Giám thị</th>
                                            <th className="text-left py-2.5 px-4 font-medium">Giờ GV done</th>
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
                                                {!groupByClass && (
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
                                                    {s.checkInTime ? (
                                                        <span className="text-violet-600 font-medium">
                                                            {format(s.checkInTime.toDate(), "HH:mm")}
                                                            {s.lateMinutes > 0 && (
                                                                <span className="text-red-500 ml-1 text-xs">
                                                                    (trễ {s.lateMinutes}p)
                                                                </span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">—</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-4 text-gray-500">
                                                    {s.recordedBy ? (userMap[s.recordedBy] || "—") : "—"}
                                                </td>
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
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}