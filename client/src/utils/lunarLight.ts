const clamp=(value:number)=>Math.max(0,Math.min(1,value));
export function lunarBounds(pixels:Uint8ClampedArray,size:number){
 let minX=size,minY=size,maxX=0,maxY=0;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(pixels[(y*size+x)*4+3]>80){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 return {x:(minX+maxX)/2,y:(minY+maxY)/2,radius:Math.max(1,(Math.max(maxX-minX,maxY-minY)+1)/2)};
}
/** Illuminate a detailed lunar surface with a spherical, softly feathered terminator. */
export function lunarLight(pixels:Uint8ClampedArray,size:number,illumination:number,bounds=lunarBounds(pixels,size)){
 const result=new Uint8ClampedArray(pixels),lit=clamp(illumination);
 if(lit>=.9999)return result;
 const lightZ=2*lit-1,lightX=Math.sqrt(Math.max(0,1-lightZ*lightZ)),fullBlend=clamp((lit-.8)/.2);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const offset=(y*size+x)*4;if(!pixels[offset+3])continue;
  const nx=(x-bounds.x)/bounds.radius,ny=(y-bounds.y)/bounds.radius,nz=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
  const diffuse=nx*lightX+nz*lightZ,t=clamp((diffuse+.035)/.105),soft=t*t*(3-2*t);
  const brightness=fullBlend+(1-fullBlend)*(.45+.55*Math.pow(Math.max(0,diffuse),.35));
  result[offset]=pixels[offset]*brightness;result[offset+1]=pixels[offset+1]*brightness;result[offset+2]=pixels[offset+2]*brightness;
  result[offset+3]=pixels[offset+3]*(.025+.975*soft);
 }
 return result;
}
