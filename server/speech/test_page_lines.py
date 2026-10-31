import unittest
from page_lines import map_lines

def row(text,y):return {'text':text,'x':.1,'y':y,'width':.8,'height':.03}
class PageLineTests(unittest.TestCase):
    def test_maps_real_rows_to_original_utf16_offsets_and_keeps_typography(self):
        text='🌙 مقدمه:\nجهان یکی است، اما انسان‌ها متفاوت‌اند.\nکتاب را آرام بخوانیم.'
        result=map_lines(text,[row('جهان يكي است اما انسان ها متفاوت اند',.2),row('کتاب را آرام بخوانیم',.3)])
        self.assertEqual(len(result['lines']),2)
        self.assertEqual(result['lines'][0]['start'],len(text[:text.index('جهان')].encode('utf-16-le'))//2)
        self.assertEqual(result['lines'][1]['y'],.3)
    def test_never_guesses_coordinates_for_unrelated_or_missing_rows(self):
        result=map_lines('کتاب دربارهٔ آرامش و زندگی است.',[row('قیمت دلار و گزارش بازار امروز',.1),row('۱۲',.9)])
        self.assertEqual(result['lines'],[])
    def test_repeated_lines_keep_monotonic_order(self):
        text='با آرامش بخوانیم.\nدر این مسیر قدم بزنیم.\nبا آرامش بخوانیم.'
        result=map_lines(text,[row('با آرامش بخوانیم',.1),row('در این مسیر قدم بزنیم',.2),row('با آرامش بخوانیم',.3)])
        self.assertEqual(len(result['lines']),3)
        self.assertLess(result['lines'][0]['end'],result['lines'][2]['start'])
    def test_uses_real_speech_word_times_for_physical_lines(self):
        text='کتاب را بخوانیم.\nجهان را بشناسیم.'
        words=[{'text':v,'start':t,'probability':1} for v,t in [('کتاب',1),('را',2),('بخوانیم',3),('جهان',5),('را',6),('بشناسیم',7)]]
        result=map_lines(text,[row('کتاب را بخوانیم',.1),row('جهان را بشناسیم',.2)],words)
        self.assertEqual([line['time'] for line in result['lines']],[1,5])
if __name__=='__main__':unittest.main()
