/* 71 McLean Road — site behavior. Vanilla JS, no dependencies.
   1) Hero slideshow (pausable, off when prefers-reduced-motion)
   2) Accessible full-screen photo viewer (dialog, focus trap, keys, swipe)
   3) "Request a tour" wiring from data attributes on #visit */
(function () {
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------------------------- 1) Hero ---------------------------- */
  (function hero() {
    var slides = Array.prototype.slice.call(document.querySelectorAll(".hero-slide"));
    var toggle = document.querySelector(".hero-toggle");
    if (slides.length < 2 || !toggle) return;
    var label = toggle.querySelector(".visually-hidden");
    var idx = 0, timer = null, userPaused = false, DELAY = 6500;

    function show(n) {
      slides[idx].classList.remove("is-active");
      slides[idx].setAttribute("aria-hidden", "true");
      idx = (n + slides.length) % slides.length;
      var s = slides[idx], img = s.querySelector("img");
      if (img && img.loading === "lazy") img.loading = "eager";
      s.classList.add("is-active");
      s.removeAttribute("aria-hidden");
    }
    function play() { stop(); timer = window.setInterval(function () { show(idx + 1); }, DELAY); setState(false); }
    function stop() { if (timer) window.clearInterval(timer); timer = null; }
    function setState(paused) {
      toggle.setAttribute("aria-pressed", paused ? "true" : "false");
      label.textContent = paused ? "Play slideshow" : "Pause slideshow";
    }
    toggle.hidden = false;
    toggle.addEventListener("click", function () {
      if (timer) { userPaused = true; stop(); setState(true); }
      else { userPaused = false; play(); }
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else if (!userPaused && !reduceMotion.matches) play();
    });
    // Warm the next slides after load so crossfades never show a blank.
    window.addEventListener("load", function () {
      slides.forEach(function (s) { var i = s.querySelector("img"); if (i) i.loading = "eager"; });
    });
    if (reduceMotion.matches) { setState(true); userPaused = true; } else { play(); }
  })();

  /* ------------------------- 2) Lightbox --------------------------- */
  (function lightbox() {
    var dlg = document.getElementById("lightbox");
    var thumbs = Array.prototype.slice.call(document.querySelectorAll(".thumb"));
    if (!dlg || !thumbs.length || typeof dlg.showModal !== "function") return;
    var img = document.getElementById("lb-img");
    var source = document.getElementById("lb-source");
    var caption = document.getElementById("lb-caption");
    var counter = document.getElementById("lb-counter");
    var btnClose = dlg.querySelector(".lb-close");
    var btnPrev = dlg.querySelector(".lb-prev");
    var btnNext = dlg.querySelector(".lb-next");
    var photos = thumbs.map(function (t) {
      var ti = t.querySelector("img");
      return { jpg: t.getAttribute("data-full"), webp: t.getAttribute("data-full-webp"), alt: ti ? ti.alt : "" };
    });
    var current = 0, opener = null;

    function render(n) {
      current = (n + photos.length) % photos.length;
      var p = photos[current];
      img.classList.add("is-loading");
      source.srcset = p.webp;
      img.src = p.jpg;
      img.alt = p.alt;
      caption.textContent = p.alt;
      counter.textContent = "Photo " + (current + 1) + " of " + photos.length;
      // Preload neighbours for instant paging.
      [current + 1, current - 1].forEach(function (k) {
        var q = photos[(k + photos.length) % photos.length]; var pre = new Image(); pre.src = q.jpg;
      });
    }
    img.addEventListener("load", function () { img.classList.remove("is-loading"); });

    function open(n, from) {
      opener = from || document.activeElement;
      render(n);
      dlg.showModal();
      document.body.classList.add("lb-open");
      btnClose.focus();
    }
    function close() { if (dlg.open) dlg.close(); }
    dlg.addEventListener("close", function () {
      document.body.classList.remove("lb-open");
      if (opener && typeof opener.focus === "function") opener.focus();
    });

    thumbs.forEach(function (t, i) { t.addEventListener("click", function () { open(i, t); }); });
    btnClose.addEventListener("click", close);
    btnPrev.addEventListener("click", function () { render(current - 1); });
    btnNext.addEventListener("click", function () { render(current + 1); });
    // Click on the dark area (not on the photo or a control) closes.
    dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.classList.contains("lb-figure")) close(); });

    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); render(current + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); render(current - 1); }
      else if (e.key === "Home") { e.preventDefault(); render(0); }
      else if (e.key === "End") { e.preventDefault(); render(photos.length - 1); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Tab") {
        // Focus trap: cycle between the viewer's own controls.
        var f = [btnClose, btnPrev, btnNext];
        var i = f.indexOf(document.activeElement);
        e.preventDefault();
        var next = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === -1 || i === f.length - 1 ? 0 : i + 1);
        f[next].focus();
      }
    });

    // Swipe on touch screens.
    var x0 = null, y0 = null;
    dlg.addEventListener("touchstart", function (e) { var t = e.changedTouches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
    dlg.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) render(current + (dx < 0 ? 1 : -1));
      x0 = y0 = null;
    }, { passive: true });
  })();

  /* ------------------------ 3) Tour request ------------------------ */
  (function tourRequest() {
    var section = document.getElementById("visit");
    var btn = document.getElementById("tour-request");
    var call = document.getElementById("tour-call");
    var note = document.getElementById("tour-note");
    if (!section || !btn) return;
    // Main button links to Cal.com in the HTML. Optional extras from data attributes.
    var email = (section.getAttribute("data-email") || "").trim();
    var phone = (section.getAttribute("data-phone") || "").trim();
    var mail = document.getElementById("tour-email");
    if (email && mail) {
      var subject = "Tour request: 71 McLean Road";
      var body = "Hi,\n\nI'd like to tour 71 McLean Road, Weaverville.\n\nDays/times that work for me:\n\nName:\nPhone:\n\nThanks!";
      mail.href = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      mail.hidden = false;
    }
    if (phone && call) {
      call.href = "tel:" + phone.replace(/[^+\d]/g, "");
      call.hidden = false;
    }
  })();
})();
