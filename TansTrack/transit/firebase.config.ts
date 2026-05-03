// NOTE: This configuration file appears to be a duplicate.
// The Ionic app uses the configuration in src/environments/environment.ts
// Consider removing this file if it's not being used by other parts of the project.

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {  apiKey: "AIzaSyBo-VDnMydyV6Ew9SHr0_XdOEBiptdYm-s",
  authDomain: "jobop-5af67.firebaseapp.com",
  projectId: "jobop-5af67",
  storageBucket: "jobop-5af67.appspot.com",
  messagingSenderId: "1065322065428",
  appId: "1:1065322065428:web:408dd83f84c8fead40c101",
  measurementId: "G-HVCT069RYY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { app, analytics, db, firebaseConfig };