import {createContext,ReactNode,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {api} from '../services/api';
import {useAuth} from './useAuth';
import {SiteFeatures,SiteSection} from '../types/siteSettings';

function useFeaturesState(){
  const {user,loading:authLoading}=useAuth(),isAdmin=user?.role==='OWNER'||user?.role==='ADMIN';
  const [features,setFeatures]=useState<SiteFeatures|null>(null),[error,setError]=useState('');
  const revision=useRef(0),mounted=useRef(true);
  const refresh=useCallback(async()=>{
    const current=++revision.current;
    try{const result=await api.site.sections();if(mounted.current&&current===revision.current){setFeatures(result.features);setError('');}}
    catch(error){if(mounted.current&&current===revision.current)setError(error instanceof Error?error.message:'دریافت تنظیمات سایت انجام نشد.');}
  },[]);
  const apply=useCallback((next:SiteFeatures)=>{revision.current++;setFeatures(next);setError('');},[]);
  useEffect(()=>{mounted.current=true;void refresh();const focus=()=>{if(!document.hidden)void refresh();};window.addEventListener('focus',focus);window.addEventListener('pageshow',focus);document.addEventListener('visibilitychange',focus);window.addEventListener('bonbook:sections-changed',focus);const timer=window.setInterval(focus,60_000);return()=>{mounted.current=false;revision.current++;window.clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('pageshow',focus);document.removeEventListener('visibilitychange',focus);window.removeEventListener('bonbook:sections-changed',focus);};},[refresh]);
  useEffect(()=>{void refresh();},[user?.id,user?.role,refresh]);
  const canAccess=(section:SiteSection)=>Boolean(isAdmin||(features?.[section]&&(section!=='search'||features.library)));
  const home=isAdmin||canAccess('library')?'/library':canAccess('search')?'/search':canAccess('store')?'/shop':canAccess('profile')?'/profile':null;
  return {features,error,loading:authLoading||!features&&!error,isAdmin,canAccess,home,refresh,apply};
}
const Context=createContext<ReturnType<typeof useFeaturesState>|null>(null);
export function SiteFeaturesProvider({children}:{children:ReactNode}){return <Context.Provider value={useFeaturesState()}>{children}</Context.Provider>;}
export function useSiteFeatures(){const value=useContext(Context);if(!value)throw new Error('SiteFeaturesProvider is required');return value;}
