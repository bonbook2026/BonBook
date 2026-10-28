"""Private, offline ASR bridge. Only timestamped recognition leaves this process."""
import json,os,sys
os.environ['HF_HUB_OFFLINE']='1'
os.environ['OMP_NUM_THREADS']='2'
def run():
    import av
    from faster_whisper import WhisperModel
    with open(sys.argv[1],encoding='utf-8') as stream:request=json.load(stream)
    with av.open(request['audio']) as container:
        duration=float(container.duration or 0)/av.time_base
        if not 0<duration<=7200:raise ValueError('مدت فایل باید مشخص و حداکثر دو ساعت باشد.')
    model=WhisperModel(request['model'],device='cpu',compute_type='int8',cpu_threads=2,num_workers=1,local_files_only=True)
    segments,info=model.transcribe(request['audio'],language=request.get('language','fa'),beam_size=5,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
    words=[]
    for segment in segments:
        for word in segment.words or []:
            if word.word.strip():words.append({'text':word.word.strip(),'start':round(word.start,3),'end':round(word.end,3),'probability':round(word.probability,3)})
        if len(words)>40000:raise ValueError('متن گفتار بیش از حد طولانی است.')
        print(json.dumps({'progress':min(.99,segment.end/duration)}),flush=True)
    from alignment import align
    result=align(request['text'],words,request['lines'])
    result.update({'words':words,'duration':duration,'language':info.language})
    with open(request['output'],'w',encoding='utf-8') as stream:json.dump(result,stream,ensure_ascii=False)
    print(json.dumps({'progress':1}),flush=True)
if __name__=='__main__':
    try:run()
    except Exception as error:
        print(json.dumps({'error':str(error)[:300]},ensure_ascii=False),flush=True)
        sys.exit(1)
