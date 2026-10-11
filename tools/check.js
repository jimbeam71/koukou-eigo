// 使い方: node tools/check.js
// 単語・切る練習データの検査。ダブり／必須項目／音声ファイルの有無／切る練習のかたまり位置を調べる。
const fs = require('fs'), path = require('path');
const base = path.join(__dirname, '..', 'public') + path.sep;
const tango = JSON.parse(fs.readFileSync(base + 'data/tango.json', 'utf8'));
const kiru = JSON.parse(fs.readFileSync(base + 'data/kiru.json', 'utf8'));
const errs = [];
const ids = new Set(), ens = new Set(), jas = new Set();
tango.words.forEach(w => {
  if (ids.has(w.id)) errs.push('id重複 ' + w.id); ids.add(w.id);
  const e = w.en.toLowerCase();
  if (ens.has(e)) errs.push('英語がダブり ' + w.en); ens.add(e);
  if (jas.has(w.ja)) errs.push('意味(ja)がダブり ' + w.ja + '（4択で同じ答えが並ぶため不可）'); jas.add(w.ja);
  ['en', 'ja', 'pos', 'level', 'ex', 'exJa', 'tip'].forEach(k => { if (!w[k]) errs.push(w.id + ' ' + k + ' が空'); });
  if (![1, 2, 3].includes(w.level)) errs.push(w.id + ' levelが不正');
  ['', 'x'].forEach(s => { if (!fs.existsSync(base + 'audio/w/' + w.id + s + '.mp3')) errs.push('音声なし audio/w/' + w.id + s + '.mp3'); });
  if (!new RegExp('\\b' + w.en, 'i').test(w.ex)) console.log('メモ: 例文に語形が見当たらない', w.en, '->', w.ex);
});
const grpCount = {};
tango.words.forEach(w => { if (w.grp) grpCount[w.grp] = (grpCount[w.grp] || 0) + 1; });
Object.keys(grpCount).forEach(g => { if (grpCount[g] < 2) errs.push('grp "' + g + '" が1語だけ（意味がない）'); });
console.log('単語', tango.words.length, '語  level別', [1, 2, 3].map(l => tango.words.filter(w => w.level === l).length));
const kids = new Set();
kiru.items.forEach(it => {
  if (kids.has(it.id)) errs.push('id重複 ' + it.id); kids.add(it.id);
  const toks = it.en.split(' '), n = toks.length;
  let prev = -1;
  it.chunks.forEach(c => { if (c.to <= prev) errs.push(it.id + ' chunkの順番'); prev = c.to; });
  if (it.chunks[it.chunks.length - 1].to !== n - 1) errs.push(it.id + ' 最後のchunkが文末でない');
  const ends = new Set(it.chunks.slice(0, -1).map(c => c.to));
  it.req.forEach(r => { if (!ends.has(r)) errs.push(it.id + ' req ' + r + ' がchunkの終わりでない'); });
  let from = 0; const ranges = it.chunks.map(c => { const r = [from, c.to]; from = c.to + 1; return r; });
  it.parens.forEach(p => { if (!ranges.some(r => p[0] >= r[0] && p[1] <= r[1])) errs.push(it.id + ' parenがchunkをまたぐ'); if (p[1] >= n) errs.push(it.id + ' paren範囲外'); });
  if (it.level === 1 && it.parens.length) errs.push(it.id + ' L1にparen');
  if (it.level === 2 && !it.parens.length) errs.push(it.id + ' L2にparenなし');
  [''].concat(it.chunks.map((c, i) => '_' + i)).forEach(s => { if (!fs.existsSync(base + 'audio/k/' + it.id + s + '.mp3')) errs.push('音声なし audio/k/' + it.id + s + '.mp3'); });
});
console.log('切る練習', kiru.items.length, '題  level別', [1, 2].map(l => kiru.items.filter(i => i.level === l).length));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'ALL OK');
process.exit(errs.length ? 1 : 0);
