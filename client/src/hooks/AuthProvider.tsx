import { createContext, ReactNode, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, setToken, clearToken } from '../services/api';
import { AuthResponse, User } from '../types';
interface AuthState { user:User|null; loading:boolean; error:string|null; profileComplete:boolean; missingFields:string[] }
function useAuthState(){
  const revision=useRef(0);
  const [state,setState]=useState<AuthState>({user:null,loading:true,error:null,profileComplete:false,missingFields:[]});
  const apply=useCallback((result:Omit<AuthResponse,'token'>)=>{setState({user:result.user,loading:false,error:null,profileComplete:result.profileComplete,missingFields:result.missingFields});},[]);
  const authenticate=useCallback(async(requestLogin:()=>Promise<AuthResponse>)=>{
    revision.current++;
    setState(s=>({...s,loading:true,error:null}));
    try{const result=await requestLogin();setToken(result.token);apply(result);return result;}
    catch(error){setState(s=>({...s,loading:false,error:error instanceof Error?error.message:'ورود انجام نشد.'}));throw error;}
  },[apply]);
  const login=useCallback((data:string)=>authenticate(()=>api.auth.login(data)),[authenticate]);
  const loginLocally=useCallback(()=>authenticate(api.auth.localTelegramLogin),[authenticate]);
  const completeGoogle=useCallback(()=>{clearToken();return authenticate(api.auth.session);},[authenticate]);
  const refreshProfile=useCallback(async()=>{apply(await api.users.getProfile());},[apply]);
  const logout=useCallback(()=>{revision.current++;void api.auth.logout().catch(()=>{});clearToken();setState({user:null,loading:false,error:null,profileComplete:false,missingFields:[]});},[]);
  useEffect(()=>{let active=true;const current=revision.current;api.users.getProfile().then(result=>{if(active&&current===revision.current)apply(result);}).catch(()=>{if(active&&current===revision.current){clearToken();setState(s=>({...s,loading:false}));}});return()=>{active=false;};},[apply]);
  return {...state,login,loginLocally,logout,completeGoogle,refreshProfile};
}
const Context=createContext<ReturnType<typeof useAuthState>|null>(null);
export function AuthProvider({children}:{children:ReactNode}){const value=useAuthState();return <Context.Provider value={value}>{children}</Context.Provider>;}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error('AuthProvider is required');return value;}
