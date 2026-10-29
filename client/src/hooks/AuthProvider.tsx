import { createContext, ReactNode, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, setToken, clearToken, ApiError } from '../services/api';
import { AuthResponse, User } from '../types';
import { IS_DEMO } from '../config/demo';
interface AuthState { user:User|null; loading:boolean; error:string|null; profileComplete:boolean; missingFields:string[] }
function useAuthState(){
  const revision=useRef(0);
  const [state,setState]=useState<AuthState>({user:null,loading:true,error:null,profileComplete:false,missingFields:[]});
  const apply=useCallback((result:Omit<AuthResponse,'token'>)=>{setState({user:result.user,loading:false,error:null,profileComplete:result.profileComplete,missingFields:result.missingFields});},[]);
  const authenticate=useCallback(async(requestLogin:()=>Promise<AuthResponse>)=>{
    const attempt=++revision.current;
    setState(s=>({...s,loading:true,error:null}));
    try{const result=await requestLogin();if(attempt!==revision.current)throw new Error('تلاش ورود متوقف شد.');setToken(result.token);apply(result);return result;}
    catch(error){if(attempt===revision.current)setState(s=>({...s,loading:false,error:error instanceof Error?error.message:'ورود انجام نشد.'}));throw error;}
  },[apply]);
  const login=useCallback((data:string)=>authenticate(()=>api.auth.login(data)),[authenticate]);
  const loginLocally=useCallback(()=>authenticate(api.auth.localTelegramLogin),[authenticate]);
  const completeGoogle=useCallback(()=>{clearToken();return authenticate(api.auth.session);},[authenticate]);
  const refreshProfile=useCallback(async()=>{const attempt=revision.current,result=await (IS_DEMO?api.users.getProfile():api.auth.session());if(attempt===revision.current)apply(result);},[apply]);
  const logout=useCallback(()=>{revision.current++;void api.auth.logout().catch(()=>{});clearToken();setState({user:null,loading:false,error:null,profileComplete:false,missingFields:[]});try{localStorage.setItem('bonbook_session_ended',String(Date.now()));}catch{}},[]);
  useEffect(()=>{const ended=()=>{revision.current++;clearToken();setState({user:null,loading:false,error:null,profileComplete:false,missingFields:[]});},storage=(event:StorageEvent)=>{if(event.key==='bonbook_session_ended')ended();};window.addEventListener('bonbook:session-ended',ended);window.addEventListener('storage',storage);return()=>{window.removeEventListener('bonbook:session-ended',ended);window.removeEventListener('storage',storage);};},[]);
  useEffect(()=>{let active=true;const current=revision.current;(IS_DEMO?api.users.getProfile():api.auth.session()).then(result=>{if(active&&current===revision.current)apply(result);}).catch(error=>{if(active&&current===revision.current){if(IS_DEMO||(error instanceof ApiError&&error.status===401)){clearToken();setState(s=>({...s,loading:false,error:null}));}else setState(s=>({...s,loading:false,error:error instanceof Error?error.message:'دریافت حساب انجام نشد؛ دوباره تلاش کنید.'}));}});return()=>{active=false;};},[apply]);
  return {...state,login,loginLocally,logout,completeGoogle,refreshProfile};
}
const Context=createContext<ReturnType<typeof useAuthState>|null>(null);
export function AuthProvider({children}:{children:ReactNode}){const value=useAuthState();return <Context.Provider value={value}>{children}</Context.Provider>;}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error('AuthProvider is required');return value;}
