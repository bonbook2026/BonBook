"""Monotonic matching of recognized words to the existing book; never rewrites it."""
import difflib,re,unicodedata,collections
def normalized(value):
    value=unicodedata.normalize('NFKC',value).lower().translate(str.maketrans('يكأإآؤئۀ','یکاااویه'))
    return ''.join(c for c in value if c.isalnum())
def tokens(text):
    result=[]
    for match in re.finditer(r'[^\W_]+(?:\u200c[^\W_]+)*',text,re.UNICODE):
        value=normalized(match.group())
        if not value:continue
        offset=len(text[:match.start()].encode('utf-16-le'))//2
        if result and result[-1]['value'] in ('می','نمی'):
            result[-1]['value']+=value
        else:result.append({'value':value,'offset':offset})
    return result
def align(text,words,lines):
    target=tokens(text);heard=[]
    for word in words:
        for token in tokens(word['text']):
            value=token['value']
            if heard and heard[-1]['value'] in ('می','نمی'):heard[-1]['value']+=value
            else:heard.append({'value':value,'time':word['start'],'probability':word.get('probability',1)})
    a=[row['value'] for row in target];b=[row['value'] for row in heard];matched={}
    matcher=difflib.SequenceMatcher(None,a,b,autojunk=False)
    for tag,a1,a2,b1,b2 in matcher.get_opcodes():
        if tag=='equal':
            for i,j in zip(range(a1,a2),range(b1,b2)):
                if heard[j]['probability']>=.35:matched[i]=j
        elif tag=='replace' and a2-a1==b2-b1 and a2-a1<=8:
            for i,j in zip(range(a1,a2),range(b1,b2)):
                if len(a[i])>=4 and heard[j]['probability']>=.5 and difflib.SequenceMatcher(None,a[i],b[j]).ratio()>=.8:matched[i]=j
    # OCR and Persian ASR often disagree about word spacing. Compare the same
    # monotonic character stream as well, retaining the real ASR word times.
    exact_coverage=len(matched)/max(1,len(target))
    astr=''.join(a);bstr=''.join(b)
    if exact_coverage>=.35 and len(astr)*len(bstr)<=100_000_000:
        a_owner=[i for i,word in enumerate(a) for _ in word];b_owner=[i for i,word in enumerate(b) for _ in word]
        votes=collections.defaultdict(collections.Counter)
        for block in difflib.SequenceMatcher(None,astr,bstr,autojunk=False).get_matching_blocks():
            for ai,bi in zip(range(block.a,block.a+block.size),range(block.b,block.b+block.size)):
                if heard[b_owner[bi]]['probability']>=.35:votes[a_owner[ai]][b_owner[bi]]+=1
        previous=-1
        for i in range(len(target)):
            choices=votes.get(i)
            if not choices:continue
            total=sum(choices.values())
            if total/max(1,len(a[i]))<(.75 if len(a[i])<4 else .6):continue
            candidates=[j for j in choices if j>=previous]
            if candidates:
                j=min(candidates,key=lambda candidate:(-choices[candidate],candidate));matched[i]=j;previous=j
    previous=-1
    for i in sorted(list(matched)):
        if matched[i]<previous:del matched[i]
        else:previous=matched[i]
    cues=[];previous=-1
    for line in lines:
        positions=[i for i in matched if line['start']<=target[i]['offset']<line['end']]
        if not positions:continue
        first=min(positions);time=heard[matched[first]]['time']
        if time>previous:
            cues.append({'offset':line['start'],'time':time});previous=time
    coverage=len(matched)/max(1,len(target));spoken_coverage=len(set(matched.values()))/max(1,len(heard));line_coverage=len(cues)/max(1,len(lines))
    safe=exact_coverage>=.5 and coverage>=.78 and spoken_coverage>=.65 and line_coverage==1 and len(cues)>0
    return {'cues':cues,'coverage':round(coverage,4),'spokenCoverage':round(spoken_coverage,4),'lineCoverage':round(line_coverage,4),'safe':safe}
