import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: ""
};

let auth=null;
if(firebaseConfig.apiKey&&firebaseConfig.projectId&&firebaseConfig.appId){
  const app=initializeApp(firebaseConfig);
  auth=getAuth(app);
}

export async function getFirebaseToken(){
  if(!auth)return null;
  if(!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser.getIdToken();
}
export const firebaseConfigured=()=>!!auth;