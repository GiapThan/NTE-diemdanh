import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

// Paste Firebase config của bạn vào đây
const firebaseConfig = {
    apiKey: "AIzaSyDYGsX6G_wt0OEtob6S-enTxN4JIOwLVeY",
    authDomain: "nte-diemdanh.firebaseapp.com",
    projectId: "nte-diemdanh",
    storageBucket: "nte-diemdanh.firebasestorage.app",
    messagingSenderId: "848122957158",
    appId: "1:848122957158:web:fc049849b4ff0b859c0ca7"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)