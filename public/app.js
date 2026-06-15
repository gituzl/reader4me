(function() {
  'use strict';

  // ============== Constants ==============
  // Word chars: Unicode letters + hyphen + apostrophes (straight ' curly ' modifier ʼ acute ´)
  var TOKEN_RE = /[\p{L}\u{0027}\u{2019}\u{02BC}\u{00B4}\-]+|[^\p{L}\s]+|\s+/gu;
  var SENTENCE_SPLIT_RE = /(?<=[.!?。！？])\s+/;
  var LANG_NAMES = { en: 'English', fr: 'French', ru: 'Russian' };

  // ============== State ==============
  // NOTE: the SiliconFlow API key lives ONLY on the server (env var). The
  // browser never sees it — lookups go through the same-origin /api/lookup proxy.
  var state = {
    lang: localStorage.getItem('sf_lang') || 'auto',
    fontSize: parseInt(localStorage.getItem('sf_fontsize') || '18', 10),
    theme: localStorage.getItem('sf_theme') || 'auto',
    cache: Object.create(null),
    abortCtrl: null,
    anchorEl: null,
    intersectionObserver: null,
    resizeRaf: null,
  };

  // ============== DOM ==============
  function $(id) { return document.getElementById(id); }
  var dom = {
    uploadBtn: $('upload-btn'),
    pasteBtn: $('paste-btn'),
    pasteArea: $('paste-area'),
    pasteActions: $('paste-actions'),
    pasteCancel: $('paste-cancel'),
    pasteLoad: $('paste-load'),
    langSelect: $('lang-select'),
    fontSize: $('font-size'),
    themeToggle: $('theme-toggle'),
    welcome: $('welcome'),
    reading: $('reading-area'),
    fileInput: $('file-input'),
    popup: $('popup'),
    popupWord: document.querySelector('.popup-word'),
    popupIpa: document.querySelector('.popup-ipa'),
    popupTranslation: document.querySelector('.popup-translation'),
  };

  // ============== Text Tokenization & Rendering ==============
  function splitSentences(text) {
    var parts = text.split(SENTENCE_SPLIT_RE);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var t = parts[i].trim();
      if (t) out.push(t);
    }
    return out;
  }

  function tokenizeSentence(sentence) {
    var tokens = [];
    var match;
    TOKEN_RE.lastIndex = 0;
    while ((match = TOKEN_RE.exec(sentence)) !== null) {
      var t = match[0];
      if (/^\s+$/.test(t)) {
        // Preserve inter-word whitespace (normalized to one space) so text wraps
        // naturally at word boundaries instead of overflowing / breaking mid-word.
        tokens.push({ type: 'sep', text: ' ' });
      } else if (/[\p{L}]/u.test(t)) {
        tokens.push({ type: 'word', text: t });
      } else {
        tokens.push({ type: 'sep', text: t });
      }
    }
    return tokens;
  }

  function renderReading(text) {
    var frag = document.createDocumentFragment();
    var paragraphs = text.split(/\n\s*\n/);
    paragraphs.forEach(function(para) {
      var sentences = splitSentences(para);
      var pEl = document.createElement('p');

      sentences.forEach(function(sentence, sIdx) {
        var tokens = tokenizeSentence(sentence);
        tokens.forEach(function(tok) {
          var span = document.createElement('span');
          span.textContent = tok.text;
          if (tok.type === 'word') {
            span.className = 'word';
            span.dataset.sentence = sentence;
          }
          pEl.appendChild(span);
        });
        if (sIdx < sentences.length - 1) {
          var spaceSpan = document.createElement('span');
          spaceSpan.textContent = ' ';
          pEl.appendChild(spaceSpan);
        }
      });

      frag.appendChild(pEl);
    });

    dom.reading.innerHTML = '';
    dom.reading.appendChild(frag);
    dom.welcome.hidden = true;
  }

  function loadText(text) {
    if (!text || !text.trim()) {
      alert('文本为空');
      return;
    }
    hidePopup();
    state.cache = Object.create(null);
    renderReading(text);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // ============== Popup ==============
  function isMobile() { return window.innerWidth <= 768; }

  function showPopup() {
    if (dom.popup.hidden) {
      dom.popup.hidden = false;
      /* force reflow */ dom.popup.offsetHeight;
    }
    requestAnimationFrame(function() { dom.popup.classList.add('visible'); });
  }

  function hidePopup() {
    dom.popup.classList.remove('visible');
    setTimeout(function() { dom.popup.hidden = true; }, 120);
    if (state.anchorEl) state.anchorEl.classList.remove('active');
    state.anchorEl = null;
    if (state.abortCtrl) { state.abortCtrl.abort(); state.abortCtrl = null; }
    if (state.intersectionObserver) {
      state.intersectionObserver.disconnect();
      state.intersectionObserver = null;
    }
  }

  function positionPopup(anchorEl) {
    if (isMobile()) return; // CSS handles bottom sheet

    var rect = anchorEl.getBoundingClientRect();
    var popupRect = dom.popup.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;

    var spaceBelow = vh - rect.bottom;
    var spaceAbove = rect.top;
    var top;
    if (spaceBelow < popupRect.height + 8 && spaceAbove >= popupRect.height + 8) {
      top = rect.top - popupRect.height - 8 + window.scrollY;
    } else {
      top = rect.bottom + 8 + window.scrollY;
    }

    var wordCenter = rect.left + rect.width / 2;
    var left = wordCenter - popupRect.width / 2 + window.scrollX;
    var minLeft = 8 + window.scrollX;
    var maxLeft = vw - popupRect.width - 8 + window.scrollX;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    dom.popup.style.left = left + 'px';
    dom.popup.style.top = top + 'px';
  }

  function updatePopupContent(opts) {
    var word = opts.word;
    var ipa = opts.ipa;
    var translation = opts.translation;
    var loading = opts.loading;
    var error = opts.error;

    dom.popupWord.textContent = word;

    if (error) {
      dom.popupIpa.textContent = '';
      dom.popupTranslation.innerHTML = '';
      var errSpan = document.createElement('span');
      errSpan.className = 'popup-error';
      errSpan.textContent = '⚠ ' + error;
      dom.popupTranslation.appendChild(errSpan);
    } else if (loading) {
      dom.popupIpa.textContent = '';
      dom.popupTranslation.innerHTML = '';
      var loadSpan = document.createElement('span');
      loadSpan.className = 'popup-loading';
      loadSpan.textContent = '查询中...';
      dom.popupTranslation.appendChild(loadSpan);
    } else {
      dom.popupIpa.textContent = ipa || '';
      dom.popupTranslation.textContent = translation || '';
    }

    if (state.anchorEl) positionPopup(state.anchorEl);
  }

  // ============== Backend API (same-origin proxy, key stays server-side) ==============
  function callBackend(word, sentence, langName, signal) {
    return fetch('/api/lookup', {
      method: 'POST',
      signal: signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: word, sentence: sentence, langName: langName })
    }).then(function(response) {
      if (!response.ok) {
        return response.json().then(function(data) {
          throw new Error(data.error || ('HTTP ' + response.status));
        }).catch(function(e) {
          if (e.message && e.message.indexOf('HTTP') !== 0) throw e;
          throw new Error('API ' + response.status);
        });
      }
      return response.json();
    });
  }

  function lookupWord(spanEl) {
    var word = spanEl.textContent;
    var sentence = spanEl.dataset.sentence || '';
    var langName = LANG_NAMES[state.lang] || 'English';
    var cacheKey = state.lang + ':' + word.toLowerCase();

    // Toggle if clicking the same word
    if (state.anchorEl === spanEl) {
      hidePopup();
      return;
    }

    // Update active state
    if (state.anchorEl) state.anchorEl.classList.remove('active');
    state.anchorEl = spanEl;
    spanEl.classList.add('active');

    // Show + position popup
    showPopup();
    positionPopup(spanEl);

    // Intersection observer for auto-close
    if (state.intersectionObserver) state.intersectionObserver.disconnect();
    state.intersectionObserver = new IntersectionObserver(function(entries) {
      if (!entries[0].isIntersecting) hidePopup();
    }, { threshold: 0 });
    state.intersectionObserver.observe(spanEl);

    // Check cache
    if (state.cache[cacheKey]) {
      var cached = state.cache[cacheKey];
      updatePopupContent({ word: word, ipa: cached.ipa, translation: cached.translation });
      return;
    }

    // Cancel previous request
    if (state.abortCtrl) state.abortCtrl.abort();
    state.abortCtrl = new AbortController();

    // Loading state
    updatePopupContent({ word: word, loading: true });

    callBackend(word, sentence, langName, state.abortCtrl.signal).then(function(result) {
      if (state.anchorEl === spanEl) {
        state.cache[cacheKey] = result;
        updatePopupContent({ word: word, ipa: result.ipa, translation: result.translation });
      }
    }).catch(function(err) {
      if (err && err.name === 'AbortError') return;
      if (state.anchorEl === spanEl) {
        updatePopupContent({ word: word, error: err.message || '请求失败' });
      }
    });
  }

  // ============== Theme ==============
  function applyTheme(theme) {
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  // ============== Event Wiring ==============
  function setupToolbar() {
    dom.uploadBtn.addEventListener('click', function() { dom.fileInput.click(); });

    dom.fileInput.addEventListener('change', function(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        loadText(String(ev.target.result || ''));
      };
      reader.onerror = function() { alert('读取文件失败'); };
      reader.readAsText(file, 'UTF-8');
      dom.fileInput.value = '';
    });

    dom.pasteBtn.addEventListener('click', function() {
      dom.pasteArea.hidden = false;
      dom.pasteActions.hidden = false;
      setTimeout(function() { dom.pasteArea.focus(); }, 50);
    });

    dom.pasteCancel.addEventListener('click', function() {
      dom.pasteArea.hidden = true;
      dom.pasteActions.hidden = true;
      dom.pasteArea.value = '';
    });

    dom.pasteLoad.addEventListener('click', function() {
      var text = dom.pasteArea.value;
      if (!text.trim()) { alert('请输入文本'); return; }
      loadText(text);
      dom.pasteArea.hidden = true;
      dom.pasteActions.hidden = true;
      dom.pasteArea.value = '';
    });

    dom.langSelect.value = state.lang;
    dom.langSelect.addEventListener('change', function() {
      state.lang = dom.langSelect.value;
      try { localStorage.setItem('sf_lang', state.lang); } catch (e) {}
      state.cache = Object.create(null);
    });

    dom.fontSize.value = String(state.fontSize);
    document.documentElement.style.setProperty('--font-base', state.fontSize + 'px');
    dom.fontSize.addEventListener('input', function() {
      state.fontSize = parseInt(dom.fontSize.value, 10);
      try { localStorage.setItem('sf_fontsize', String(state.fontSize)); } catch (e) {}
      document.documentElement.style.setProperty('--font-base', state.fontSize + 'px');
    });

    dom.themeToggle.addEventListener('click', function() {
      var current = document.documentElement.getAttribute('data-theme') || 'auto';
      var next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
      applyTheme(next);
      state.theme = next;
      try { localStorage.setItem('sf_theme', next); } catch (e) {}
    });
  }

  function setupReadingAreaClick() {
    dom.reading.addEventListener('click', function(e) {
      var wordEl = e.target.closest && e.target.closest('.word');
      if (!wordEl) {
        if (state.anchorEl) hidePopup();
        return;
      }
      lookupWord(wordEl);
    });
  }

  function setupKeyboard() {
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && state.anchorEl) {
        hidePopup();
      }
    });
  }

  function setupResize() {
    window.addEventListener('resize', function() {
      if (state.anchorEl && !isMobile()) {
        if (state.resizeRaf) cancelAnimationFrame(state.resizeRaf);
        state.resizeRaf = requestAnimationFrame(function() { positionPopup(state.anchorEl); });
      }
    });

    window.addEventListener('scroll', function() {
      if (state.anchorEl && !isMobile() && !dom.popup.hidden) {
        if (state.resizeRaf) cancelAnimationFrame(state.resizeRaf);
        state.resizeRaf = requestAnimationFrame(function() { positionPopup(state.anchorEl); });
      }
    }, { passive: true });
  }

  // ============== Init ==============
  function init() {
    applyTheme(state.theme);
    setupToolbar();
    setupReadingAreaClick();
    setupKeyboard();
    setupResize();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
