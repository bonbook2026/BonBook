/** Keep authenticated page URLs out of native image/link hit targets.
 * This deters long-press saving; it cannot prevent screen capture or network inspection.
 */
export async function paintPageCanvas(canvas:HTMLCanvasElement,url:string,signal:AbortSignal){
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal});
  if(!response.ok)throw new Error('Page image unavailable');
  const blob=await response.blob();
  if(signal.aborted)return;
  let source:ImageBitmap|HTMLImageElement;
  let dispose=()=>{};
  if(typeof createImageBitmap==='function'){
    const bitmap=await createImageBitmap(blob);source=bitmap;dispose=()=>bitmap.close();
  }else{
    const objectUrl=URL.createObjectURL(blob),image=new Image();
    dispose=()=>{image.src='';URL.revokeObjectURL(objectUrl);};
    try{
      await new Promise<void>((resolve,reject)=>{
        const abort=()=>{image.src='';reject(new DOMException('Aborted','AbortError'));};
        image.onload=()=>{signal.removeEventListener('abort',abort);resolve();};
        image.onerror=()=>{signal.removeEventListener('abort',abort);reject(new Error('Page image invalid'));};
        signal.addEventListener('abort',abort,{once:true});
        if(signal.aborted){abort();return;}
        image.src=objectUrl;
      });
    }catch(error){dispose();throw error;}
    source=image;
  }
  try{
    if(signal.aborted)return;
    const width=source instanceof HTMLImageElement?source.naturalWidth:source.width;
    const height=source instanceof HTMLImageElement?source.naturalHeight:source.height;
    if(!width||!height)throw new Error('Empty page image');
    // Bound decoding/display memory on mobile while retaining the server's stamped pixels.
    const scale=Math.min(1,2400/Math.max(width,height));
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const context=canvas.getContext('2d');
    if(!context)throw new Error('Canvas unavailable');
    context.drawImage(source,0,0,canvas.width,canvas.height);
  }finally{dispose();}
}
