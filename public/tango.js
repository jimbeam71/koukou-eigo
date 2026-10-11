/* 単語トレーナー：新しい語は最初から4択（知らなくてOK）→答えと例文。復習は翌日・3日後・7日後・21日後 */
(function () {
  'use strict';
  var E = window.Eigo, esc = E.esc;
  var KEY = 'eigo_tango_v1', KEY_PREF = 'eigo_pref_v1';
  var INTERVALS = [1, 3, 7, 21];   // stage1→翌日, stage2→3日後, stage3→7日後, stage4→21日後
  var REVIEW_CAP = 15;
  function per() { return (pref && [10, 20, 30].indexOf(pref.per) >= 0) ? pref.per : 10; }
  var LV = { 1: '中学基本', 2: '高校基本', 3: '共通テスト頻出' };
  var app = document.getElementById('app');
  var WORDS = [], BY = {}, S, pref, sess;

  function loadS() {
    var s = E.load(KEY, null);
    if (!s || !s.words) s = { words: {}, doneDay: null, sessions: 0 };
    return s;
  }
  function saveS() { E.save(KEY, S); }

  fetch('data/tango.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      WORDS = d.words || [];
      WORDS.forEach(function (w) { BY[w.id] = w; });
      S = loadS();
      pref = E.load(KEY_PREF, { auto: true });
      renderStart();
    })
    .catch(function () { app.innerHTML = E.errorCard('単語データを読み込めませんでした'); });

  function dueIds(t) {
    return WORDS.filter(function (w) { var e = S.words[w.id]; return e && e.due <= t; })
      .sort(function (a, b) { return S.words[a.id].due - S.words[b.id].due; })
      .map(function (w) { return w.id; });
  }
  function freshIds() {
    return WORDS.filter(function (w) { return !S.words[w.id]; }).slice(0, per()).map(function (w) { return w.id; });
  }

  // ---------- スタート画面 ----------
  function renderStart() {
    S = loadS();
    var t = E.dayNum();
    var due = dueIds(t).length, fresh = freshIds().length;
    var learned = Object.keys(S.words).length;
    var firm = WORDS.filter(function (w) { var e = S.words[w.id]; return e && e.stage >= 3; }).length;
    var done = S.doneDay === t;
    var pct = WORDS.length ? Math.round(learned / WORDS.length * 100) : 0;
    var nothing = fresh === 0 && due === 0;

    var h = '<div class="card">';
    h += '<h2>' + (done ? '🎉 今日の分は達成！' : '今日の' + per() + '語') + '</h2>';
    h += '<p class="muted">まず4択に答える（知らなくてOK）→ 答えと例文を見る。まちがえた選択肢にも英単語と例文があるから、タップすると1問で4語ぶん学べるよ。約5分。復習は、翌日・3日後・7日後に自動で出るよ。</p>';
    h += '<div class="stats"><div><b>' + fresh + '</b><span>新しい語</span></div>' +
         '<div><b>' + due + '</b><span>復習する語</span></div>' +
         '<div><b>' + firm + '</b><span>定着した語</span></div></div>';
    h += '<div class="small muted">学習した語 ' + learned + ' / ' + WORDS.length + '</div>';
    h += '<div class="bar"><i style="width:' + pct + '%"></i></div>';
    if (nothing) {
      h += '<div class="banner ok">今ある語は全部やりきったよ！ 新しい語は追加していくので、また来てね。</div>';
    } else {
      h += '<div class="small muted" style="margin-top:8px">1日の新しい語の数</div><div class="chips">';
      [10, 20, 30].forEach(function (n) {
        h += '<button class="chip' + (n === per() ? ' on' : '') + '" data-per="' + n + '">' + n + '語</button>';
      });
      h += '</div>';
      h += '<button class="btn primary block" id="go">' + (done ? 'もう' + per() + '語やる' : 'スタート') + '</button>';
    }
    h += '<div class="row gap-top"><button class="btn sm" id="auto">発音を自動で再生：' + (pref.auto ? 'ON' : 'OFF') + '</button></div>';
    h += '<p class="small muted" style="margin-top:10px">パソコンなら、キーの 1〜4 で選択、Enter で次へ進めるよ。音が出ないときは、音量とマナーモードを確認してね。</p>';
    h += '</div>';
    app.innerHTML = h;

    document.onkeydown = null;
    var go = document.getElementById('go');
    if (go) go.onclick = startSession;
    var pbtns = app.querySelectorAll('[data-per]');
    for (var pi = 0; pi < pbtns.length; pi++) {
      pbtns[pi].onclick = function () {
        pref.per = parseInt(this.getAttribute('data-per'), 10); E.save(KEY_PREF, pref); renderStart();
      };
    }
    document.getElementById('auto').onclick = function () {
      pref.auto = !pref.auto; E.save(KEY_PREF, pref); renderStart();
    };
  }

  // ---------- セッション ----------
  function startSession() {
    var t = E.dayNum();
    var due = dueIds(t).slice(0, REVIEW_CAP);
    var fresh = freshIds();
    var steps = [];
    due.forEach(function (id) { steps.push({ t: 'quiz', id: id, kind: 'review' }); });
    fresh.forEach(function (id) { steps.push({ t: 'quiz', id: id, kind: 'new' }); });
    sess = { T: t, steps: steps, i: 0, res: {}, newCount: fresh.length, revCount: due.length, right: 0, asked: 0 };
    renderStep();
  }

  function progressHtml() {
    var total = sess.steps.length;
    var pct = Math.round(sess.i / total * 100);
    return '<div class="small muted">' + (sess.i + 1) + ' / ' + total + '</div><div class="bar"><i style="width:' + pct + '%"></i></div>';
  }
  function audioRow(src, text) {
    var a = ' data-audio="' + esc(src) + '" data-say="' + esc(text) + '"';
    return '<span class="row"><button class="btn sm"' + a + ' data-rate="1">🔊 聞く</button>' +
           '<button class="btn sm"' + a + ' data-rate="0.7">🐢 ゆっくり</button></span>';
  }
  function wSrc(w) { return 'audio/w/' + w.id + '.mp3'; }
  function xSrc(w) { return 'audio/w/' + w.id + 'x.mp3'; }
  function bindSay() {
    var btns = app.querySelectorAll('[data-say]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () { E.play(this.getAttribute('data-audio'), parseFloat(this.getAttribute('data-rate')), this.getAttribute('data-say')); };
    }
  }

  function renderStep() {
    if (sess.i >= sess.steps.length) return finish();
    var st = sess.steps[sess.i], w = BY[st.id];
    if (st.t === 'learn') renderLearn(w); else renderQuiz(w, st);
    window.scrollTo(0, 0);
  }

  function renderLearn(w) {
    var h = '<div class="card word-card">' + progressHtml();
    h += '<span class="pill lv' + w.level + '">' + LV[w.level] + '</span> <span class="small muted">新しい語</span>';
    h += '<div class="en">' + esc(w.en) + '</div>';
    h += '<div><span class="pos">' + esc(w.pos) + '</span>' + audioRow(wSrc(w), w.en) + '</div>';
    h += '<div class="ja">' + esc(w.ja) + '</div>';
    if (w.tip) h += '<div class="tip">💡 ' + esc(w.tip) + '</div>';
    h += '<div class="ex"><div class="e">' + esc(w.ex) + '</div><div class="j">' + esc(w.exJa) + '</div>';
    h += '<div style="margin-top:6px">' + audioRow(xSrc(w), w.ex) + '</div></div>';
    h += '<button class="btn primary block" id="next">次へ</button></div>';
    app.innerHTML = h;
    bindSay();
    document.getElementById('next').onclick = function () { sess.i++; renderStep(); };
    if (pref.auto) E.play(wSrc(w), 1, w.en, true);
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
    return E.shuffle([w].concat(ds)).map(function (x) { return { ja: x.ja, ok: x.id === w.id, w: x }; });
  }

  function renderQuiz(w, st) {
    var choices = makeChoices(w);
    var answered = false;
    var isNew = st.kind === 'new' && !st.retry;
    var label = st.kind === 'review' ? '復習' : (st.retry ? 'もう一度' : '新しい語');
    var h = '<div class="card word-card">' + progressHtml();
    h += '<span class="pill lv' + w.level + '">' + LV[w.level] + '</span> <span class="small muted">' + label + '</span>';
    h += '<div class="small muted" style="margin-top:8px">この単語の意味は？' + (isNew ? '（知らなくてOK。直感で選ぼう）' : '') + '</div>';
    h += '<div class="en">' + esc(w.en) + '</div>';
    h += '<div>' + audioRow(wSrc(w), w.en) + '</div>';
    h += '<div class="choices" id="choices">';
    choices.forEach(function (c, k) {
      h += '<div class="opt"><button class="choice" data-k="' + k + '"><span class="kn">' + (k + 1) + '</span><span>' + esc(c.ja) + '</span></button>' +
           '<div class="rev" id="rev' + k + '" hidden></div></div>';
    });
    h += '</div><div class="fb" id="fb"></div></div>';
    app.innerHTML = h;
    bindSay();
    if (pref.auto) E.play(wSrc(w), 1, w.en, true);

    document.onkeydown = function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key >= '1' && e.key <= '4') {
        var b = document.querySelector('#choices .choice[data-k="' + (parseInt(e.key, 10) - 1) + '"]');
        if (b) { e.preventDefault(); b.click(); }
      } else if (e.key === 'Enter') {
        var n = document.getElementById('next');
        if (n) { e.preventDefault(); n.click(); }
      }
    };
    var btns = document.querySelectorAll('#choices .choice');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () {
        var k = parseInt(this.getAttribute('data-k'), 10);
        this.blur();
        if (!answered) { answered = true; answer(w, st, choices, k); }
        else toggleReveal(choices, k, false);
      };
    }
  }

  // 選択肢の下に「その意味の英単語」と例文を出す（1問で4語ぶん学べる）
  function toggleReveal(choices, k, force) {
    var x = choices[k].w, el = document.getElementById('rev' + k);
    if (!el) return;
    var cb = document.querySelector('#choices .choice[data-k="' + k + '"]');
    if (!force && !el.hidden) { el.hidden = true; if (cb) cb.classList.remove('open'); return; }
    if (cb) cb.classList.add('open');
    var h = '<div class="revhead"><b>' + esc(x.en) + '</b> <span class="pos">' + esc(x.pos) + '</span>＝ ' + esc(x.ja) + '</div>';
    h += audioRow(wSrc(x), x.en);
    h += '<div class="ex"><div class="e">' + esc(x.ex) + '</div><div class="j">' + esc(x.exJa) + '</div>';
    h += '<div style="margin-top:6px">' + audioRow(xSrc(x), x.ex) + '</div></div>';
    el.innerHTML = h;
    el.hidden = false;
    bindSay();
  }

  function schedule(id, kind, ok) {
    var e = S.words[id], t = sess.T;
    if (kind === 'new' || !e) {
      // 最初の4択で当てた語は「もともと知っていた」ので、3日後に確認（外れたら翌日）
      var st0 = ok ? 2 : 1;
      S.words[id] = { stage: st0, due: t + INTERVALS[st0 - 1], seen: t, miss: ok ? 0 : 1 };
    } else {
      var stage = ok ? Math.min((e.stage || 1) + 1, INTERVALS.length) : 1;
      S.words[id] = { stage: stage, due: t + INTERVALS[stage - 1], seen: e.seen || t, miss: (e.miss || 0) + (ok ? 0 : 1) };
    }
    saveS();
  }

  function answer(w, st, choices, k) {
    var ok = choices[k].ok, correctK = 0;
    choices.forEach(function (c, i) { if (c.ok) correctK = i; });
    var r = sess.res[w.id] || (sess.res[w.id] = { first: null, tries: 0 });
    r.tries++;
    if (r.first === null) {
      r.first = ok; sess.asked++; if (ok) sess.right++;
      schedule(w.id, st.kind, ok);
    }
    if (!ok && r.tries < 3) sess.steps.push({ t: 'quiz', id: w.id, kind: st.kind, retry: true });

    var btns = document.querySelectorAll('#choices .choice');
    for (var i = 0; i < btns.length; i++) {
      if (choices[i].ok) btns[i].className = 'choice ok';
      else if (i === k) btns[i].className = 'choice ng';
      btns[i].classList.add('after');
    }
    toggleReveal(choices, correctK, true);
    if (!ok) toggleReveal(choices, k, true);

    var h = '<div class="verdict ' + (ok ? 'ok' : 'ng') + '">' + (ok ? '⭕ 正解！' : (st.kind === 'new' && !st.retry ? '🙆 知らなくてOK。正解は「' + esc(w.ja) + '」' : '❌ 正解は「' + esc(w.ja) + '」')) + '</div>';
    if (!ok && w.tip) h += '<div class="tip">💡 ' + esc(w.tip) + '</div>';
    h += '<div class="tip"><b>👆 ほかの選択肢もタップしてみて！</b><br>まちがえた選択肢にも、その意味になる「本物の英単語」と例文があるよ。ぜんぶ見ると、1問で<b>4語ぶん</b>学べる。見ないともったいない！</div>';
    h += '<button class="btn primary block" id="next">次へ</button>';
    document.getElementById('fb').innerHTML = h;
    document.getElementById('next').onclick = function () { sess.i++; renderStep(); };
  }

  function finish() {
    S.doneDay = sess.T;
    S.sessions = (S.sessions || 0) + 1;
    saveS();
    E.markActive();
    document.onkeydown = null;
    var s = E.getStreak();
    var rate = sess.asked ? Math.round(sess.right / sess.asked * 100) : 0;
    var h = '<div class="card center"><h2>🎉 今日の単語、おつかれさま！</h2>';
    h += '<div class="stats"><div><b>' + sess.newCount + '</b><span>新しく学んだ語</span></div>' +
         '<div><b>' + sess.revCount + '</b><span>復習した語</span></div>' +
         '<div><b>' + rate + '%</b><span>1回目の正解率</span></div></div>';
    if (s.streak > 0) h += '<p><span class="streak">🔥 ' + s.streak + '日つづいてるよ</span></p>';
    h += '<p class="muted">まちがえた語は、明日また出てくるよ。次は「切る練習」へ。</p>';
    h += '<a class="btn primary block" href="kiru.html">切る練習へ</a>';
    h += '<div class="row gap-top" style="justify-content:center"><button class="btn sm" id="more">もう10語やる</button><a class="btn sm" href="index.html">トップへ</a></div></div>';
    app.innerHTML = h;
    document.getElementById('more').onclick = renderStart;
    window.scrollTo(0, 0);
  }
})();
