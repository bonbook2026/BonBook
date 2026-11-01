"""Private, offline ASR bridge. Only timestamped recognition leaves this process."""
import json,os,sys,math
os.environ['HF_HUB_OFFLINE']='1'
os.environ['OMP_NUM_THREADS']='2'
def valid_recognition(saved):
    if not isinstance(saved,dict):return False
    words=saved.get('words');duration=saved.get('duration')
    if not isinstance(duration,(int,float)) or not math.isfinite(duration) or not 0<duration<=7200:return False
    if not isinstance(words,list) or not 0<len(words)<=40000:return False
    previous=-1
    for word in words:
        if not isinstance(word,dict) or not isinstance(word.get('text'),str) or not word['text'].strip():return False
        start=word.get('start');end=word.get('end');probability=word.get('probability',1)
        if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in (start,end,probability)):return False
        if not previous<=start<=end<=duration or not 0<=probability<=1:return False
        previous=start
    return words[0]['start']>=0

def transcribe_request(request):
    saved=request.get('recognized');language=request.get('language','fa')
    if valid_recognition(saved):
        words=saved['words'];duration=saved['duration']
    else:
        import av
        from faster_whisper import WhisperModel
        with av.open(request['audio']) as container:
            duration=float(container.duration or 0)/av.time_base
            if not 0<duration<=7200:raise ValueError('مدت فایل باید مشخص و حداکثر دو ساعت باشد.')
        model=WhisperModel(request['model'],device='cpu',compute_type='int8',cpu_threads=2,num_workers=1,local_files_only=True)
        segments,info=model.transcribe(request['audio'],language=language,beam_size=5,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
        language=info.language;words=[]
        for segment in segments:
            for word in segment.words or []:
                if word.word.strip():words.append({'text':word.word.strip(),'start':round(word.start,3),'end':round(word.end,3),'probability':round(word.probability,3)})
            if len(words)>40000:raise ValueError('متن گفتار بیش از حد طولانی است.')
            print(json.dumps({'progress':min(.99,segment.end/duration)}),flush=True)
    from alignment import align
    result=align(request['text'],words,request['lines'])
    result.update({'words':words,'duration':duration,'language':language})
    return result

def run():
    with open(sys.argv[1],encoding='utf-8') as stream:request=json.load(stream)
    result=transcribe_request(request)
    with open(request['output'],'w',encoding='utf-8') as stream:json.dump(result,stream,ensure_ascii=False)
    print(json.dumps({'progress':1}),flush=True)
if __name__=='__main__':
    try:run()
    except Exception as error:
        print(json.dumps({'error':str(error)[:300]},ensure_ascii=False),flush=True)
        sys.exit(1)
