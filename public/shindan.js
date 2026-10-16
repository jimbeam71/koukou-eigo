/* 単語の診断：30問（各レベル10問）。知っている語は「後回し」にして、知らない語から学べるようにする */
(function () {
  'use strict';
  var E = window.Eigo, esc = E.esc;
  var KEY = 'eigo_tango_v1', KEY_PREF = 'eigo_pref_v1', KEY_SH = 'eigo_shindan_v1';
  var PER = 10, MIN = 5;
  var LV = { 1: '中学基本', 2: '高校基本', 3: '共通テスト頻出' };
  var app = document.getElementById('app');
  var WORDS = [], S, pref, Q = [], qi = 0, ans = [];

  fetch('data/tango.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { WORDS = d.words || []; renderStart(); })
    .catch(function () { app.innerHTML = E.errorCard('単語データを読み込めませんでした'); });

  function loadS() {
    var s = E.load(KEY, null);
    if (!s || !s.words) s = { words: {}, doneDay: null, sessions: 0 };
    return s;
  }

  function wSrc(w) { return 'audio/w/' + w.id + '.mp3'; }

  // ---------- スタート ----------
  function renderStart() {
    document.onkeydown = null;
    S = loadS();
    pref = E.load(KEY_PREF, { auto: true });
    var sh = E.load(KEY_SH, null);
    var h = '<div class="card"><h2>あなたの単語力を、ざっくり調べよう</h2>';
    h += '<p class="muted">中学基本・高校基本・共通テスト頻出から、10語ずつ（全30問）。約3分。点数はつかないので、<b>知らなくてOK</b>。わからない語は「わからない」を押そう。</p>';
    h += '<div class="tip">💡 結果から、<b>もう知っているレベルの語は「後回し」</b>にして、知らない語から練習できるようにするよ。当てた語は、あとで1回だけ確認に出るよ。</div>';
    if (sh && sh.lv) {
      h += '<div class="banner ok">前回の診断：' + [1, 2, 3].map(function (l) {
        var r = sh.lv[l]; return LV[l] + ' ' + (r ? r.ok + '/' + r.n : '－');
      }).join('　') + '</div>';
    }
    h += '<button class="btn primary block" id="go">' + (sh ? 'もう一度診断する' : '診断をはじめる') + '</button>';
    h += '</div>';
    app.innerHTML = h;
    document.getElementById('go').onclick = start;
  }

  function makeChoices(w) {
    var pool = WORDS.filter(function (x) { return x.id !== w.id && x.ja !== w.ja && !(w.grp && x.grp === w.grp); });
    var same = E.shuffle(pool.filter(function (x) { return x.pos === w.pos; }));
    var rest = E.shuffle(pool.filter(function (x) { return x.pos !== w.pos; }));
    var seen = {}; seen[w.ja] = true;
    var ds = [];
    same.concat(rest).forEach(function (x) {
      if (ds.length < 3 && !seen[x.ja]) { ds.push(x); seen[x.ja] = true; }
    });
    return E.shuffle([w].concat(ds)).map(function (x) { return { ja: x.ja, ok: x.id === w.id }; });
  }

  function start() {
    S = loadS();
    Q = []; ans = []; qi = 0;
    [1, 2, 3].forEach(function (lv) {
      var pool = WORDS.filter(function (w) { return w.level === lv && !S.words[w.id]; });
      E.shuffle(pool).slice(0, PER).forEach(function (w) { Q.push(w); });
    });
    if (!Q.length) { app.innerHTML = '<div class="card center"><h2>診断できる語がありません</h2><p class="muted">もう全部の語を学習ずみだよ。</p><a class="btn" href="index.html">トップへ</a></div>'; return; }
    renderQ();
  }

  // ---------- 出題 ----------
  function renderQ() {
    if (qi >= Q.length) return renderResult();
    var w = Q[qi], choices = makeChoices(w), done = false;
    var pct = Math.round(qi / Q.length * 100);
    var h = '<div class="card word-card"><div class="small muted">' + (qi + 1) + ' / ' + Q.length + '</div><div class="bar"><i style="width:' + pct + '%"></i></div>';
    h += '<div class="small muted">この単語の意味は？</div>';
    h += '<div class="en">' + esc(w.en) + '</div>';
    h += '<div><button class="btn sm" id="say">🔊 聞く</button></div>';
    h += '<div class="choices" id="choices">';
    choices.forEach(function (c, k) {
      h += '<button class="choice" data-k="' + k + '"><span class="kn">' + (k + 1) + '</span><span>' + esc(c.ja) + '</span></button>';
    });
    h += '</div><button class="dk" id="dk">わからない</button></div>';
    app.innerHTML = h;
    window.scrollTo(0, 0);
    if (pref.auto) E.play(wSrc(w), 1, w.en, true);
    document.getElementById('say').onclick = function () { E.play(wSrc(w), 1, w.en); };

    function pick(ok) {
      if (done) return; done = true;
      ans.push({ id: w.id, level: w.level, ok: ok });
      qi++; renderQ();
    }
    var btns = document.querySelectorAll('#choices .choice');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () { pick(choices[parseInt(this.getAttribute('data-k'), 10)].ok); };
    }
    document.getElementById('dk').onclick = function () { pick(false); };
    document.onkeydown = function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key >= '1' && e.key <= '4') { var b = document.querySelector('#choices .choice[data-k="' + (parseInt(e.key, 10) - 1) + '"]'); if (b) b.click(); }
    };
  }

  // ---------- 結果 ----------
  function summary() {
    var r = {};
    [1, 2, 3].forEach(function (lv) {
      var a = ans.filter(function (x) { return x.level === lv; });
      r[lv] = { n: a.length, ok: a.filter(function (x) { return x.ok; }).length };
    });
    return r;
  }
  function verdict(r) {
    if (r.n < MIN) return { t: 'もう学習ずみの語が多いので、くわしい判定はなし', later: false };
    var p = r.ok / r.n;
    if (p >= 0.9) return { t: '◎ ほぼ知ってる → 後回しにしてOK', later: true };
    if (p >= 0.6) return { t: '○ だいたい知ってる → 知らない語だけ拾っていこう', later: false };
    if (p >= 0.3) return { t: '△ ここから伸ばそう', later: false };
    return { t: '▲ ここがスタート。大丈夫、少しずつ！', later: false };
  }

  function renderResult() {
    document.onkeydown = null;
    var sm = summary(), later = [];
    var h = '<div class="card"><h2>🎉 診断おつかれさま！</h2>';
    var startLv = 0;
    [1, 2, 3].forEach(function (lv) {
      var r = sm[lv], v = verdict(r);
      if (v.later) later.push(lv);
      if (!startLv && r.n >= MIN && !v.later) startLv = lv;
      var pct = r.n ? Math.round(r.ok / r.n * 100) : 0;
      h += '<div class="lvrow"><span class="nm"><span class="pill lv' + lv + '">' + LV[lv] + '</span></span><span class="sc">' + r.ok + ' / ' + r.n + '</span>' +
           '<span class="vd">' + esc(v.t) + '</span></div><div class="bar"><i style="width:' + pct + '%"></i></div>';
    });
    if (startLv) h += '<div class="banner ng">おすすめのスタートは「' + LV[startLv] + '」の語から。</div>';
    else h += '<div class="banner ok">どのレベルもよくできてる！ 新しい語はどんどん足していくよ。</div>';
    h += '<p class="small muted">反映すると：当てた ' + ans.filter(function (x) { return x.ok; }).length + ' 語は「もう知ってる語」として、3日後に1回だけ確認に出ます。' +
         (later.length ? '「' + later.map(function (l) { return LV[l]; }).join('」「') + '」の新しい語は、ほかのレベルが終わってから出します（あとで元に戻せます）。' : '') + '</p>';
    h += '<button class="btn primary block" id="apply">この結果を「今日の単語」に反映する</button>';
    h += '<button class="dk" id="skip">反映しないで、そのまま始める</button></div>';
    app.innerHTML = h;
    window.scrollTo(0, 0);
    document.getElementById('apply').onclick = function () { apply(sm, later); };
    document.getElementById('skip').onclick = function () { finish(sm, false, later); };
  }

  function apply(sm, later) {
    var T = E.dayNum();
    S = loadS();
    ans.forEach(function (a) {
      if (a.ok && !S.words[a.id]) S.words[a.id] = { stage: 2, due: T + 3, seen: T, miss: 0 };
    });
    E.save(KEY, S);
    pref = E.load(KEY_PREF, { auto: true });
    pref.later = later;
    E.save(KEY_PREF, pref);
    finish(sm, true, later);
  }

  function finish(sm, applied, later) {
    E.save(KEY_SH, { day: E.dayNum(), lv: sm, applied: applied });
    E.markActive();
    var h = '<div class="card center"><h2>' + (applied ? '✅ 反映したよ！' : '診断は、記録だけしたよ') + '</h2>';
    h += '<p class="muted">' + (applied ? '次の「今日の単語」から、知らない語を優先して出すよ。' : '「今日の単語」は、ふつうの順番で出るよ。') + '</p>';
    h += '<a class="btn primary block" href="tango.html">今日の単語へ</a>';
    h += '<div class="row gap-top" style="justify-content:center"><a class="btn sm" href="index.html">トップへ</a></div></div>';
    app.innerHTML = h;
    window.scrollTo(0, 0);
  }
})();
