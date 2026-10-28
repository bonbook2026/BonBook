import unittest
from alignment import align,tokens
class AlignmentTests(unittest.TestCase):
 def test_persian_forms_and_exact_times(self):
  text='من کتاب را می‌خوانم. متن دوم روشن است.'
  lines=[{'start':0,'end':20},{'start':21,'end':len(text)}]
  words=[{'text':word,'start':index,'end':index+.8,'probability':.99} for index,word in enumerate(['من','كتاب','را','می','خوانم','متن','دوم','روشن','است'])]
  result=align(text,words,lines)
  self.assertEqual(result['coverage'],1);self.assertEqual(result['lineCoverage'],1);self.assertTrue(result['safe']);self.assertEqual(result['cues'][1]['time'],5)
 def test_unrelated_audio_is_never_applied(self):
  result=align('این کتاب درباره زندگی است.',[{'text':'weather forecast tomorrow','start':0,'end':2,'probability':.99}],[{'start':0,'end':25}])
  self.assertFalse(result['safe']);self.assertEqual(result['cues'],[])
 def test_asr_word_spacing_is_aligned_without_rewriting_text(self):
  text='یادداشت ضروری. این متن کتاب است.'
  words=[{'text':word,'start':i,'end':i+.8,'probability':.99} for i,word in enumerate(['یاد','داشت','ضروری','این','متن','کتاب','است'])]
  result=align(text,words,[{'start':0,'end':14},{'start':15,'end':len(text)}]);self.assertEqual(result['coverage'],1);self.assertTrue(result['safe']);self.assertEqual(result['cues'][1]['time'],3)
 def test_offsets_use_browser_utf16_and_ignore_low_confidence(self):
  self.assertEqual(tokens('📖 کتاب')[0]['offset'],3)
  result=align('کتاب',[{'text':'کتاب','start':0,'end':1,'probability':.1}],[{'start':0,'end':4}]);self.assertFalse(result['safe'])
if __name__=='__main__':unittest.main()
