export function normalizePersian(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/\u200c/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
const stop = new Set('از به در با برای و یا که را رو این آن یه یک من می خواهم میخوام لطفا لطفاً پیدا کن کنید کجاست درباره مورد موضوع کتاب صفحه صفحات نشان بده بیار بخوان بخون چه چطور چگونه هست است متن مطالب'.split(' '));
export function queryTerms(query: string) {
  return [...new Set(normalizePersian(query).split(' ').filter((word) => word.length > 1 && !stop.has(word)))].slice(0, 18);
}
export function rankPages<T extends { content: string; heading: string; keywords: string }>(query: string, pages: T[]) {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  return pages.map((page) => {
    const body = normalizePersian(page.content);
    const heading = normalizePersian(page.heading + ' ' + page.keywords);
    const matched = terms.filter((term) => body.includes(term) || heading.includes(term));
    const score = matched.reduce((sum, term) => sum + (heading.includes(term) ? 5 : 0) + Math.min(body.split(term).length - 1, 4), 0)
      + (body.includes(terms.join(' ')) ? 8 : 0) + matched.length / terms.length * 5;
    const first = Math.max(0, terms.reduce((found, term) => { const index = body.indexOf(term); return index >= 0 ? Math.min(found, index) : found; }, body.length) - 75);
    return { ...page, score: matched.length ? score : 0, excerpt: page.content.slice(Math.min(first, Math.max(0, page.content.length - 220)), first + 240), matchedTerms: matched };
  }).filter((page) => page.score > 0).sort((a, b) => b.score - a.score).slice(0, 12);
}
