"""Match visible page rows to saved text; never invent a position for unmatched text."""
import sys,json,difflib,unicodedata
from alignment import align

def stream(text):
    chars=[];offsets=[];offset=0
    for char in text:
        value=unicodedata.normalize('NFKC',char).lower().translate(str.maketrans('يكأإآؤئۀ','یکاااویه'))
        for c in value:
            if c.isalnum():chars.append(c);offsets.append(offset)
        offset+=len(char.encode('utf-16-le'))//2
    return ''.join(chars),offsets

def map_lines(content,rows,words=None):
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
    return {'lines':result,'coverage':round(matched/max(1,len(target)),3)}

if __name__=='__main__':
    data=json.load(sys.stdin)
    print(json.dumps(map_lines(data['content'],data['rows'],data.get('words'))))
