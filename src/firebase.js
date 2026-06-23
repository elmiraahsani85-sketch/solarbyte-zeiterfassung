import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA6KlUCZ7FmXNNvxxcLRwZvG4oUcD5UB6A",
  authDomain: "solarbyte-zeiterfassung.firebaseapp.com",
  projectId: "solarbyte-zeiterfassung",
  storageBucket: "solarbyte-zeiterfassung.firebasestorage.app",
  messagingSenderId: "40771805864",
  appId: "1:40771805864:web:dbdc84e2a3afef0579589d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);