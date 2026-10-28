import {HttpError} from '../lib/httpError';
export function validateAudioCues(value:unknown,content:string,audioAssetId:string|null){
  if(!Array.isArray(value)||value.length>2000)throw new HttpError(400,'حداکثر ۲۰۰۰ زمان شروع برای هر صفحه مجاز است.');
  let previousTime=-1,previousOffset=-1;
  const cues=value.map(cue=>{
    if(!audioAssetId||typeof cue?.time!=='number'||!Number.isFinite(cue.time)||cue.time<0||cue.time>86400||cue.time<=previousTime||!Number.isInteger(cue.offset)||cue.offset<0||cue.offset>=content.length||cue.offset<=previousOffset)throw new HttpError(400,'زمان‌ها و ترتیب خط‌های صوت باید صعودی و داخل متن صفحه باشند.');
    previousTime=cue.time;previousOffset=cue.offset;return {time:cue.time,offset:cue.offset};
  });
  return JSON.stringify(cues);
}
