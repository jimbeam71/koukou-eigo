// 使い方: node tools/coverage.js [上位N=3000]
// tools/wordmap.txt（頻度順の英単語リスト）のうち、まだ tango.json に入っていない語を上から表示する。
// 活用形（-s, -ed, -ing など）は同じ語として数える。固有名詞・ネット用語などの雑音が混じるので、機械的に全部入れず、選んで使う。
const fs = require('fs'), path = require('path');
const N = parseInt(process.argv[2] || '3000', 10);
const words = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public/data/tango.json'), 'utf8')).words;
const have = new Set(words.map(w => w.en.toLowerCase()));
function forms(w) {
  const f = [w, w + 's', w + 'es', w + 'ed', w + 'd', w + 'ing', w + 'er', w + 'ly'];
  if (/e$/.test(w)) f.push(w.slice(0, -1) + 'ing');
  if (/y$/.test(w)) f.push(w.slice(0, -1) + 'ies', w.slice(0, -1) + 'ied');
  if (/([^aeiou])$/.test(w)) f.push(w + w.slice(-1) + 'ed', w + w.slice(-1) + 'ing');
  return f;
}
const covered = new Set();
have.forEach(h => forms(h).forEach(f => covered.add(f)));
const list = fs.readFileSync(path.join(__dirname, 'wordmap.txt'), 'utf8').split('\n').map(s => s.trim()).filter(Boolean).slice(0, N);
const left = list.filter(w => !covered.has(w));
console.log('上位' + list.length + '語のうち、カバー済み ' + (list.length - left.length) + ' 語 / 未カバー ' + left.length + ' 語');
console.log('未カバー（頻度順・先頭200）:\n' + left.slice(0, +(process.argv[3]||200)).join(' '));
