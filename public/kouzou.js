(function () {
  'use strict';
  var E = window.Eigo, KEY = 'eigo_kouzou_v1', SIZE = 10;
  var app = document.getElementById('app'), D = null, st = E.load(KEY, { done: {} }), au = null;
  var esc = E.esc;
  function play(f) { try { if (au) au.pause(); au = new Audio(f); au.play().catch(function () {}); } catch (e) {} }
  fetch('data/kouzou.json').then(function (r) { return r.json(); }).then(function (d) { D = d; route(); });
  window.addEventListener('hashchange', route);
  function setItems(n) { return D.items.slice(n * SIZE, n * SIZE + SIZE); }
  function route() {
    var m = /^#s(\d+)$/.exec(location.hash), n = m ? +m[1] : -1;
    var ok = n >= 0 && setItems(n).length > 0;
    document.getElementById('back').setAttribute('href', ok ? 'kouzou.html' : 'index.html');
    document.getElementById('back').textContent = ok ? '← 一覧' : '← トップ';
    window.scrollTo(0, 0);
    if (ok) study(n); else list();
  }
  function list() {
    var h = '<h1>構文80</h1><p class="lead">長文を読む前に押さえたい構文の型。10個ずつ「解説 → 例文を聞く → 確認問題（20問）」。</p><div class="menu">';
    D.sets.forEach(function (s, n) {
      var d = st.done[n], its = setItems(n);
      h += '<a class="card" href="#s' + n + '"><span class="num' + (d ? ' done' : '') + '">' + (d ? '✓' : n + 1) + '</span><span class="body"><b>' + esc(s.title) + '</b><span class="muted small">' +
        esc(its.slice(0, 3).map(function (x) { return x.t.split('（')[0].split('：')[0]; }).join(' / ')) + ' …' + (d ? '<br>前回：' + d.score + ' / ' + d.total : '') + '</span></span><span class="go">›</span></a>';
    });
    app.innerHTML = h + '</div>';
  }
  function study(n) {
    var its = setItems(n), h = '<h1>' + esc(D.sets[n].title) + '</h1>';
    its.forEach(function (x, i) {
      h += '<div class="card"><div class="muted small">構文' + (n * SIZE + i + 1) + '</div><b style="font-size:18px">' + esc(x.t) + '</b>' +
        '<div class="box" style="margin:8px 0">' + esc(x.rule) + '</div>' +
        '<div style="font-size:18px;line-height:1.7">' + esc(x.ex) + ' <button class="btn sm" data-a="audio/s/' + x.id + '.mp3">▶</button></div><div class="muted small">' + esc(x.exJa) + '</div></div>';
    });
    h += '<button class="btn primary block" id="go">確認問題へ（' + its.length * 2 + '問）</button>';
    if (setItems(n + 1).length) h += '<p></p><a class="btn block" href="#s' + (n + 1) + '">次の回へ</a>';
    app.innerHTML = h;
    Array.prototype.forEach.call(app.querySelectorAll('[data-a]'), function (b) { b.onclick = function () { play(b.getAttribute('data-a')); }; });
    document.getElementById('go').onclick = function () { quiz(n); };
  }
  function quiz(n) {
    var its = setItems(n), Q = [];
    E.shuffle(its).forEach(function (x) {
      Q.push({ tag: '読み取り', q: x.ex, hint: x.q, opts: E.shuffle(x.o.slice()), ans: x.a, w: x.w + '\n' + x.exJa, id: x.id });
    });
    E.shuffle(its).forEach(function (x) {
      var others = E.shuffle(its.filter(function (y) { return y !== x; })).slice(0, 3).map(function (y) { return y.t; });
      Q.push({ tag: '構文の型', q: x.ex, hint: 'この文で使われている構文はどれ？', opts: E.shuffle([x.t].concat(others)), ans: x.t, w: x.rule + '\n' + x.exJa, id: x.id });
    });
    var i = 0, score = 0, miss = [];
    function show() {
      var q = Q[i];
      var h = '<div class="muted small">' + (i + 1) + ' / ' + Q.length + '　<span class="tag">' + q.tag + '</span></div><div class="card"><div style="font-size:19px;line-height:1.7">' + esc(q.q) + '</div><div style="margin-top:8px;font-weight:700">' + esc(q.hint) + '</div></div><div class="choices">';
      q.opts.forEach(function (o, j) { h += '<button class="choice" data-j="' + j + '">' + esc(o) + '</button>'; });
      app.innerHTML = h + '</div><div id="fb"></div>';
      Array.prototype.forEach.call(app.querySelectorAll('.choice'), function (b) {
        b.onclick = function () {
          var j = +b.getAttribute('data-j'), ok = q.opts[j] === q.ans;
          if (ok) score++; else miss.push(i);
          Array.prototype.forEach.call(app.querySelectorAll('.choice'), function (x) {
            x.disabled = true; var k = +x.getAttribute('data-j');
            if (q.opts[k] === q.ans) x.classList.add('ok'); else if (k === j) x.classList.add('ng');
          });
          document.getElementById('fb').innerHTML = '<div class="box ' + (ok ? '' : 'point') + '"><b class="t">' + (ok ? '正解！' : '正解は「' + esc(q.ans) + '」') + '</b>' + esc(q.w).replace(/\n/g, '<br>') + '</div><button class="btn sm" id="pl">▶ 例文を聞く</button> <button class="btn primary block" id="nx" style="margin-top:10px">' + (i + 1 < Q.length ? '次へ' : '結果を見る') + '</button>';
          document.getElementById('pl').onclick = function () { play('audio/s/' + q.id + '.mp3'); };
          document.getElementById('nx').onclick = function () { i++; if (i < Q.length) show(); else fin(); };
        };
      });
      window.scrollTo(0, 0);
    }
    function fin() {
      E.markActive();
      var best = st.done[n];
      st.done[n] = { score: Math.max(score, best ? best.score : 0), total: Q.length };
      E.save(KEY, st);
      var h = '<h1>' + score + ' / ' + Q.length + '</h1><p class="lead">' + (score === Q.length ? '全問正解！' : score >= Q.length * 0.8 ? 'いい感じ。まちがえたところだけ見直そう。' : 'もう一度、解説を見直してからやってみよう。') + '</p>';
      if (miss.length) {
        h += '<h3>まちがえた問題</h3>';
        miss.forEach(function (k) { var q = Q[k]; h += '<div class="card"><b>' + esc(q.q) + '</b><div class="muted small">' + esc(q.hint) + '</div><div class="muted small">正解：' + esc(q.ans) + '</div></div>'; });
      }
      h += '<button class="btn block" id="re">もう一度</button><p></p><a class="btn block" href="#s' + n + '" id="rd">見直す</a><p></p>' + (setItems(n + 1).length ? '<a class="btn primary block" href="#s' + (n + 1) + '">次の回へ</a><p></p>' : '') + '<a class="btn block" href="kouzou.html">一覧へ</a>';
      app.innerHTML = h;
      document.getElementById('re').onclick = function () { quiz(n); };
      document.getElementById('rd').onclick = function (e) { e.preventDefault(); study(n); };
    }
    show();
  }
})();
