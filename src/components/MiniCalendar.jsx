import { getDaysInMonth, getDay } from "date-fns"

// schedulesInClass:   buổi GV này đang đứng dạy (lớp chính thức)
// substitutedAway:    buổi GV này bị thay (originalTeacherId = GV này),
//                      kèm tên GV dạy thay — chỉ dùng ở Admin Reports
// month, year: tháng/năm đang xem báo cáo
export default function MiniCalendar({ schedulesInClass, substitutedAway = [],
    month, year }) {
    const daysInMonth = getDaysInMonth(new Date(year, month - 1))
    const firstDay = getDay(new Date(year, month - 1, 1)) // 0=CN

    const dayStatus = {}   // day -> "scheduled" | "checked" | "done"
    const daySubInfo = {}  // day -> { subTeacherName }

    schedulesInClass.forEach(s => {
        const day = Number(s.date.slice(8, 10))
        const status = s.teacherDoneAt ? "done"
            : s.supervisorCheckedIn ? "checked"
                : "scheduled"
        const rank = { scheduled: 0, checked: 1, done: 2 }
        if (!dayStatus[day] || rank[status] > rank[dayStatus[day]]) {
            dayStatus[day] = status
        }
    })

    // Buổi bị dạy thay — ưu tiên hiển thị đỏ, ghi đè lên trạng thái thường
    substitutedAway.forEach(s => {
        const day = Number(s.date.slice(8, 10))
        dayStatus[day] = "substituted"
        daySubInfo[day] = { subTeacherName: s.teacherName }
    })

    const STYLE = {
        scheduled: "bg-gray-200 text-gray-600",
        checked: "bg-violet-500 text-white",
        done: "bg-green-500 text-white",
        substituted: "bg-red-500 text-white",
    }

    const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    return (
        <div className="bg-gray-50 rounded-xl p-3 w-fit">
            <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map(w => (
                    <div key={w} className="w-7 h-5 flex items-center justify-center
                                  text-gray-400 text-[10px] font-semibold">
                        {w}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                    const status = d ? dayStatus[d] : null
                    const subInfo = d ? daySubInfo[d] : null
                    return (
                        <div key={i} className="w-7 h-7 flex items-center justify-center
                                    relative group">
                            {d && (
                                <>
                                    <div className={`w-7 h-7 rounded-lg flex items-center
                                   justify-center text-xs font-medium
                                   transition-all cursor-default
                    ${status ? STYLE[status] : "text-gray-300"}`}>
                                        {d}
                                    </div>

                                    {/* Tooltip khi hover ô bị dạy thay */}
                                    {status === "substituted" && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2
                                    mb-1.5 hidden group-hover:block z-20
                                    whitespace-nowrap">
                                            <div className="bg-gray-800 text-white text-[11px]
                                      rounded-lg px-2.5 py-1.5 shadow-lg">
                                                Dạy thay: {subInfo?.subTeacherName}
                                            </div>
                                            <div className="w-2 h-2 bg-gray-800 rotate-45 mx-auto
                                      -mt-1"></div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200
                      flex-wrap">
                <Legend color="bg-gray-200" label="Có tiết" />
                <Legend color="bg-violet-500" label="Đã điểm danh" />
                <Legend color="bg-green-500" label="Đã done" />
                {substitutedAway.length > 0 && (
                    <Legend color="bg-red-500" label="Dạy thay" />
                )}
            </div>
        </div>
    )
}

function Legend({ color, label }) {
    return (
        <div className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
            <span className="text-gray-400 text-[10px]">{label}</span>
        </div>
    )
}