(function () {
  'use strict';
  var E = window.Eigo, KEY = 'eigo_grammar_v1';
  var app = document.getElementById('app'), U = [], st = E.load(KEY, { done: {} }), au = null;
  var esc = E.esc;
  function prog(d) { var o = []; if (d.drill) o.push('基礎 ' + d.drill.score + '/' + d.drill.total); if (d.test) o.push('共通テスト ' + d.test.score + '/' + d.test.total); return o.join('　'); }
  function norm(x) { return String(x).toLowerCase().replace(/[.,!?]/g, '').replace(/\s+/g, ' ').trim(); }
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
      var d = st.done[u.id], dn = d && d.drill && d.test;
      h += '<a class="card" href="#' + u.id + '"><span class="num' + (d ? ' done' : '') + '">' + (d ? '✓' : i + 1) + '</span><span class="body"><b>' + esc(u.title) + '</b><span class="muted small">' +
        esc(u.one) + (d ? '<br>' + prog(d) : '') + '</span></span><span class="go">›</span></a>';
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
    h += '<h3>アウトプット練習</h3><button class="btn primary block" id="go1">① 基礎トレ（定期テスト）' + u.drill.length + '問：解説の内容を、4択で答える</button><p></p><button class="btn block" id="go2">② 共通テスト標準 ' + u.test.length + '問</button>';
    app.innerHTML = h;
    Array.prototype.forEach.call(app.querySelectorAll('[data-a]'), function (b) { b.onclick = function () { play(b.getAttribute('data-a')); }; });
    document.getElementById('go1').onclick = function () { quiz(u, 'drill'); };
    document.getElementById('go2').onclick = function () { quiz(u, 'test'); };
    window.scrollTo(0, 0);
  }
  function quiz(u, mode) {
    var Q = u[mode], label = mode === 'drill' ? '基礎トレ' : '共通テスト標準', i = 0, score = 0, miss = [];
    function ans(q) { return q.f ? q.f[0] : q.o[q.a]; }
    function judge(ok, q) {
      if (ok) score++; else miss.push(i);
      document.getElementById('fb').innerHTML = '<div class="box ' + (ok ? '' : 'point') + '"><b class="t">' + (ok ? '正解！' : '正解は「' + esc(ans(q)) + '」') + '</b>' + rich(q.w) + '</div><button class="btn primary block" id="nx">' + (i + 1 < Q.length ? '次へ' : '結果を見る') + '</button>';
      document.getElementById('nx').onclick = function () { i++; if (i < Q.length) show(); else fin(); };
    }
    function show() {
      var q = Q[i];
      var h = '<div class="muted small">' + esc(u.title) + '　' + label + '　' + (i + 1) + ' / ' + Q.length + '</div><div class="card"><div style="font-size:19px;font-weight:700;line-height:1.7">' + rich(q.q) + '</div></div>';
      if (q.f) {
        h += '<input id="inp" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:100%;font:inherit;font-size:20px;padding:12px;border:2px solid var(--line);border-radius:14px;background:var(--card);color:var(--ink);box-sizing:border-box" placeholder="英語で入力"><p></p><button class="btn primary block" id="chk">答え合わせ</button>';
      } else {
        h += '<div class="choices">';
        q.o.forEach(function (o, j) { h += '<button class="choice" data-j="' + j + '">' + esc(o) + '</button>'; });
        h += '</div>';
      }
      app.innerHTML = h + '<div id="fb"></div>';
      if (q.f) {
        var inp = document.getElementById('inp'), done = false;
        function go() {
          if (done) return; done = true; inp.disabled = true;
          var v = norm(inp.value), ok = q.f.some(function (a) { return norm(a) === v; });
          inp.style.borderColor = ok ? 'var(--ok)' : 'var(--ng)';
          document.getElementById('chk').remove(); judge(ok, q);
        }
        document.getElementById('chk').onclick = go;
        inp.onkeydown = function (e) { if (e.key === 'Enter') go(); };
      } else {
        Array.prototype.forEach.call(app.querySelectorAll('.choice'), function (b) {
          b.onclick = function () {
            var j = +b.getAttribute('data-j');
            Array.prototype.forEach.call(app.querySelectorAll('.choice'), function (x) {
              x.disabled = true; var k = +x.getAttribute('data-j');
              if (k === q.a) x.classList.add('ok'); else if (k === j) x.classList.add('ng');
            });
            judge(j === q.a, q);
          };
        });
      }
      window.scrollTo(0, 0);
    }
    function fin() {
      E.markActive();
      var d = st.done[u.id] || {}, best = d[mode];
      d[mode] = { score: Math.max(score, best ? best.score : 0), total: Q.length };
      st.done[u.id] = d; E.save(KEY, st);
      var h = '<h1>' + score + ' / ' + Q.length + '</h1><p class="lead">' + (score === Q.length ? '全問正解！' : score >= Q.length * 0.7 ? 'いい感じ。まちがえたところだけ見直そう。' : 'もう一度、解説を読んでからやってみよう。') + '</p>';
      if (miss.length) {
        h += '<h3>まちがえた問題</h3>';
        miss.forEach(function (k) { var q = Q[k]; h += '<div class="card"><b>' + rich(q.q) + '</b><div class="muted small">正解：' + esc(ans(q)) + '</div><p>' + rich(q.w) + '</p></div>'; });
      }
      h += '<button class="btn block" id="re">もう一度</button><p></p>' + (mode === 'drill' ? '<button class="btn primary block" id="nxt">② 共通テスト標準へ</button><p></p>' : '') + '<a class="btn block" href="#' + u.id + '" id="rd">解説にもどる</a><p></p><a class="btn block" href="grammar.html">一覧へ</a>';
      app.innerHTML = h;
      document.getElementById('re').onclick = function () { quiz(u, mode); };
      var n = document.getElementById('nxt'); if (n) n.onclick = function () { quiz(u, 'test'); };
      document.getElementById('rd').onclick = function (e) { e.preventDefault(); unit(u); };
    }
    show();
  }
})();
