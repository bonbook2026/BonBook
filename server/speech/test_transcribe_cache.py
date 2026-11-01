import unittest,sys
from unittest.mock import patch
from transcribe import transcribe_request,valid_recognition

class RecognitionReuseTests(unittest.TestCase):
 def setUp(self):
  self.saved={'duration':10,'words':[{'text':'کتاب','start':2.5,'end':3,'probability':.99},{'text':'زندگی','start':4,'end':5,'probability':.99}]}
 def test_rematches_changed_text_without_loading_asr_or_reading_audio(self):
  with patch.dict(sys.modules,{'faster_whisper':None,'av':None}):
   result=transcribe_request({'recognized':self.saved,'language':'fa','text':'📖 کتاب زندگی','lines':[{'start':3,'end':13}]})
  self.assertEqual(result['words'],self.saved['words']);self.assertEqual(result['cues'],[{'offset':3,'time':2.5}]);self.assertEqual(result['duration'],10)
 def test_rejects_corrupt_or_impossible_saved_recognition(self):
  self.assertTrue(valid_recognition(self.saved))
  for value in (None,{},dict(self.saved,duration=float('nan')),dict(self.saved,words=[]),dict(self.saved,words=[{'text':'x','start':5,'end':2}]),dict(self.saved,words=[{'text':'x','start':0,'end':20}])):
   self.assertFalse(valid_recognition(value))
if __name__=='__main__':unittest.main()
