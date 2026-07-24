(function () {
  'use strict';

  // --- Theme toggle ---------------------------------------------------------
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      localStorage.setItem('theme', next);
    });
  }

  // Follow OS changes unless the user picked a theme explicitly.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!localStorage.getItem('theme')) {
      root.dataset.theme = e.matches ? 'dark' : 'light';
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
})();
