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
