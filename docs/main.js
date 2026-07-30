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
  var contact = document.getElementById('contact-link');
  if (contact) {
    var u = contact.dataset.u;
    var d = contact.dataset.d;
    var addr = u + '@' + d;
    contact.href = 'ma' + 'il' + 'to:' + addr;
    contact.textContent = addr;
  }

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
        if (match) {
          pre.setAttribute('data-language', match[1]);
        }
      }
    });
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
