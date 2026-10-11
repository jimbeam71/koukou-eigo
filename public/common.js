/* へぇ英語 共通ユーティリティ（保存・音声・連続日数） */
(function () {
  'use strict';
  var mem = {};

  function load(key, def) {
    try {
      var s = localStorage.getItem(key);
      if (s !== null) {
        var v = JSON.parse(s);
        if (v !== null && v !== undefined) return v;
      }
    } catch (e) {}
    if (mem[key] !== undefined) {
      try {
        var m = JSON.parse(mem[key]);
        if (m !== null && m !== undefined) return m;
      } catch (e) {}
    }
    return def;
  }
  function save(key, val) {
    var s = JSON.stringify(val);
    mem[key] = s;
    try { localStorage.setItem(key, s); } catch (e) {}
  }

  // 端末の「ローカル日付」を整数にする（0時で日付が変わる）
  function dayNum(d) {
    d = d || new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  var META = 'eigo_meta_v1';
  function markActive() {
    var m = load(META, { last: null, streak: 0, best: 0 });
    var t = dayNum();
    if (m.last === t) return m;
    m.streak = (m.last === t - 1) ? (m.streak || 0) + 1 : 1;
    m.best = Math.max(m.best || 0, m.streak);
    m.last = t;
    save(META, m);
    return m;
  }
  function getStreak() {
    var m = load(META, { last: null, streak: 0, best: 0 });
    var t = dayNum();
    if (m.last === t || m.last === t - 1) return { streak: m.streak || 0, today: m.last === t };
    return { streak: 0, today: false };
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.display = 'none'; }, 2600);
  }

  // ---- 音声（ブラウザ標準の読み上げ）----
  var voice = null;
  var canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  function pickVoice() {
    if (!canSpeak) return;
    var vs = speechSynthesis.getVoices() || [];
    voice = vs.filter(function (v) { return /^en[-_]US/i.test(v.lang); })[0] ||
            vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
  }
  if (canSpeak) {
    pickVoice();
    try { speechSynthesis.onvoiceschanged = pickVoice; } catch (e) {}
  }
  function speak(text, rate, quiet) {
    if (!canSpeak) {
      if (!quiet) toast('この端末は音声に対応していません');
      return false;
    }
    if (!voice) pickVoice();
    if (!voice) {
      // 英語の声がない端末では、日本語の声がカタカナ読みするので読み上げない
      if (!quiet) toast('この端末には英語の音声が入っていません');
      return false;
    }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.voice = voice;
      u.rate = rate || 0.9;
      speechSynthesis.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---- 音声ファイル（事前に作った英語音声）。だめなときだけブラウザ読み上げ ----
  var player = null;
  function play(src, rate, fallbackText, quiet) {
    rate = rate || 1;
    var failed = false;
    function fallback() {
      if (failed) return;
      failed = true;
      if (fallbackText) speak(fallbackText, rate * 0.9, quiet);
    }
    try {
      if (player) { try { player.pause(); } catch (e) {} }
      if (canSpeak) { try { speechSynthesis.cancel(); } catch (e) {} }
      var a = new Audio(src);
      player = a;
      a.preservesPitch = true;
      a.webkitPreservesPitch = true;
      a.playbackRate = rate;
      a.onerror = fallback;
      var p = a.play();
      if (p && p.catch) p.catch(function (err) {
        // 自動再生をブロックされただけのときは、静かにやめる
        if (err && err.name === 'NotAllowedError') return;
        fallback();
      });
    } catch (e) { fallback(); }
  }

  function errorCard(msg) {
    return '<div class="card"><h2>' + esc(msg) + '</h2>' +
      '<p class="muted">ネットにつながっているか確認して、ページを開き直してね。</p>' +
      '<a class="btn" href="index.html">トップへ</a></div>';
  }

  window.Eigo = {
    load: load, save: save, dayNum: dayNum, markActive: markActive, getStreak: getStreak,
    esc: esc, shuffle: shuffle, toast: toast, speak: speak, play: play, canSpeak: canSpeak, errorCard: errorCard
  };
})();
