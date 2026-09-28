const firebaseConfig={apiKey:"",authDomain:"",projectId:"",appId:""};
let authPromise=null;
export async function getFirebaseToken(){
  if(!firebaseConfig.apiKey||!firebaseConfig.projectId||!firebaseConfig.appId)return null;
  if(!authPromise){
    authPromise=(async()=>{
      const [{initializeApp},{getAuth,signInAnonymously}]=await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js")
      ]);
      const app=initializeApp(firebaseConfig);
      const auth=getAuth(app);
      if(!auth.currentUser)await signInAnonymously(auth);
      return auth;
    })();
  }
  const auth=await authPromise;
  return auth.currentUser.getIdToken();
}
export const firebaseConfigured=()=>!!firebaseConfig.apiKey&&!!firebaseConfig.projectId&&!!firebaseConfig.appId;
