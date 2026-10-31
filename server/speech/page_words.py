"""Real printed-word boxes joined to real ASR intervals; no estimated boxes/times."""
import collections,difflib,math,re
from alignment import normalized

def text_tokens(text):
    result=[]
    for match in re.finditer(r'[^\W_]+(?:[\u064b-\u065f\u0670\u200c]+[^\W_]+)*[\u064b-\u065f\u0670]*',text,re.UNICODE):
        value=normalized(match.group())
        if not value:continue
        token={'value':value,'start':len(text[:match.start()].encode('utf-16-le'))//2,'end':len(text[:match.end()].encode('utf-16-le'))//2,'at':match.end()}
        if result and result[-1]['value'] in ('می','نمی') and '\n' not in text[result[-1]['at']:match.start()]:
            result[-1].update(value=result[-1]['value']+value,end=token['end'],at=token['at'])
        else:result.append(token)
    return result

def assignments(target,units):
    """Accept a source unit only when its characters belong to one text word."""
    a=''.join(token['value'] for token in target);a_owner=[i for i,token in enumerate(target) for _ in token['value']]
    b=''.join(unit['value'] for unit in units);b_owner=[i for i,unit in enumerate(units) for _ in unit['value']]
    if not a or not b or len(a)*len(b)>60_000_000:return {}
    votes=collections.defaultdict(list)
    for block in difflib.SequenceMatcher(None,a,b,autojunk=False).get_matching_blocks():
        for ai,bi in zip(range(block.a,block.a+block.size),range(block.b,block.b+block.size)):votes[b_owner[bi]].append(ai)
    mapped=collections.defaultdict(list)
    for index,positions in votes.items():
        owners={a_owner[p] for p in positions};size=len(units[index]['value'])
        if len(owners)!=1 or len(positions)/size<(1 if size<=3 else .9):continue
        owner=next(iter(owners));mapped[owner].append((index,positions))
    result={}
    for owner,parts in mapped.items():
        positions={position for _,values in parts for position in values};size=len(target[owner]['value']);indices=[index for index,_ in parts]
        if len(positions)/size<(1 if size<=3 else .9) or max(indices)-min(indices)+1!=len(indices):continue
        # Missing middle characters/words cannot turn a fragment into an exact word.
        if difflib.SequenceMatcher(None,target[owner]['value'],''.join(units[i]['value'] for i in indices)).ratio()<.94:continue
        result[owner]=indices
    return result

def valid_box(word):
    return all(isinstance(word.get(key),(int,float)) and math.isfinite(word[key]) for key in ('x','y','width','height')) and 0<=word['x']<1 and 0<=word['y']<1 and 0<word['width']<=1-word['x']+.002 and 0<word['height']<=1-word['y']+.002

def map_words(content,rows,speech,min_probability=.6,contextual=False):
    target=text_tokens(content);printed=[]
    for row_index,row in enumerate(rows):
        for word in row.get('words',[]):
            value=normalized(word.get('text',''))
            if value:printed.append({**word,'value':value,'row':row_index})
    geometry=assignments(target,printed)
    heard=[]
    for word in speech or []:
        value=normalized(word.get('text',''))
        if value:heard.append({**word,'value':value})
    timing=assignments(target,heard)
    if timing:
        a=''.join(token['value'] for token in target);b=''.join(unit['value'] for unit in heard)
        if len(a)*len(b)>60_000_000 or sum(block.size for block in difflib.SequenceMatcher(None,a,b,autojunk=False).get_matching_blocks())/max(1,len(a),len(b))<.7:timing={}
    for i in range(len(target)-1):
        if target[i]['value']==target[i+1]['value'] and ((i in timing)!=(i+1 in timing)):
            timing.pop(i,None);timing.pop(i+1,None)
    result=[];previous=-1
    for i,token in enumerate(target):
        indices=geometry.get(i)
        if not indices:continue
        units=[printed[index] for index in indices]
        if any(not valid_box(unit) or unit.get('confidence',0)<35 for unit in units):continue
        grouped={}
        for unit in units:
            group=grouped.setdefault(unit['row'],{'x':unit['x'],'y':unit['y'],'right':unit['x']+unit['width'],'bottom':unit['y']+unit['height']})
            group.update(x=min(group['x'],unit['x']),y=min(group['y'],unit['y']),right=max(group['right'],unit['x']+unit['width']),bottom=max(group['bottom'],unit['y']+unit['height']))
        rects=[{'x':box['x'],'y':box['y'],'width':box['right']-box['x'],'height':box['bottom']-box['y']} for box in grouped.values()]
        item={'start':token['start'],'end':token['end'],'rects':rects}
        if i in timing:
            parts=[heard[index] for index in timing[i]]
            confidences=[part.get('probability',1) for part in parts]
            confidence=all(isinstance(p,(int,float)) and math.isfinite(p) and p>=min_probability for p in confidences)
            if not confidence and contextual and all(isinstance(p,(int,float)) and math.isfinite(p) and p>=.15 for p in confidences) and i-1 in timing and i+1 in timing:
                confidence=all(heard[index].get('probability',1)>=.65 for neighbor in (i-1,i+1) for index in timing[neighbor])
            valid=confidence and all(all(isinstance(part.get(key),(int,float)) and math.isfinite(part[key]) for key in ('start','end')) and 0<=part['start']<part['end']<=86400 for part in parts)
            if valid and all(a['start']<=b['start'] for a,b in zip(parts,parts[1:])) and parts[0]['start']>previous:
                item.update(time=parts[0]['start'],endTime=max(part['end'] for part in parts));previous=item['time']
        result.append(item)
    return {'words':result,'wordCount':len(target),'timedWordCount':sum('time' in word for word in result)}
