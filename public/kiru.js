/* 切る練習：英文を意味のかたまりで切る（/）、前置詞句を ( ) でくくる */
(function () {
  'use strict';
  var E = window.Eigo, esc = E.esc;
  var KEY = 'eigo_kiru_v1';
  var ROLE = { S: '主語', V: '動詞', O: '目的語', C: '補語', M: '修飾' };
  var GENRES = ['雑学', '裏技', 'お金', '心理', '小話'];
  var LEVEL_NAME = { 1: '主語と動詞を見つける', 2: '前置詞句をくくる', 3: '不定詞・分詞・関係詞' };
  var app = document.getElementById('app');

  var items = [], st = E.load(KEY, { done: {}, days: {} });
  var level = 1, genre = 'all', curId = null;
  var cuts = new Set(), parens = [], pending = null, mode = 'cut', checked = false, result = null, hist = [];

  fetch('data/kiru.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      items = d.items || [];
      if (!st.done) st.done = {};
      if (!st.days) st.days = {};
      pickFirst();
      render();
    })
    .catch(function () { app.innerHTML = E.errorCard('問題データを読み込めませんでした'); });

  function list() {
    return items.filter(function (it) { return it.level === level && (genre === 'all' || it.genre === genre); });
  }
  function cur() {
    for (var i = 0; i < items.length; i++) if (items[i].id === curId) return items[i];
    return null;
  }
  function pickFirst() {
    var l = list();
    var undone = l.filter(function (it) { return !(st.done[it.id] && st.done[it.id].ok); });
    var it = undone[0] || l[0] || null;
    curId = it ? it.id : null;
    resetWork();
  }
  function resetWork() {
    cuts = new Set(); parens = []; pending = null; mode = 'cut'; checked = false; result = null; hist = [];
  }
  function saveSt() { E.save(KEY, st); }
  function tokensOf(it) { return it.en.split(' '); }
  function chunkRanges(it) {
    var from = 0;
    return it.chunks.map(function (c) { var r = { from: from, to: c.to, role: c.role, ja: c.ja }; from = c.to + 1; return r; });
  }
  function optionalCuts(it) {
    var req = {}; it.req.forEach(function (i) { req[i] = true; });
    var opt = [];
    it.chunks.forEach(function (c, k) { if (k < it.chunks.length - 1 && !req[c.to]) opt.push(c.to); });
    return opt;
  }

  // ---------- 画面全体 ----------
  function render() {
    var h = '';
    // レベル切替
    h += '<div class="tabs">';
    [1, 2, 3].forEach(function (lv) {
      var all = items.filter(function (it) { return it.level === lv; });
      var ok = all.filter(function (it) { return st.done[it.id] && st.done[it.id].ok; }).length;
      h += '<button class="tab' + (lv === level ? ' on' : '') + '" data-lv="' + lv + '">L' + lv +
           '<small>' + LEVEL_NAME[lv] + ' (' + ok + '/' + all.length + ')</small></button>';
    });
    h += '</div>';
    // ジャンル
    h += '<div class="chips"><button class="chip' + (genre === 'all' ? ' on' : '') + '" data-g="all">すべて</button>';
    GENRES.forEach(function (g) {
      h += '<button class="chip' + (genre === g ? ' on' : '') + '" data-g="' + g + '">' + g + '</button>';
    });
    h += '</div>';
    // 題の番号
    var l = list();
    h += '<div class="nums">';
    l.forEach(function (it, k) {
      var d = st.done[it.id];
      var mk = d ? (d.ok ? '<span class="mk ok">✔</span>' : '<span class="mk try">△</span>') : '';
      h += '<button class="nbtn' + (it.id === curId ? ' on' : '') + '" data-id="' + it.id + '">' + (k + 1) + mk + '</button>';
    });
    h += '</div>';

    var it = cur();
    if (!it) {
      h += '<div class="card center muted">このジャンルの題は、まだありません。別のジャンルを選んでね。</div>';
    } else {
      h += '<div class="card" id="prob">' + (checked ? resultHtml(it) : workHtml(it)) + '</div>';
    }
    app.innerHTML = h;
    bindTop();
    if (it) { checked ? bindResult(it) : bindWork(it); }
  }

  function bindTop() {
    var q = function (sel, fn) {
      var els = app.querySelectorAll(sel);
      for (var i = 0; i < els.length; i++) els[i].onclick = fn;
    };
    q('.tab', function () { level = parseInt(this.getAttribute('data-lv'), 10); pickFirst(); render(); });
    q('.chip', function () { genre = this.getAttribute('data-g'); pickFirst(); render(); });
    q('.nbtn', function () { curId = this.getAttribute('data-id'); resetWork(); render(); });
  }

  // ---------- 問題を解く画面 ----------
  function workHtml(it) {
    var h = '<div class="row"><span class="hee">今日のへぇ</span><span class="pill">' + esc(it.genre) + '</span></div>';
    if (it.level === 1) {
      h += '<p class="inst">英文を「主語（S）」と「動詞（V）」で切ろう。切りたい場所の<b>手前の単語</b>をタップすると <b>/</b> が入るよ。まちがえたら、同じ単語をもう一度タップで消える。「↩ 1つ戻す」でも戻せるよ。</p>';
    } else {
      if (it.level === 3) {
        h += '<p class="inst">①「前置詞のかたまり」を <b>( )</b> でくくる（はじめの単語→おわりの単語をタップ）。②主語のあと・動詞のあとに <b>/</b> を入れる。③さらに、<b>to＋動詞</b>・<b>〜ing</b>・<b>〜ed</b>・<b>who / that</b>・<b>that節</b> が始まる<b>手前</b>にも <b>/</b> を入れよう。まちがえたら「↩ 1つ戻す」。</p>';
      } else {
        h += '<p class="inst">①「前置詞のかたまり」を <b>( )</b> でくくる（はじめの単語→おわりの単語をタップ）。②主語のあと・動詞のあとに <b>/</b> を入れる。まちがえたら「↩ 1つ戻す」。</p>';
      }
      h += '<div class="modes"><button class="mode' + (mode === 'cut' ? ' on' : '') + '" data-m="cut">／ を入れる</button>' +
           '<button class="mode' + (mode === 'paren' ? ' on' : '') + '" data-m="paren">( ) でくくる</button></div>';
    }
    h += '<div class="sent" id="sent">' + sentHtml(it) + '</div>';
    h += '<div class="row gap-top">' +
         '<button class="btn sm" id="say">🔊 聞く</button>' +
         '<button class="btn sm" id="slow">🐢 ゆっくり</button>' +
         '<span class="spacer"></span>' +
         '<button class="btn sm" id="undo"' + (hist.length ? '' : ' disabled') + '>↩ 1つ戻す</button>' +
         '<button class="btn sm" id="reset">全部消す</button></div>';
    h += '<button class="btn primary block" id="check" style="margin-top:12px">答え合わせ</button>';
    return h;
  }

  function sentHtml(it) {
    var toks = tokensOf(it), h = '';
    toks.forEach(function (w, i) {
      var inP = parens.some(function (p) { return i >= p[0] && i <= p[1]; });
      parens.forEach(function (p) { if (p[0] === i) h += '<span class="pr">(</span>'; });
      if (pending === i) h += '<span class="pr ghost">(</span>';
      h += '<button class="tok' + (inP ? ' inp' : '') + (pending === i ? ' pending' : '') + '" data-i="' + i + '">' + esc(w) + '</button>';
      parens.forEach(function (p) { if (p[1] === i) h += '<span class="pr">)</span>'; });
      if (cuts.has(i)) h += '<span class="sl">/</span>';
    });
    return h;
  }

  function bindWork(it) {
    var toks = tokensOf(it);
    var sent = document.getElementById('sent');
    sent.onclick = function (ev) {
      var b = ev.target.closest ? ev.target.closest('.tok') : null;
      if (!b) return;
      onTok(it, parseInt(b.getAttribute('data-i'), 10), toks.length);
    };
    var modes = app.querySelectorAll('.mode');
    for (var i = 0; i < modes.length; i++) {
      modes[i].onclick = function () { mode = this.getAttribute('data-m'); pending = null; reRenderWork(it); };
    }
    document.getElementById('say').onclick = function () { E.play('audio/k/' + it.id + '.mp3', 1, it.en); };
    document.getElementById('slow').onclick = function () { E.play('audio/k/' + it.id + '.mp3', 0.7, it.en); };
    document.getElementById('undo').onclick = function () {
      if (!hist.length) return;
      var h0 = hist.pop();
      cuts = new Set(h0.cuts); parens = h0.parens; pending = h0.pending;
      reRenderWork(it);
    };
    document.getElementById('reset').onclick = function () { resetWork(); render(); };
    document.getElementById('check').onclick = function () { doCheck(it); };
  }

  function reRenderWork(it) {
    document.getElementById('prob').innerHTML = workHtml(it);
    bindWork(it);
  }

  function pushHist() {
    hist.push({ cuts: Array.from(cuts), parens: parens.map(function (p) { return p.slice(); }), pending: pending });
  }
  function refreshUndo() {
    var u = document.getElementById('undo');
    if (u) u.disabled = hist.length === 0;
  }

  function onTok(it, i, n) {
    if (mode === 'cut') {
      if (i === n - 1) { E.toast('文の最後には / は入れないよ'); return; }
      pushHist();
      if (cuts.has(i)) cuts.delete(i); else cuts.add(i);
    } else {
      if (pending === null) {
        var idx = -1;
        parens.forEach(function (p, k) { if (i >= p[0] && i <= p[1]) idx = k; });
        pushHist();
        if (idx >= 0) parens.splice(idx, 1); else pending = i;
      } else if (i === pending) {
        pushHist();
        pending = null;
      } else {
        var s = Math.min(pending, i), e = Math.max(pending, i);
        var overlap = parens.some(function (p) { return !(e < p[0] || s > p[1]); });
        if (overlap) { E.toast('( ) が重なっているよ。もう一度やってみて'); return; }
        pushHist();
        parens.push([s, e]); parens.sort(function (a, b) { return a[0] - b[0]; });
        pending = null;
      }
    }
    document.getElementById('sent').innerHTML = sentHtml(it);
    refreshUndo();
  }

  // ---------- 答え合わせ ----------
  function pk(p) { return p[0] + '-' + p[1]; }

  function doCheck(it) {
    var req = {}, opt = {};
    it.req.forEach(function (i) { req[i] = true; });
    optionalCuts(it).forEach(function (i) { opt[i] = true; });
    var missing = it.req.filter(function (i) { return !cuts.has(i); });
    var extra = Array.from(cuts).filter(function (i) { return !req[i] && !opt[i]; }).sort(function (a, b) { return a - b; });
    var correctP = {}, userP = {};
    it.parens.forEach(function (p) { correctP[pk(p)] = true; });
    parens.forEach(function (p) { userP[pk(p)] = true; });
    var pMissing = it.parens.filter(function (p) { return !userP[pk(p)]; });
    var pExtra = parens.filter(function (p) { return !correctP[pk(p)]; });
    var perfect = !missing.length && !extra.length && !pMissing.length && !pExtra.length;
    result = { missing: missing, extra: extra, pMissing: pMissing, pExtra: pExtra, perfect: perfect, req: req, opt: opt, userP: userP };

    var prev = st.done[it.id] || { ok: false, tries: 0 };
    st.done[it.id] = { ok: prev.ok || perfect, tries: (prev.tries || 0) + 1 };
    if (perfect) {
      var t = String(E.dayNum());
      var arr = st.days[t] || [];
      if (arr.indexOf(it.id) < 0) arr.push(it.id);
      st.days[t] = arr;
    }
    saveSt();
    E.markActive();
    checked = true;
    render();
    window.scrollTo(0, 0);
  }

  function roleOf(it, tokIndex) {
    var from = 0, r = '';
    it.chunks.forEach(function (c) { if (tokIndex >= from && tokIndex <= c.to) r = c.role; from = c.to + 1; });
    return r;
  }

  function resultSentence(it) {
    var toks = tokensOf(it), ranges = chunkRanges(it), h = '';
    var rs = result;
    ranges.forEach(function (rg, k) {
      var say = toks.slice(rg.from, rg.to + 1).join(' ');
      h += '<span class="chunk r-' + rg.role + '" data-audio="audio/k/' + it.id + '_' + k + '.mp3" data-say="' + esc(say) + '"><span class="lab">' + rg.role + '</span>';
      for (var i = rg.from; i <= rg.to; i++) {
        // 正解の ( の開き
        it.parens.forEach(function (p) {
          if (p[0] === i) h += '<span class="pr ' + (rs.userP[pk(p)] ? 'okp' : 'missp') + '">(</span>';
        });
        rs.pExtra.forEach(function (p) { if (p[0] === i) h += '<span class="pr badp">(</span>'; });
        h += esc(toks[i]);
        it.parens.forEach(function (p) {
          if (p[1] === i) h += '<span class="pr ' + (rs.userP[pk(p)] ? 'okp' : 'missp') + '">)</span>';
        });
        rs.pExtra.forEach(function (p) { if (p[1] === i) h += '<span class="pr badp">)</span>'; });
        if (i < rg.to) {
          // かたまりの途中：自分が入れた余計な / を赤で
          if (cuts.has(i) && !rs.req[i] && !rs.opt[i]) h += '<span class="rs bad">/</span>';
          else h += ' ';
        }
      }
      h += '</span>';
      // かたまりの境目
      if (k < ranges.length - 1) {
        var b = rg.to;
        if (rs.req[b]) h += cuts.has(b) ? '<span class="rs">/</span>' : '<span class="rs miss">/</span>';
        else if (cuts.has(b)) h += '<span class="rs opt">/</span>';
        else h += ' ';
      }
    });
    return h;
  }

  function skeleton(it) {
    var toks = tokensOf(it), out = [], inP = -1;
    toks.forEach(function (w, i) {
      var k = -1;
      it.parens.forEach(function (p, idx) { if (i >= p[0] && i <= p[1]) k = idx; });
      if (k >= 0) { if (inP !== k) { out.push('<span class="muted">( … )</span>'); inP = k; } }
      else { out.push(esc(w)); inP = -1; }
    });
    return out.join(' ');
  }

  function resultHtml(it) {
    var toks = tokensOf(it), rs = result;
    var h = '<div class="row"><span class="hee">今日のへぇ</span><span class="pill">' + esc(it.genre) + '</span></div>';
    h += '<h2 style="margin-top:10px">' + esc(it.title) + '</h2>';
    h += '<div class="banner ' + (rs.perfect ? 'ok' : 'ng') + '">' +
         (rs.perfect ? '🎉 完璧！ ちゃんと切れてるよ' : 'おしい！ 正解と見くらべてみよう') + '</div>';

    h += '<div class="sent">' + resultSentence(it) + '</div>';
    h += '<div class="legend">' +
         '<span><i style="background:var(--ok)"></i>合ってる</span>' +
         '<span><i style="background:var(--warn)"></i>ここにも必要</span>' +
         '<span><i style="background:var(--ng)"></i>いらない</span>' +
         '<span>色の下線＝ S主語 / V動詞 / O目的語 / C補語 / M修飾</span></div>';
    h += '<p class="small muted">かたまりをタップすると、そこだけ読み上げるよ。</p>';

    if (!rs.perfect) {
      h += '<ul class="fixes">';
      rs.missing.forEach(function (i) {
        h += '<li>「' + esc(toks[i]) + '」のあとに <b>/</b> が必要（' + ROLE[roleOf(it, i)] + 'のおわり）</li>';
      });
      rs.extra.forEach(function (i) { h += '<li>「' + esc(toks[i]) + '」のあとの <b>/</b> は、いらないよ</li>'; });
      rs.pMissing.forEach(function (p) {
        h += '<li><b>( )</b> でくくる前置詞のかたまり：「' + esc(toks.slice(p[0], p[1] + 1).join(' ')) + '」</li>';
      });
      rs.pExtra.forEach(function (p) {
        h += '<li>「' + esc(toks.slice(p[0], p[1] + 1).join(' ')) + '」は ( ) にしなくていいよ</li>';
      });
      h += '</ul>';
    }

    if (it.level >= 2 && it.parens.length) {
      h += '<div class="box"><b class="t">骨組み（( ) の中をはずすと…）</b>' + skeleton(it) + '</div>';
    }
    if (it.point) {
      h += '<div class="box point"><b class="t">✂ 切るポイント</b>' + esc(it.point) + '</div>';
    }
    h += '<div class="box"><b class="t">直読直解（前から順に）</b>' +
         it.chunks.map(function (c) { return esc(c.ja); }).join(' ／ ') +
         '<div class="muted" style="margin-top:4px">全体の訳：' + esc(it.jaFull) + '</div></div>';
    h += '<div class="summary">💡 一言まとめ：' + esc(it.summary) + '</div>';
    if (it.notes && it.notes.length) {
      h += '<p class="notes">語注：' + it.notes.map(function (n) { return '<b>' + esc(n[0]) + '</b> ' + esc(n[1]); }).join('　') + '</p>';
    }
    h += '<div class="row">' +
         '<button class="btn sm" id="say">🔊 全文を聞く</button>' +
         '<button class="btn sm" id="slow">🐢 ゆっくり</button></div>';
    h += '<div class="row gap-top">' +
         (rs.perfect ? '' : '<button class="btn" id="retry">もう一度やる</button>') +
         '<span class="spacer"></span>' +
         '<button class="btn primary" id="nextq">次の題へ ›</button></div>';
    return h;
  }

  function bindResult(it) {
    var chunks = app.querySelectorAll('.chunk');
    for (var i = 0; i < chunks.length; i++) {
      chunks[i].onclick = function () { E.play(this.getAttribute('data-audio'), 1, this.getAttribute('data-say')); };
    }
    document.getElementById('say').onclick = function () { E.play('audio/k/' + it.id + '.mp3', 1, it.en); };
    document.getElementById('slow').onclick = function () { E.play('audio/k/' + it.id + '.mp3', 0.7, it.en); };
    var retry = document.getElementById('retry');
    if (retry) retry.onclick = function () { resetWork(); render(); };
    document.getElementById('nextq').onclick = function () {
      var l = list(), idx = -1;
      l.forEach(function (x, k) { if (x.id === it.id) idx = k; });
      if (idx < l.length - 1) { curId = l[idx + 1].id; resetWork(); render(); window.scrollTo(0, 0); }
      else { showEnd(); }
    };
  }

  function showEnd() {
    var h = '<div class="card center"><h2>🎉 この条件の題は、ここまで！</h2>';
    h += '<p class="muted">新しい題はこれから増やしていくよ。ほかのレベルやジャンルも試してみてね。</p>';
    h += '<div class="row" style="justify-content:center"><button class="btn" id="again">最初の題へ</button><a class="btn primary" href="index.html">トップへ</a></div></div>';
    app.innerHTML = h;
    document.getElementById('again').onclick = function () { pickFirst(); render(); window.scrollTo(0, 0); };
    window.scrollTo(0, 0);
  }
})();
