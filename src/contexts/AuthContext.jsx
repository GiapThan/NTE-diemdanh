import { createContext, useContext, useEffect, useState } from "react"
import { auth, db } from "../firebase/config"
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    signOut
} from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null)
    const [userProfile, setUserProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    async function register({ email, password, displayName, requestedRole, subject }) {
        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(user, { displayName })
        await setDoc(doc(db, "users", user.uid), {
            displayName,
            email,
            photoURL: "",
            role: "pending",
            requestedRole,
            subject: requestedRole === "teacher" ? subject : "",
            teacherCode: "",
            isActive: false,
            createdAt: serverTimestamp(),
            approvedBy: "",
            approvedAt: null
        })
        return user
    }

    async function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password)
    }

    async function logout() {
        await signOut(auth)
        setUserProfile(null)
    }

    async function refreshProfile(uid) {
        const snap = await getDoc(doc(db, "users", uid))
        if (snap.exists()) setUserProfile(snap.data())
    }

    useEffect(() => {
        return onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user)
            if (user) {
                const snap = await getDoc(doc(db, "users", user.uid))
                if (snap.exists()) setUserProfile(snap.data())
            } else {
                setUserProfile(null)
            }
            setLoading(false)
        })
    }, [])

    return (
        <AuthContext.Provider value={{
            currentUser, userProfile,
            register, login, logout, refreshProfile,
            loading
        }}>
            {!loading && children}
        </AuthContext.Provider>
    )
}