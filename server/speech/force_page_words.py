"""Private, derived word alignment of approved page text with its unchanged audio."""
import json,os,sys,math
os.environ['HF_HUB_OFFLINE']='1'
os.environ['OMP_NUM_THREADS']='1'

def windows(content,cues,duration):
    ordered=[cue for cue in cues if isinstance(cue.get('time'),(int,float)) and math.isfinite(cue['time']) and 0<=cue['time']<duration and isinstance(cue.get('offset'),int) and 0<=cue['offset']<len(content.encode('utf-16-le'))//2]
    if any(a['time']>=b['time'] or a['offset']>=b['offset'] for a,b in zip(ordered,ordered[1:])):return []
    result=[];i=0;encoded=content.encode('utf-16-le')
    while i<len(ordered):
        j=i+1
        while j<len(ordered) and ordered[j]['time']-ordered[i]['time']<24 and ordered[j]['offset']-ordered[i]['offset']<1300:j+=1
        end=ordered[j]['time'] if j<len(ordered) else duration
        if end-ordered[i]['time']>28:return []
        last=ordered[j]['offset'] if j<len(ordered) else len(encoded)//2
        text=encoded[ordered[i]['offset']*2:last*2].decode('utf-16-le').strip()
        if text:result.append({'start':max(0,ordered[i]['time']-.6),'end':min(duration,end+.2),'text':text})
        i=j
    return result

def run(request):
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio,pad_or_trim
    from faster_whisper.tokenizer import Tokenizer
    audio=decode_audio(request['audio'],sampling_rate=16000);duration=len(audio)/16000
    if not 0<duration<=7200:raise ValueError('Invalid audio duration')
    parts=windows(request['text'],request['cues'],duration)
    if not parts:return {'words':[]}
    model=WhisperModel(request['model'],device='cpu',compute_type='int8',cpu_threads=1,num_workers=1,local_files_only=True)
    tokenizer=Tokenizer(model.hf_tokenizer,model.model.is_multilingual,task='transcribe',language=request.get('language','fa'))
    words=[]
    for part in parts:
        chunk=audio[int(part['start']*16000):int(part['end']*16000)]
        features=model.feature_extractor(chunk);frames=min(features.shape[-1],3000)
        tokens=tokenizer.encode(' '+part['text'])
        if len(tokens)>440:continue
        alignment=model.find_alignment(tokenizer,[tokens],model.encode(pad_or_trim(features,3000)),frames)[0]
        for word in alignment:
            text=word['word'].strip();start=round(part['start']+float(word['start']),3);end=round(part['start']+float(word['end']),3);prob=float(word['probability'])
            if text and 0<=start<end<=duration+.02 and end-start<=3 and math.isfinite(prob):words.append({'text':text,'start':start,'end':end,'probability':prob})
    return {'words':words}

if __name__=='__main__':
    request=json.load(sys.stdin)
    print(json.dumps(run(request),ensure_ascii=False))
