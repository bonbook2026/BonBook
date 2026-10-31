import unittest
from page_words import map_words,text_tokens

def row(values,y=.2):
    return {'words':[{'text':text,'x':.85-index*.12,'y':y,'width':.1,'height':.025,'confidence':95} for index,text in enumerate(values)]}
def speech(values):return [{'text':text,'start':i,'end':i+.7,'probability':.99} for i,text in enumerate(values)]

class PageWordTests(unittest.TestCase):
    def test_exact_repeated_words_keep_separate_boxes_and_real_intervals(self):
        result=map_words('کتاب خوب، کتاب روشن.',[row(['کتاب','خوب','کتاب','روشن'])],speech(['کتاب','خوب','کتاب','روشن']))
        self.assertEqual(result['timedWordCount'],4)
        self.assertEqual([word['time'] for word in result['words']],[0,1,2,3])
        self.assertNotEqual(result['words'][0]['rects'],result['words'][2]['rects'])
        self.assertEqual(result['words'][2]['endTime'],2.7)
    def test_persian_forms_half_spaces_and_utf16_offsets_keep_printed_boxes(self):
        text='📖 كِتاب را می‌خوانم.'
        result=map_words(text,[row(['کتاب','را','می','خوانم'])],speech(['كتاب','را','می','خوانم']))
        self.assertEqual(result['timedWordCount'],3)
        self.assertEqual(result['words'][0]['start'],3)
        self.assertEqual(result['words'][2]['time'],2)
        self.assertEqual(result['words'][2]['endTime'],3.7)
        self.assertEqual(len(result['words'][2]['rects']),1)
    def test_split_asr_compound_uses_first_real_part_without_interpolating(self):
        result=map_words('یادداشت ضروری',[row(['یادداشت','ضروری'])],speech(['یاد','داشت','ضروری']))
        self.assertEqual(result['words'][0]['time'],0)
        self.assertEqual(result['words'][0]['endTime'],1.7)
    def test_phrase_timestamp_cannot_pretend_to_be_individual_word_times(self):
        result=map_words('کتاب خوب',[row(['کتاب','خوب'])],[{'text':'کتاب خوب','start':3,'end':6,'probability':1}])
        self.assertEqual(len(result['words']),2)
        self.assertEqual(result['timedWordCount'],0)
    def test_unrelated_or_uncertain_audio_does_not_get_a_word_time(self):
        words=speech(['کتاب','خوب']);words[1]['probability']=.1
        result=map_words('کتاب خوب',[row(['کتاب','خوب'])],words)
        self.assertEqual(result['timedWordCount'],1)
        self.assertNotIn('time',result['words'][1])
        self.assertEqual(map_words('کتاب خوب',[row(['کتاب','خوب'])],speech(['هوا','ابری']))['timedWordCount'],0)
    def test_no_uniform_subdivision_of_phrase_boxes_and_no_fake_zero_length_time(self):
        result=map_words('کتاب خوب',[row(['کتاب خوب'])],speech(['کتاب','خوب']))
        self.assertEqual(result['words'],[])
        words=speech(['کتاب']);words[0]['end']=0
        self.assertEqual(map_words('کتاب',[row(['کتاب'])],words)['timedWordCount'],0)
    def test_low_quality_or_invalid_printed_boxes_are_not_click_targets(self):
        raw=row(['کتاب','خوب']);raw['words'][0]['confidence']=20;raw['words'][1]['x']=-.1
        self.assertEqual(map_words('کتاب خوب',[raw],speech(['کتاب','خوب']))['words'],[])
    def test_prefix_is_not_joined_to_an_unrelated_paragraph(self):
        self.assertEqual(len(text_tokens('می\nکتاب خوب')),3)
    def test_one_shared_word_in_unrelated_audio_and_missing_duplicate_are_not_precise(self):
        self.assertEqual(map_words('کتاب خوب را آرام بخوانیم',[row(['کتاب','خوب','را','آرام','بخوانیم'])],speech(['هوا','کتاب','گزارش']))['timedWordCount'],0)
        result=map_words('کتاب کتاب خوب را آرام بخوانیم',[row(['کتاب','کتاب','خوب','را','آرام','بخوانیم'])],speech(['کتاب','خوب','را','آرام','بخوانیم']))
        self.assertNotIn('time',result['words'][0]);self.assertNotIn('time',result['words'][1])
    def test_a_known_word_keeps_its_real_time_when_neighbors_have_ambiguous_asr_boundaries(self):
        result=map_words('خورشیدی واحد جهان',[row(['خورشیدی','واحد','جهان'])],speech(['خورشی','دیواحد','جهان']))
        self.assertNotIn('time',result['words'][0]);self.assertNotIn('time',result['words'][1]);self.assertEqual(result['words'][2]['time'],2)
if __name__=='__main__':unittest.main()
