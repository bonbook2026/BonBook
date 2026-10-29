import {useEffect,useRef,useState} from 'react';
import {lunarBounds,lunarLight} from '../utils/lunarLight';
const SIZE=192,source=`${import.meta.env.BASE_URL}images/moon-natural-v2.png`;
type Surface={pixels:Uint8ClampedArray;bounds:ReturnType<typeof lunarBounds>};
let surfacePromise:Promise<Surface>|null=null;
function surface(){
 if(!surfacePromise)surfacePromise=new Promise<Surface>((resolve,reject)=>{const image=new Image();image.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=SIZE;canvas.height=SIZE;const ctx=canvas.getContext('2d');if(!ctx)throw Error('No lunar canvas');ctx.drawImage(image,0,0,SIZE,SIZE);const pixels=ctx.getImageData(0,0,SIZE,SIZE).data;resolve({pixels,bounds:lunarBounds(pixels,SIZE)});}catch(error){reject(error);}};image.onerror=()=>reject(Error('Moon texture unavailable'));image.src=source;}).catch(error=>{surfacePromise=null;throw error;});
 return surfacePromise;
}
export function ReaderMoon({illumination}:{illumination:number}){
 const canvas=useRef<HTMLCanvasElement>(null),[texture,setTexture]=useState<Surface|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let live=true;void surface().then(value=>{if(live)setTexture(value);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};},[]);
 useEffect(()=>{const ctx=canvas.current?.getContext('2d');if(!ctx||!texture)return;const frame=ctx.createImageData(SIZE,SIZE);frame.data.set(lunarLight(texture.pixels,SIZE,illumination,texture.bounds));ctx.putImageData(frame,0,0);},[texture,illumination]);
 return <canvas ref={canvas} className="reader-moon-canvas" width={SIZE} height={SIZE} aria-hidden="true" style={failed?{backgroundImage:`url(${source})`,backgroundSize:'contain'}:undefined}/>;
}
