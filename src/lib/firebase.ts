import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Your web app's Firebase configuration
// IMPORTANT: Ensure that Firebase Authentication is enabled in your Firebase project console (https://console.firebase.google.com/)
// for project "mahasen-ai-v013", and that any sign-in providers you intend to use (e.g., Google) are also enabled there.
// The error "auth/configuration-not-found" can occur if the Authentication service is not set up correctly in the project.
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDMsEWGOf0lQkkkghGLtsZMOaUstiRFs_Y",
  authDomain: "mahasen-ai-v013.firebaseapp.com",
  projectId: "mahasen-ai-v013",
  storageBucket: "mahasen-ai-v013.appspot.com", // CORRECTED: Typically, Firebase Storage bucket names end with .appspot.com. This was changed from .firebasestorage.app
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
const db: Firestore = getFirestore(app);

export { app, auth, db, firebaseConfig };
