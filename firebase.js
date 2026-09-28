import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: window.__KEUANGANKU_FIREBASE__?.apiKey || "",
  authDomain: window.__KEUANGANKU_FIREBASE__?.authDomain || "",
  projectId: window.__KEUANGANKU_FIREBASE__?.projectId || "",
  appId: window.__KEUANGANKU_FIREBASE__?.appId || ""
};

let authPromise;
export async function getFirebaseToken(){
  if(!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) return null;
  if(!authPromise){
    authPromise=(async()=>{
      const app=initializeApp(firebaseConfig);
      const auth=getAuth(app);
      if(!auth.currentUser) await signInAnonymously(auth);
      return auth;
    })();
  }
  const auth=await authPromise;
  return auth.currentUser.getIdToken();
}