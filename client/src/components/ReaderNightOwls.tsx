import {useEffect,useState} from 'react';
import {ReaderCompanion} from './ReaderCompanion';

export function ReaderNightOwls({progress,moving}:{progress:number;moving:boolean}){
 const whiteVisible=progress>.48,grayVisible=progress>.72;
 const [whiteSettled,setWhiteSettled]=useState(false);
 useEffect(()=>{if(!whiteVisible){setWhiteSettled(false);return;}const timer=window.setTimeout(()=>setWhiteSettled(true),1400);return()=>window.clearTimeout(timer);},[whiteVisible]);
 return <div className="journey-owl-pair"><span className="owl-white-slot">{whiteVisible&&<span className="owl-arrival owl-white-arrival"><ReaderCompanion night moving={moving} owlTone="white" label="بازی با جغد سفید"/></span>}</span><span className="pair-gray">{grayVisible&&whiteSettled&&<span className="owl-arrival owl-gray-arrival"><ReaderCompanion night moving={moving} label="بازی با جغد خاکستری"/></span>}</span></div>;
}
