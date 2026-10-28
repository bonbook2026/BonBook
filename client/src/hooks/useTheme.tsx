import {createContext,ReactNode,useContext,useEffect,useState} from 'react';
export type SiteTheme='day'|'night';
export const THEME_KEY='bonbook_theme';
function savedTheme():SiteTheme{
  try{const saved=localStorage.getItem(THEME_KEY);if(saved==='day'||saved==='night')return saved;return localStorage.getItem('bonbook_reader_theme')==='paper'?'day':'night';}catch{return 'night';}
}
const Context=createContext<{theme:SiteTheme;setTheme:(theme:SiteTheme)=>void;toggleTheme:()=>void}|null>(null);
export function ThemeProvider({children}:{children:ReactNode}){
  const [theme,setTheme]=useState<SiteTheme>(savedTheme);
  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='night'?'#0b1426':'#fbfdf9');
    try{localStorage.setItem(THEME_KEY,theme);}catch{/* The current session still keeps the theme. */}
  },[theme]);
  useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key===THEME_KEY&&(event.newValue==='day'||event.newValue==='night'))setTheme(event.newValue);};const restore=()=>setTheme(savedTheme());window.addEventListener('storage',sync);window.addEventListener('pageshow',restore);return()=>{window.removeEventListener('storage',sync);window.removeEventListener('pageshow',restore);};},[]);
  return <Context.Provider value={{theme,setTheme,toggleTheme:()=>setTheme(value=>value==='night'?'day':'night')}}>{children}</Context.Provider>;
}
export function useTheme(){const value=useContext(Context);if(!value)throw new Error('ThemeProvider is required');return value;}
