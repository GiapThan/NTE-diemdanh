import { useState, useEffect } from "react"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
import Navbar from "../../components/Navbar"

export default function AdminSettings() {
    const { currentUser } = useAuth()
    const [form, setForm] = useState({
        lateThresholdMinutes: 10,
        penaltyPerLateMinute: 5000,
        absencePenalty: 200000,
    })
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => { fetchSettings() }, [])

    async function fetchSettings() {
        setLoading(true)
        try {
            const snap = await getDoc(doc(db, "settings", "rules"))
            if (snap.exists()) {
                const d = snap.data()
                setForm({
                    lateThresholdMinutes: d.lateThresholdMinutes,
                    penaltyPerLateMinute: d.penaltyPerLateMinute,
                    absencePenalty: d.absencePenalty,
                })
            }
        } catch { toast.error("Không thể tải cài đặt") }
        setLoading(false)
    }

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        try {
            await setDoc(doc(db, "settings", "rules"), {
                ...form,
                lateThresholdMinutes: Number(form.lateThresholdMinutes),
                penaltyPerLateMinute: Number(form.penaltyPerLateMinute),
                absencePenalty: Number(form.absencePenalty),
                updatedBy: currentUser.uid,
                updatedAt: serverTimestamp()
            })
            toast.success("Đã lưu cài đặt")
        } catch { toast.error("Có lỗi xảy ra") }
        setSaving(false)
    }

    const fields = [
        {
            key: "lateThresholdMinutes",
            label: "Ngưỡng tính trễ",
            unit: "phút",
            hint: "Đến trễ từ bao nhiêu phút mới bị tính vi phạm"
        },
        {
            key: "penaltyPerLateMinute",
            label: "Phạt mỗi phút trễ",
            unit: "đồng",
            hint: "Số tiền phạt cho mỗi phút đến trễ"
        },
        {
            key: "absencePenalty",
            label: "Phạt vắng không phép",
            unit: "đồng",
            hint: "Số tiền phạt cho mỗi buổi vắng không có lý do"
        },
    ]

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 lg:pl-56
                    font-['Segoe_UI',sans-serif]">
            <Navbar />
            <div className="pt-16 lg:pt-0 p-4 md:p-8 max-w-xl">

                <h1 className="text-2xl font-bold mb-2">Cài đặt hệ thống</h1>
                <p className="text-gray-800/40 text-sm mb-8">
                    Các quy định áp dụng khi tính lương và vi phạm cuối tháng
                </p>

                {loading ? (
                    <div className="text-gray-800/40 text-center py-12">Đang tải...</div>
                ) : (
                    <form onSubmit={handleSave} className="flex flex-col gap-4">
                        {fields.map(f => (
                            <div key={f.key}
                                className="bg-white border border-gray-200
                              rounded-2xl p-5">
                                <label className="text-gray-800 font-semibold text-sm block mb-1">
                                    {f.label}
                                </label>
                                <p className="text-gray-800/40 text-xs mb-3">{f.hint}</p>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min={0}
                                        value={form[f.key]}
                                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                                        className="flex-1 bg-gray-100 border border-white/15
                               rounded-xl px-4 py-3 text-gray-800 text-base
                               outline-none focus:border-violet-500
                               transition-colors"
                                    />
                                    <span className="text-gray-800/40 text-sm w-14">{f.unit}</span>
                                </div>
                                {/* Preview */}
                                {f.key === "penaltyPerLateMinute" && (
                                    <p className="text-gray-800/30 text-xs mt-2">
                                        Ví dụ: trễ 15 phút = phạt{" "}
                                        {(form.penaltyPerLateMinute * 15).toLocaleString("vi-VN")}đ
                                    </p>
                                )}
                                {f.key === "absencePenalty" && (
                                    <p className="text-gray-800/30 text-xs mt-2">
                                        Ví dụ: vắng 2 buổi = phạt{" "}
                                        {(form.absencePenalty * 2).toLocaleString("vi-VN")}đ
                                    </p>
                                )}
                            </div>
                        ))}

                        <button type="submit" disabled={saving}
                            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50
                         py-3 rounded-xl text-gray-800 font-semibold
                         transition-all mt-2">
                            {saving ? "Đang lưu..." : "Lưu cài đặt"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}