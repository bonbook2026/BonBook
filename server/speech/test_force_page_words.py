import unittest
from force_page_words import windows
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
if __name__=='__main__':unittest.main()
