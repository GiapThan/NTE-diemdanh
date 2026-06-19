import { getDaysInMonth, getDay, format } from "date-fns"

// schedulesInClass: mảng các buổi học của lớp này trong tháng
// month, year: tháng/năm đang xem báo cáo
export default function MiniCalendar({ schedulesInClass, month, year }) {
    const daysInMonth = getDaysInMonth(new Date(year, month - 1))
    const firstDay = getDay(new Date(year, month - 1, 1)) // 0=CN

    // Map ngày → trạng thái buổi học (lấy buổi có trạng thái "cao" nhất nếu trùng ngày)
    const dayStatus = {}
    schedulesInClass.forEach(s => {
        const day = Number(s.date.slice(8, 10))
        const status = s.teacherDoneAt ? "done"
            : s.supervisorCheckedIn ? "checked"
                : "scheduled"

        // Ưu tiên: done > checked > scheduled (nếu 1 ngày có nhiều buổi)
        const rank = { scheduled: 0, checked: 1, done: 2 }
        if (!dayStatus[day] || rank[status] > rank[dayStatus[day]]) {
            dayStatus[day] = status
        }
    })

    const STYLE = {
        scheduled: "bg-gray-200 text-gray-600",
        checked: "bg-violet-500 text-white",
        done: "bg-green-500 text-white",
    }

    const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

    // Tạo lưới ô: ô trống cho những ngày trước ngày 1
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    return (
        <div className="bg-gray-50 rounded-xl p-3 w-fit">
            {/* Header thứ */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map(w => (
                    <div key={w} className="w-7 h-5 flex items-center justify-center
                                  text-gray-400 text-[10px] font-semibold">
                        {w}
                    </div>
                ))}
            </div>

            {/* Lưới ngày */}
            <div className="grid grid-cols-7 gap-1">
                {cells.map((d, i) => (
                    <div key={i} className="w-7 h-7 flex items-center justify-center">
                        {d && (
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                               text-xs font-medium transition-all
                ${dayStatus[d] ? STYLE[dayStatus[d]] : "text-gray-300"}`}>
                                {d}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Chú thích */}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200">
                <Legend color="bg-gray-200" label="Có tiết" />
                <Legend color="bg-violet-500" label="Đã điểm danh" />
                <Legend color="bg-green-500" label="Đã done" />
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