// Firebase v9+ modular SDK
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBU1hDR7aqFn2Bs_VU69pk1flJ7fWu6sBk",
  authDomain: "stratum-quantumbits.firebaseapp.com",
  projectId: "stratum-quantumbits",
  storageBucket: "stratum-quantumbits.firebasestorage.app",
  messagingSenderId: "948078666889",
  appId: "1:948078666889:web:c120c439d572b8680b5258",
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

export { auth, googleProvider };
export default app;
