import unittest
from force_page_words import windows,speech_anchors
class ForcedWindowTests(unittest.TestCase):
    def test_real_cue_boundaries_split_text_without_linear_timing(self):
        result=windows('📖 متن اول. متن دوم.',[{'time':1,'offset':0},{'time':25,'offset':12}],40)
        self.assertEqual(len(result),2);self.assertEqual(result[0]['start'],.4);self.assertEqual(result[0]['end'],25.2)
        self.assertEqual(result[0]['text'],'📖 متن اول.')
        self.assertEqual(result[1]['text'],'متن دوم.')
    def test_bad_or_overlong_intervals_are_not_forced(self):
        self.assertEqual(windows('یک متن طولانی',[{'time':0,'offset':0}],100),[])
        self.assertEqual(windows('کتاب خواندن',[{'time':3,'offset':0},{'time':1,'offset':5}],10),[])
        self.assertEqual(windows('متن',[],10),[])
    def test_edited_text_reuses_actual_speech_anchors_without_saved_cues(self):
        words=[{'text':text,'start':i*2,'end':i*2+1,'probability':.99} for i,text in enumerate(['کتاب','خوب','است'])]
        result=speech_anchors('کتاب خوب است.',words)
        self.assertEqual([cue['time'] for cue in result],[0,2,4])
        self.assertEqual(speech_anchors('هوا ابری بود.',words),[])
    def test_a_long_unmatched_tail_does_not_discard_earlier_real_windows(self):
        result=windows('متن اول. متن دوم.',[{'time':0,'offset':0},{'time':24,'offset':9}],80)
        self.assertEqual(len(result),1)
if __name__=='__main__':unittest.main()
