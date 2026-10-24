window.firebaseConfig = {
  apiKey: "AIzaSyBE1L2p81QIYNHB1pCrxaFLMyJ79gcVijY",
  authDomain: "nbda-1ee36.firebaseapp.com",
  projectId: "nbda-1ee36",
  storageBucket: "nbda-1ee36.firebasestorage.app",
  messagingSenderId: "601886705465",
  appId: "1:601886705465:web:5ca40dc83b62e7d0270ae8",
  measurementId: "G-WSDCZ2SQQ5"
};

if (typeof firebase !== "undefined" && firebase.apps.length === 0) {
  firebase.initializeApp(window.firebaseConfig);
}
