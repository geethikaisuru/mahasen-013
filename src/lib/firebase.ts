
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDMsEWGOf0lQkkkghGLtsZMOaUstiRFs_Y",
  authDomain: "mahasen-ai-v013.firebaseapp.com",
  projectId: "mahasen-ai-v013",
  storageBucket: "mahasen-ai-v013.firebasestorage.app", // Note: Typically ends with .appspot.com, using provided value.
  messagingSenderId: "225402607908",
  appId: "1:225402607908:web:2c47d16b7ccabedb5ebbb1"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth: Auth = getAuth(app);

export { app, auth, firebaseConfig };
