(function () {
  'use strict';
  var E = window.Eigo, KEY = 'eigo_grammar_v1';
  var app = document.getElementById('app'), U = [], st = E.load(KEY, { done: {} }), au = null;
  var esc = E.esc;
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
  function play(f) { try { if (au) au.pause(); au = new Audio(f); au.play().catch(function () {}); } catch (e) {} }
  fetch('data/grammar.json').then(function (r) { return r.json(); }).then(function (d) { U = d.units; route(); });
  window.addEventListener('hashchange', route);
  function route() {
    var m = /^#(g\d+)$/.exec(location.hash), u = m && U.filter(function (x) { return x.id === m[1]; })[0];
    document.getElementById('back').setAttribute('href', u ? 'grammar.html' : 'index.html');
    document.getElementById('back').textContent = u ? '← 文法の一覧' : '← トップ';
    window.scrollTo(0, 0);
    if (u) unit(u); else list();
  }
  function list() {
    var h = '<h1>文法</h1><p class="lead">定期テストで点が取れて、共通テストにもつながる。1項目ずつ、読む → 例文 → 確認問題。</p><div class="menu">';
    U.forEach(function (u, i) {
      var d = st.done[u.id];
      h += '<a class="card" href="#' + u.id + '"><span class="num' + (d ? ' done' : '') + '">' + (d ? '✓' : i + 1) + '</span><span class="body"><b>' + esc(u.title) + '</b><span class="muted small">' +
        esc(u.one) + (d ? '<br>前回：' + d.score + ' / ' + d.total : '') + '</span></span><span class="go">›</span></a>';
    });
    app.innerHTML = h + '</div>';
  }
  function unit(u) {
    var h = '<h1>' + esc(u.title) + '</h1><div class="box point"><b class="t">ひとことで言うと</b>' + rich(u.one) + '</div>', c = 0;
    u.sections.forEach(function (s) {
      h += '<div class="card"><h3 style="margin-top:0">' + esc(s.h) + '</h3><p>' + rich(s.p) + '</p>';
      s.ex.forEach(function (e) {
        c++;
        h += '<div class="box"><div><b>' + esc(e.en) + '</b> <button class="btn sm" data-a="audio/g/' + u.id + '_' + c + '.mp3">▶</button></div><div class="muted small">' + esc(e.ja) + '</div></div>';
      });
      h += '</div>';
    });
    h += '<h3>ひっかけやすいところ</h3>';
    u.traps.forEach(function (t) { h += '<div class="card"><b>' + esc(t.t) + '</b><p>' + rich(t.body) + '</p></div>'; });
    h += '<button class="btn primary block" id="go">確認問題へ（' + u.quiz.length + '問）</button>';
    app.innerHTML = h;
    Array.prototype.forEach.call(app.querySelectorAll('[data-a]'), function (b) { b.onclick = function () { play(b.getAttribute('data-a')); }; });
    document.getElementById('go').onclick = function () { quiz(u); };
    window.scrollTo(0, 0);
  }
  function quiz(u) {
    var i = 0, score = 0, miss = [];
    function show() {
      var q = u.quiz[i];
      var h = '<div class="muted small">' + esc(u.title) + '　' + (i + 1) + ' / ' + u.quiz.length + '　<span class="tag">' + esc(q.k) + '</span></div><div class="card"><div style="font-size:19px;font-weight:700;line-height:1.6">' + esc(q.q) + '</div></div><div class="choices">';
      q.o.forEach(function (o, j) { h += '<button class="choice" data-j="' + j + '">' + esc(o) + '</button>'; });
      app.innerHTML = h + '</div><div id="fb"></div>';
      Array.prototype.forEach.call(app.querySelectorAll('.choice'), function (b) {
        b.onclick = function () {
          var j = +b.getAttribute('data-j'), ok = j === q.a;
          if (ok) score++; else miss.push(i);
          Array.prototype.forEach.call(app.querySelectorAll('.choice'), function (x) {
            x.disabled = true; var k = +x.getAttribute('data-j');
            if (k === q.a) x.classList.add('ok'); else if (k === j) x.classList.add('ng');
          });
          document.getElementById('fb').innerHTML = '<div class="box ' + (ok ? '' : 'point') + '"><b class="t">' + (ok ? '正解！' : '正解は「' + esc(q.o[q.a]) + '」') + '</b>' + rich(q.w) + '</div><button class="btn primary block" id="nx">' + (i + 1 < u.quiz.length ? '次へ' : '結果を見る') + '</button>';
          document.getElementById('nx').onclick = function () { i++; if (i < u.quiz.length) show(); else fin(); };
        };
      });
      window.scrollTo(0, 0);
    }
    function fin() {
      E.markActive();
      var best = st.done[u.id];
      st.done[u.id] = { score: Math.max(score, best ? best.score : 0), total: u.quiz.length };
      E.save(KEY, st);
      var h = '<h1>' + score + ' / ' + u.quiz.length + '</h1><p class="lead">' + (score === u.quiz.length ? '全問正解！' : score >= u.quiz.length * 0.7 ? 'いい感じ。まちがえたところだけ見直そう。' : 'もう一度、解説を読んでからやってみよう。') + '</p>';
      if (miss.length) {
        h += '<h3>まちがえた問題</h3>';
        miss.forEach(function (k) { var q = u.quiz[k]; h += '<div class="card"><b>' + esc(q.q) + '</b><div class="muted small">正解：' + esc(q.o[q.a]) + '</div><p>' + rich(q.w) + '</p></div>'; });
      }
      h += '<button class="btn block" id="re">もう一度</button><p></p><a class="btn primary block" href="grammar.html">一覧へ</a>';
      app.innerHTML = h;
      document.getElementById('re').onclick = function () { quiz(u); };
    }
    show();
  }
})();
