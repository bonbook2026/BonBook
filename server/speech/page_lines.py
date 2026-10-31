"""Match visible page rows to saved text; never invent a position for unmatched text."""
import sys,json,difflib,unicodedata
from alignment import align
from page_words import map_words

def stream(text):
    chars=[];offsets=[];offset=0
    for char in text:
        value=unicodedata.normalize('NFKC',char).lower().translate(str.maketrans('يكأإآؤئۀ','یکاااویه'))
        for c in value:
            if c.isalnum():chars.append(c);offsets.append(offset)
        offset+=len(char.encode('utf-16-le'))//2
    return ''.join(chars),offsets

def map_lines(content,rows,words=None,refined=None):
    target,offsets=stream(content);source='';owners=[];sizes=[]
    for i,row in enumerate(rows):
        value,_=stream(row['text']);sizes.append(len(value));source+=value;owners.extend([i]*len(value))
    if not target or not source or len(target)*len(source)>60_000_000:return {'lines':[],'coverage':0}
    matches=[[] for _ in rows]
    for block in difflib.SequenceMatcher(None,target,source,autojunk=False).get_matching_blocks():
        for a,b in zip(range(block.a,block.a+block.size),range(block.b,block.b+block.size)):matches[owners[b]].append(a)
    result=[];matched=0
    for row,size,positions in zip(rows,sizes,matches):
        if size<4 or not positions or len(positions)/size<.68:continue
        first,last=min(positions),max(positions)
        if last-first+1>size*1.65:continue
        start=offsets[first];end=offsets[last]+1
        if result and start<result[-1]['end']-2:continue
        matched+=len(positions);result.append({'start':start,'end':end,'x':row['x'],'y':row['y'],'width':row['width'],'height':row['height']})
    if words and result:
        timing=align(content,words,result)
        if timing['coverage']>=.65:
            times={cue['offset']:cue['time'] for cue in timing['cues']}
            for line in result:
                if line['start'] in times:line['time']=times[line['start']]
    word_map=map_words(content,rows,words,min_probability=.35,contextual=True)
    if refined:
        improved=map_words(content,rows,refined,min_probability=.3)
        by_start={word['start']:word for word in improved['words'] if 'time' in word}
        for word in word_map['words']:
            other=by_start.get(word['start'])
            if 'time' not in word and other and other['end']==word['end']:word.update(time=other['time'],endTime=other['endTime'])
        word_map['timedWordCount']=sum('time' in word for word in word_map['words'])
    for word in word_map['words']:
        center=word['rects'][0]['y']+word['rects'][0]['height']/2
        parent=next((line for line in result if line['y']-.005<=center<=line['y']+line['height']+.005),None)
        if parent:word['lineStart']=parent['start']
    return {'lines':result,'coverage':round(matched/max(1,len(target)),3),**word_map}

if __name__=='__main__':
    data=json.load(sys.stdin)
    print(json.dumps(map_lines(data['content'],data['rows'],data.get('words'),data.get('refined'))))
