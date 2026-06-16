import { format, isAfter, parseISO, endOfMonth, addMonths } from "date-fns"

function getCardStyle(schedule) {
    if (schedule.teacherDoneAt)
        return "bg-green-50 border-green-200"
    if (schedule.supervisorCheckedIn)
        return "bg-violet-50 border-violet-200"
    return "bg-white border-gray-200"
}

function getAccentColor(schedule) {
    if (schedule.teacherDoneAt) return "text-green-700"
    if (schedule.supervisorCheckedIn) return "text-violet-700"
    return "text-gray-800"
}

export default function ScheduleCard({ schedule, role, onDone, onCheckin,
    isConfirming, onConfirm, onCancelConfirm }) {
    const now = new Date()
    const dayStartDT = new Date(`${schedule.date}T00:00:00`)
    const endDT = new Date(`${schedule.date}T${schedule.endTime}:00`)
    const isPastOrToday = !isAfter(dayStartDT, now)
    const deadline = new Date(
        parseISO(schedule.date).getFullYear(),
        parseISO(schedule.date).getMonth() + 1,
        1, 23, 59, 59
    )

    const canDone = role === "teacher"
        && !schedule.teacherDoneAt
        && schedule.supervisorCheckedIn
        && isAfter(now, endDT)
        && isAfter(deadline, now)

    const afterEnd = isAfter(now, endDT)
    const canCheckin = isPastOrToday

    return (
        <div className={`flex items-center gap-4 rounded-2xl border p-4
                     shadow-sm transition-all duration-200 ${getCardStyle(schedule)}`}>

            {/* Thời gian */}
            <div className="flex-shrink-0 text-center w-16">
                <div className={`font-bold text-sm ${getAccentColor(schedule)}`}>
                    {schedule.startTime}
                </div>
                <div className="text-gray-600 text-xs">{schedule.endTime}</div>
            </div>

            {/* Đường kẻ dọc */}
            <div className={`w-0.5 self-stretch rounded-full flex-shrink-0
        ${schedule.teacherDoneAt ? "bg-green-300"
                    : schedule.supervisorCheckedIn ? "bg-violet-300"
                        : "bg-gray-200"}`} />

            {/* Nội dung */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-bold text-sm ${getAccentColor(schedule)}`}>
                        {schedule.className}
                    </span>
                    {schedule.isSubstituted && (
                        <span className="text-xs bg-orange-100 text-orange-600
                             px-2 py-0.5 rounded-full font-medium">
                            Dạy thay
                        </span>
                    )}
                    {schedule.type === "extra" && (
                        <span className="text-xs bg-blue-100 text-blue-600
                             px-2 py-0.5 rounded-full font-medium">
                            Tăng cường
                        </span>
                    )}
                </div>
                <div className="font-bold text-xs mt-0.5">{schedule.subject}</div>
                <div className="flex gap-3 mt-1.5 flex-wrap">
                    <span className="font-bold text-xs">📍 {schedule.room}</span>
                    {role === "supervisor" && (
                        <span className="font-bold text-xs">
                            👨‍🏫 {schedule.teacherName}
                        </span>
                    )}
                    {schedule.supervisorCheckedIn && schedule.checkInTime && (
                        <span className="text-xs text-violet-600 font-medium">
                            ✅ {format(schedule.checkInTime.toDate(), "HH:mm")}
                            {schedule.lateMinutes > 0 && (
                                <span className="text-red-500 ml-1">
                                    (trễ {schedule.lateMinutes} phút)
                                </span>
                            )}
                        </span>
                    )}
                </div>
            </div>

            {/* Nút hành động */}
            <div className="flex flex-col items-end gap-1">
                {/* Teacher: nút Done */}
                {role === "teacher" && !schedule.teacherDoneAt && (
                    <div className="flex flex-col items-end gap-1">
                        <button onClick={() => canDone && onDone(schedule)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all
        ${canDone
                                    ? "bg-green-500 hover:bg-green-600 text-white shadow-sm"
                                    : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}>
                            Done
                        </button>
                        {!schedule.supervisorCheckedIn && (
                            <span className="text-xs text-gray-400">Chờ giám thị điểm danh</span>
                        )}
                    </div>
                )}
                {role === "teacher" && schedule.teacherDoneAt && (
                    <span className="text-green-600 text-xs font-semibold
                           bg-green-50 px-3 py-1.5 rounded-xl">
                        ✓ Hoàn thành
                    </span>
                )}

                {/* Nút Điểm danh — giám thị */}
                {role === "supervisor" && !schedule.supervisorCheckedIn && (
                    isConfirming ? (
                        <div className="flex gap-2">
                            <button onClick={onCancelConfirm}
                                className="px-3 py-2 rounded-xl text-sm font-semibold
                   border border-gray-200 text-gray-500
                   hover:bg-gray-50 transition-all">
                                Hủy
                            </button>
                            <button onClick={() => onConfirm(schedule)}
                                className="px-3 py-2 rounded-xl text-sm font-semibold
                   bg-green-500 hover:bg-green-600 text-white
                   shadow-sm transition-all">
                                Xác nhận
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => canCheckin && onCheckin(schedule, afterEnd)}
                            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all
      ${canCheckin
                                    ? "bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
                                    : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}>
                            Điểm danh
                        </button>
                    )
                )}
                {role === "supervisor" && schedule.supervisorCheckedIn && (
                    <span className="text-violet-600 text-xs font-semibold
                   bg-violet-50 px-3 py-1.5 rounded-xl">
                        ✓ Đã điểm danh
                    </span>
                )}
                {role === "supervisor" && !schedule.supervisorCheckedIn && !canCheckin && (
                    <span className="text-xs text-gray-400">Chưa đến ngày học</span>
                )}
            </div>
        </div>
    )
}