(function () {
  var isEmbed = new URLSearchParams(location.search).has('embed') || 
                /\/embed$/.test(location.pathname.replace(/\/$/, '')) ||
                /\/(frame|frame-cat)\//.test(location.pathname);

  var tc = window.__stargazerDarkMode || {};
  var themeMethod = tc.method || 'attribute';
  var themeAttr = tc.attribute || 'color-scheme';
  var themeTarget = tc.target || 'html';
  var themeDark = tc.dark || 'dark';
  var themeLight = tc.light || 'light';

  function applyThemeToDocument(theme) {
    var el = document.querySelector(themeTarget);
    if (!el) return;

    document.documentElement.setAttribute('data-theme', theme);

    var isDark = theme === 'dark';
    var val = isDark ? themeDark : themeLight;
    var other = isDark ? themeLight : themeDark;
    if (themeMethod === 'class') {
      el.classList.remove(other);
      el.classList.add(val);
    } else if (themeMethod === 'data-theme') {
      el.setAttribute('data-theme', val);
    } else {
      el.setAttribute(themeAttr, val);
    }
  }

  if (isEmbed) {
    var saved = localStorage.getItem('sg-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyThemeToDocument(saved || (prefersDark ? 'dark' : 'light'));
    if (tc && Object.keys(tc).length) {
      try { localStorage.setItem('sg-darkMode-config', JSON.stringify(tc)); } catch(e) {}
    }

    window.addEventListener('message', function (e) {
      if (e.data && e.data.sgTheme) {
        applyThemeToDocument(e.data.sgTheme);
        localStorage.setItem('sg-theme', e.data.sgTheme);
      }
      if (e.data && e.data.sgDarkModeConfig) {
        tc = e.data.sgDarkModeConfig;
        themeMethod = tc.method || 'attribute';
        themeAttr = tc.attribute || 'color-scheme';
        themeTarget = tc.target || 'html';
        themeDark = tc.dark || 'dark';
        themeLight = tc.light || 'light';
        try { localStorage.setItem('sg-darkMode-config', JSON.stringify(tc)); } catch(e) {}
        var current = localStorage.getItem('sg-theme') || 'dark';
        applyThemeToDocument(current);
      }
    });

  window.addEventListener('load', function () {
    setTimeout(function () {
      try {
        if (typeof gsap !== 'undefined') {
          gsap.globalTimeline.progress(1);
          if (typeof ScrollTrigger !== 'undefined') {
            ScrollTrigger.getAll().forEach(function (t) { t.progress(1); });
          }
        }
      } catch (e) { }
      document.querySelectorAll('[style*="opacity: 0"]').forEach(function (el) {
        el.style.removeProperty('opacity');
        el.style.removeProperty('transform');
      });
    }, 600);
  });
  return;
}


  var _currentVp = 'full';
  var _currentZoom = 1;
  function pushUrlState(vp, zoom) {
    var url = new URL(location.href);
    url.searchParams.set('vp', String(vp));
    url.searchParams.set('zoom', String(zoom));
    history.replaceState(null, '', url.toString());
  }

  function readUrlState() {
    var params = new URLSearchParams(location.search);
    return {
      vp: params.get('vp'),
      zoom: params.get('zoom'),
    };
  }

  function sendToFrame(msg) {
    var frame = document.getElementById('sg-frame');
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage(msg, '*');
    }
  }

  function applyTransform() {
    var frame = document.getElementById('sg-frame');
    var container = document.querySelector('.sg-iframe-container');
    if (!frame || !container) return;
    
    container.style.overflowX = 'hidden';
    
    var cw = container.clientWidth;
    var ch = container.clientHeight;
    var val = _currentVp;
    var zoom = _currentZoom;

    var zoomGroup = document.getElementById('sg-zoom-group');
    if (zoomGroup) {
      if (val !== 'full' && val <= 1024) {
        zoomGroup.classList.add('show');
      } else {
        zoomGroup.classList.remove('show');
      }
    }

    container.style.display = 'flex';
    container.style.position = '';
    frame.style.position = '';
    frame.style.top = '';
    frame.style.left = '';

    if (val === 'full') {
      frame.style.width = '100%';
      frame.style.minWidth = '';
      frame.style.flexShrink = '';
      frame.style.height = '100%';
      frame.style.transform = '';
      frame.style.transformOrigin = '';
      return;
    }

    var baseScale = val > cw ? cw / val : 1;
    var effectiveScale = baseScale * zoom;

    frame.style.width = val + 'px';
    frame.style.minWidth = val + 'px';
    frame.style.flexShrink = '0';
    frame.style.height = Math.ceil(ch / effectiveScale) + 'px';
    frame.style.transform = 'scale(' + effectiveScale + ')';
    frame.style.transformOrigin = 'top center';
  }

  window.setViewport = function (val) {
    _currentVp = val;
    if (val === 'full' || val > 1024) {
      _currentZoom = 1;
      document.querySelectorAll('.sg-zoom-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      var z100 = document.getElementById('sg-zoom-100');
      if (z100) z100.classList.add('active');
    }
    document.querySelectorAll('.sg-vp-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    var btnId = val === 'full' ? 'sg-vp-full' : 'sg-vp-' + val;
    var btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');
    localStorage.setItem('sg-vp', String(val));
    pushUrlState(val, _currentZoom);
    applyTransform();
  };

  window.setZoom = function (zoom) {
    _currentZoom = zoom;
    document.querySelectorAll('.sg-zoom-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    var zBtn = document.getElementById('sg-zoom-' + Math.round(zoom * 100));
    if (zBtn) zBtn.classList.add('active');
    localStorage.setItem('sg-zoom', String(zoom));
    pushUrlState(_currentVp, zoom);
    applyTransform();
  };

  window.setTheme = function (theme) {
    localStorage.setItem('sg-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    var dark = document.getElementById('sg-btn-dark');
    var light = document.getElementById('sg-btn-light');
    if (dark) dark.classList.toggle('active', theme === 'dark');
    if (light) light.classList.toggle('active', theme === 'light');
    sendToFrame({ sgTheme: theme });
  };

  window.copyProps = function () {
    var raw = window.__stargazerProps;
    if (!raw) return;
    var text = JSON.stringify(raw, null, 2);
    navigator.clipboard.writeText(text).then(function () {
      var btn = document.getElementById('sg-copy-btn');
      if (!btn) return;
      var original = btn.textContent;
      btn.textContent = 'COPIED!';
      btn.style.color = '#DDF160';
      setTimeout(function () {
        btn.textContent = original;
        btn.style.color = '';
      }, 1800);
    });
  };

  document.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

    var zoomLevels = [1, 0.75, 0.5, 0.25];
    var zoomActive = _currentVp !== 'full' && _currentVp <= 1024;

    switch (e.key) {
      case 'f':
      case 'F':
        window.setViewport('full');
        break;
      case 'd':
      case 'D':
        if (document.getElementById('sg-btn-dark')) window.setTheme('dark');
        break;
      case 'l':
      case 'L':
        if (document.getElementById('sg-btn-light')) window.setTheme('light');
        break;
      case '1':
        window.setViewport(2560);
        break;
      case '2':
        window.setViewport(1440);
        break;
      case '3':
        window.setViewport(1024);
        break;
      case '4':
        window.setViewport(780);
        break;
      case '5':
        window.setViewport(390);
        break;
      case '+':
      case '=':
        if (zoomActive) {
          var zi = zoomLevels.indexOf(_currentZoom);
          if (zi > 0) window.setZoom(zoomLevels[zi - 1]);
        }
        break;
      case '-':
        if (zoomActive) {
          var zo = zoomLevels.indexOf(_currentZoom);
          if (zo < zoomLevels.length - 1) window.setZoom(zoomLevels[zo + 1]);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        navigateComponent(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateComponent(1);
        break;
      case 'r':
      case 'R':
        var frame = document.getElementById('sg-frame');
        if (frame && frame.contentWindow) {
          frame.contentWindow.location.reload();
        }
        break;
      case 'c':
      case 'C':
        if (window.copyProps) window.copyProps();
        break;
    }
  });

  function navigateComponent(dir) {
    var links = window.__stargazerNavLinks;
    if (!links || links.length === 0) return;
    var current = location.pathname;
    var idx = links.indexOf(current);
    var next = idx + dir;
    if (next < 0) next = links.length - 1;
    if (next >= links.length) next = 0;
    location.href = links[next];
  }

  window.addEventListener('resize', applyTransform);



  var urlState = readUrlState();
  var savedVp = urlState.vp || localStorage.getItem('sg-vp');
  var savedZoom = urlState.zoom || localStorage.getItem('sg-zoom');
  var savedTheme = localStorage.getItem('sg-theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  var VALID_VPS = ['full', '2560', '1440', '1024', '780', '390'];
  if (savedVp && savedVp !== 'full' && !VALID_VPS.includes(savedVp)) {
    savedVp = null;
    localStorage.removeItem('sg-vp');
  }
  var savedZoomFloat = parseFloat(savedZoom);
  if (savedZoom && (isNaN(savedZoomFloat) || savedZoomFloat <= 0 || savedZoomFloat > 1)) {
    savedZoom = null;
    savedZoomFloat = 1;
    localStorage.removeItem('sg-zoom');
  }

  var themeToggle = document.querySelector('.sg-theme-group');
  if (themeToggle) {
    window.setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
  }
  if (savedZoom && savedVp) {
    _currentZoom = savedZoomFloat;
    window.setViewport(savedVp === 'full' ? 'full' : Number(savedVp));
    if (_currentZoom !== 1) window.setZoom(_currentZoom);
  } else if (savedVp) {
    window.setViewport(savedVp === 'full' ? 'full' : Number(savedVp));
  } else {
    window.setViewport('full');
  }

  var frame = document.getElementById('sg-frame');
  if (frame) {
    frame.addEventListener('load', function () {
      sendToFrame({ sgDarkModeConfig: tc });
      sendToFrame({ sgTheme: localStorage.getItem('sg-theme') || 'dark' });
    });
  }


})();
