(function () {
  'use strict';
  var E = window.Eigo, KEY = 'eigo_kaiwa_v1';
  var app = document.getElementById('app'), S = [], st = E.load(KEY, { done: {} }), au = null;
  var esc = E.esc;
  function play(f) { try { if (au) au.pause(); au = new Audio(f); au.play().catch(function () {}); } catch (e) {} }
  function rich(s) { return esc(s).replace(/\n/g, '<br>'); }
  fetch('data/kaiwa.json').then(function (r) { return r.json(); }).then(function (d) { S = d.scenes; route(); });
  window.addEventListener('hashchange', route);
  function route() {
    var m = /^#(k\d+)$/.exec(location.hash), s = m && S.filter(function (x) { return x.id === m[1]; })[0];
    document.getElementById('back').setAttribute('href', s ? 'kaiwa.html' : 'index.html');
    document.getElementById('back').textContent = s ? '← 場面の一覧' : '← トップ';
    window.scrollTo(0, 0);
    if (s) scene(s); else list();
  }
  function list() {
    var h = '<h1>会話表現</h1><p class="lead">共通テストの会話文で必ず出る表現を、場面ごとに。表現 → 会話 → 重要単語 → 練習問題。</p><div class="menu">';
    S.forEach(function (s, i) {
      var d = st.done[s.id];
      h += '<a class="card" href="#' + s.id + '"><span class="num' + (d ? ' done' : '') + '">' + (d ? '✓' : i + 1) + '</span><span class="body"><b>' + esc(s.title) + '</b><span class="muted small">' +
        esc(s.intro) + (d ? '<br>前回：' + d.score + ' / ' + d.total : '') + '</span></span><span class="go">›</span></a>';
    });
    app.innerHTML = h + '</div>';
  }
  function scene(s) {
    var h = '<h1>' + esc(s.title) + '</h1><p class="lead">' + esc(s.intro) + '</p><h3>使える表現</h3>';
    s.expr.forEach(function (e, i) {
      h += '<div class="card"><b style="font-size:18px">' + esc(e.en) + '</b> <button class="btn sm" data-a="audio/kw/' + s.id + '_e' + (i + 1) + '.mp3">▶</button><div>' + esc(e.ja) + '</div>' + (e.note ? '<div class="muted small">💡 ' + esc(e.note) + '</div>' : '') + '</div>';
    });
    h += '<h3>会話の例</h3><div class="card">';
    s.model.forEach(function (l, i) {
      h += '<div style="margin:8px 0"><b>' + esc(l.sp) + '：</b>' + esc(l.en) + ' <button class="btn sm" data-a="audio/kw/' + s.id + '_m' + (i + 1) + '.mp3">▶</button><div class="muted small">' + esc(l.ja) + '</div></div>';
    });
    h += '</div><h3>この場面の重要単語</h3><div class="card">';
    s.words.forEach(function (w) { h += '<div style="margin:4px 0"><b>' + esc(w.en) + '</b>　' + esc(w.ja) + '</div>'; });
    h += '</div><button class="btn primary block" id="go">練習問題へ（' + s.qs.length + '問）</button>';
    app.innerHTML = h;
    Array.prototype.forEach.call(app.querySelectorAll('[data-a]'), function (b) { b.onclick = function () { play(b.getAttribute('data-a')); }; });
    document.getElementById('go').onclick = function () { quiz(s); };
    window.scrollTo(0, 0);
  }
  function quiz(s) {
    var Q = s.qs, i = 0, score = 0, miss = [];
    function show() {
      var q = Q[i];
      var h = '<div class="muted small">' + esc(s.title) + '　' + (i + 1) + ' / ' + Q.length + '　<span class="tag">' + esc(q.k === 'w' ? '単語' : '表現') + '</span></div><div class="card"><div style="font-size:18px;line-height:1.9">' + rich(q.q) + '</div></div><div class="choices">';
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
          document.getElementById('fb').innerHTML = '<div class="box ' + (ok ? '' : 'point') + '"><b class="t">' + (ok ? '正解！' : '正解は「' + esc(q.o[q.a]) + '」') + '</b>' + rich(q.w) + '</div><button class="btn primary block" id="nx">' + (i + 1 < Q.length ? '次へ' : '結果を見る') + '</button>';
          document.getElementById('nx').onclick = function () { i++; if (i < Q.length) show(); else fin(); };
        };
      });
      window.scrollTo(0, 0);
    }
    function fin() {
      E.markActive();
      var best = st.done[s.id];
      st.done[s.id] = { score: Math.max(score, best ? best.score : 0), total: Q.length };
      E.save(KEY, st);
      var h = '<h1>' + score + ' / ' + Q.length + '</h1><p class="lead">' + (score === Q.length ? '全問正解！' : score >= Q.length * 0.7 ? 'いい感じ。まちがえたところだけ見直そう。' : 'もう一度、表現を読んでからやってみよう。') + '</p>';
      if (miss.length) {
        h += '<h3>まちがえた問題</h3>';
        miss.forEach(function (k) { var q = Q[k]; h += '<div class="card"><div>' + rich(q.q) + '</div><div class="muted small">正解：' + esc(q.o[q.a]) + '</div><p>' + rich(q.w) + '</p></div>'; });
      }
      h += '<button class="btn block" id="re">もう一度</button><p></p><a class="btn block" href="#' + s.id + '" id="rd">表現にもどる</a><p></p><a class="btn block" href="kaiwa.html">一覧へ</a>';
      app.innerHTML = h;
      document.getElementById('re').onclick = function () { quiz(s); };
      document.getElementById('rd').onclick = function (e) { e.preventDefault(); scene(s); };
    }
    show();
  }
})();
