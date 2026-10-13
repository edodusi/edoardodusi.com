(function () {
  'use strict';

  // --- Theme toggle ---------------------------------------------------------
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');

  // The two <meta name="theme-color"> tags are media-scoped, so they track the
  // OS preference and ignore a manual toggle. Point the mobile browser chrome
  // at the theme actually on screen with a third, unscoped tag. The colour is
  // read back from --bg rather than repeated here, so the CSS stays the only
  // place a ground colour is defined.
  function syncThemeColor() {
    var ground = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (!ground) return;

    var tag = document.getElementById('active-theme-color');
    if (!tag) {
      tag = document.createElement('meta');
      tag.id = 'active-theme-color';
      tag.name = 'theme-color';
      document.head.appendChild(tag);
    }
    tag.content = ground;
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    syncThemeColor();
  }

  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('theme', next);
    });
  }

  // Follow OS changes unless the user picked a theme explicitly.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // --- Mobile nav toggle ----------------------------------------------------
  var navToggle = document.getElementById('nav-toggle');
  var navLinks = document.getElementById('nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!open));
      navToggle.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
      navLinks.classList.toggle('is-open', !open);
    });

    // Close menu when a nav link is tapped
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Open menu');
        navLinks.classList.remove('is-open');
      });
    });

    // Close menu on outside click
    document.addEventListener('click', function (e) {
      if (navLinks.classList.contains('is-open') &&
          !navLinks.contains(e.target) &&
          !navToggle.contains(e.target)) {
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Open menu');
        navLinks.classList.remove('is-open');
      }
    });
  }

  // --- Contact email (obfuscated) -------------------------------------------
  // Any [data-u][data-d] link gets its mailto assembled here, so the address
  // never sits in the HTML. data-subject pre-fills the subject; the footer
  // link (#contact-link) also shows the address as its text.
  document.querySelectorAll('a[data-u][data-d]').forEach(function (link) {
    var addr = link.dataset.u + '@' + link.dataset.d;
    var subject = link.dataset.subject ? '?subject=' + encodeURIComponent(link.dataset.subject) : '';
    link.href = 'ma' + 'il' + 'to:' + addr + subject;
    if (link.id === 'contact-link') link.textContent = addr;
  });

  // --- Collapsible lists ----------------------------------------------------
  // [data-collapse="N"] shows the first N rows and reveals N more per click.
  // Year headings (and their lists) hide while every row under them is hidden.
  // Without JS nothing is hidden. Focus moves to the first revealed row so
  // keyboard and screen-reader users land on the new content.
  document.querySelectorAll('[data-collapse]').forEach(function (box) {
    var step = parseInt(box.dataset.collapse, 10) || 8;
    var rows = Array.prototype.slice.call(box.querySelectorAll('li.row'));
    if (rows.length <= step) return;

    var label = box.dataset.label || 'items';
    var shown = step;
    var wrap = document.createElement('div');
    wrap.className = 'list-more';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-sm';
    if (box.id) btn.setAttribute('aria-controls', box.id);
    wrap.appendChild(btn);
    box.parentNode.insertBefore(wrap, box.nextSibling);

    function render() {
      rows.forEach(function (row, i) { row.hidden = i >= shown; });
      box.querySelectorAll('ol, ul').forEach(function (list) {
        var visible = list.querySelector('li.row:not([hidden])');
        list.hidden = !visible;
        var heading = list.previousElementSibling;
        if (heading && heading.classList.contains('year')) heading.hidden = !visible;
      });
      var left = rows.length - shown;
      if (left > 0) {
        btn.textContent = '+ Show ' + Math.min(step, left) + ' more ' + label + ' (' + left + ' left)';
        btn.setAttribute('aria-expanded', 'false');
      } else {
        btn.textContent = '- Show fewer ' + label;
        btn.setAttribute('aria-expanded', 'true');
      }
    }

    btn.addEventListener('click', function () {
      if (shown >= rows.length) {
        shown = step;
        render();
        box.closest('section').scrollIntoView({ block: 'start' });
        return;
      }
      var first = rows[shown];
      shown = Math.min(shown + step, rows.length);
      render();
      first.setAttribute('tabindex', '-1');
      first.focus({ preventScroll: false });
    });

    render();
  });

  // --- Copy-to-clipboard blocks -------------------------------------------
  // [data-copy="id"] copies the text of #id, paragraphs separated by a blank
  // line, so a bio pastes cleanly into a CFP form or a programme.
  function copyText(text, done) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function legacyCopy(text, done) {
    var area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.left = '-999999px';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); done(); } catch (err) { console.error('Copy failed', err); }
    document.body.removeChild(area);
  }

  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    var source = document.getElementById(btn.dataset.copy);
    if (!source) return;
    var original = btn.textContent;
    btn.addEventListener('click', function () {
      var paras = source.querySelectorAll('p');
      var text = paras.length
        ? Array.prototype.map.call(paras, function (p) { return p.textContent.replace(/\s+/g, ' ').trim(); }).join('\n\n')
        : source.textContent.replace(/\s+/g, ' ').trim();
      copyText(text, function () {
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 2000);
      });
    });
  });

  // --- Scroll reveal --------------------------------------------------------
  if ('IntersectionObserver' in window) {
    root.classList.add('reveal-ready');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });

    document.querySelectorAll('.reveal').forEach(function (el) {
      observer.observe(el);
    });
  }

  // --- Footer year ----------------------------------------------------------
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // --- Copy code blocks -----------------------------------------------------
  document.querySelectorAll('.blog-content pre').forEach(function (pre) {
    var btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    
    btn.addEventListener('click', function () {
      var code = pre.querySelector('code').textContent;
      
      var success = function () {
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
          btn.classList.remove('copied');
        }, 2000);
      };

      var fallback = function() {
        var textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          success();
        } catch (err) {
          console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
      };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(code).then(success).catch(fallback);
      } else {
        fallback();
      }
    });

    pre.appendChild(btn);
  });

  // --- Reading Progress -----------------------------------------------
  var blogContent = document.querySelector('.blog-content');
  if (blogContent) {
    // 2. Reading Progress Bar
    var progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      window.addEventListener('scroll', function() {
        var winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        var scrolled = (winScroll / height) * 100;
        progressBar.style.width = scrolled + '%';
      });
    }

    // 3. Language Badges
    document.querySelectorAll('.blog-content pre').forEach(function(pre) {
      var code = pre.querySelector('code');
      if (code && code.className) {
        var match = code.className.match(/language-(\w+)/);
        // Plain output isn't a language; labelling it "TEXT" is just noise.
        if (match && !/^(text|plaintext|txt|output)$/.test(match[1])) {
          pre.setAttribute('data-language', match[1]);
        }
      }
    });

    // 4. Scroll hint on wide code blocks: a right-edge fade while there's
    // more to see, gone once the reader scrolls to the end.
    var codeBlocks = Array.prototype.slice.call(document.querySelectorAll('.blog-content pre'));
    var syncScrollHint = function (pre) {
      var code = pre.querySelector('code');
      if (!code) return;
      var scrollable = code.scrollWidth > code.clientWidth + 1;
      pre.classList.toggle('is-scrollable', scrollable);
      pre.classList.toggle('at-end', scrollable && code.scrollLeft + code.clientWidth >= code.scrollWidth - 1);
    };
    codeBlocks.forEach(function (pre) {
      var code = pre.querySelector('code');
      if (!code) return;
      code.addEventListener('scroll', function () { syncScrollHint(pre); }, { passive: true });
      syncScrollHint(pre);
    });
    window.addEventListener('resize', function () { codeBlocks.forEach(syncScrollHint); });
  }

  // --- Hero parallax ----------------------------------------------------
  // The figure drifts up a little slower than the page, so it reads as sitting
  // behind the type rather than pasted onto it. Deliberately small — a few dozen
  // pixels over the whole hero. Moves the figure as a whole, photo and yellow
  // block together, so the offset between them stays fixed. Skipped entirely
  // when reduced motion is preferred.
  var heroImg = document.querySelector('.hero-figure');
  if (heroImg && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var ticking = false;

    var place = function () {
      var y = window.scrollY || document.documentElement.scrollTop;
      var shift = Math.min(y * 0.12, 46);
      heroImg.style.transform = 'translate3d(0,' + (-shift).toFixed(1) + 'px,0)';
      ticking = false;
    };

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(place);
      }
    }, { passive: true });

    place();
  }
})();
