import {useTheme} from '../hooks/useTheme';
import {Icon} from './Icon';
export function ThemeToggle(){
  const {theme,toggleTheme}=useTheme();
  return <button type="button" className="site-theme-toggle" aria-label={theme==='night'?'تم روز سبز و سفید':'تم شب آبی مهتابی'} aria-pressed={theme==='night'} onClick={toggleTheme}><Icon name={theme==='night'?'sun':'moon'}/></button>;
}
