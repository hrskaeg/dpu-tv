// ===== Lounge TV script for Fully Kiosk Browser (loaded from a file by the loader in Inject JavaScript) =====

// ===== TAB ROTATION: show each tab for 3 minutes, then go to the next one =====
// The tabs are the Start URLs in Fully (one per line), in that order. To keep the two screens
// from showing the same page, give each stick the same pages in a different order.
var SHOW_SECONDS = 180;            // how long each tab is shown
var MAX_LOGIN_HOLD = 15 * 60;      // max seconds to hold on a login / 2FA screen

function tvIsCurrentTab() {
  return typeof fully === 'undefined' || fully.getCurrentTabIndex() === fully.getThisTabIndex();
}

function tvLoginFieldVisible() {
  var fields = document.querySelectorAll(
    'input[type="password"], input[autocomplete="one-time-code"], ' +
    'input[name*="otp" i], input[id*="otp" i]'
  );
  for (var i = 0; i < fields.length; i++) {
    if (fields[i].offsetParent !== null) return true;
  }
  return false;
}

(function () {
  if (typeof fully === 'undefined') return;   // JavaScript Interface not enabled
  var me = fully.getThisTabIndex();
  var shown = 0;   // seconds this tab has been showing
  var held = 0;    // seconds spent waiting on a login screen

  setInterval(function () {
    if (fully.getCurrentTabIndex() !== me) { shown = 0; held = 0; return; }

    // Login or 2FA code on screen: wait so someone can type it
    if (tvLoginFieldVisible() && held < MAX_LOGIN_HOLD) { held++; return; }

    shown++;
    if (shown < SHOW_SECONDS) return;
    shown = 0;

    var count = 1;
    try { count = JSON.parse(fully.getTabList()).length; } catch (e) {}
    if (count > 1) fully.focusTabByIndex((me + 1) % count);
  }, 1000);
})();

// ===== All sites: accept cookie pop-ups automatically (first 60 seconds after load) =====
(function () {
  var TEXTS = ['agree and close', 'accepter alle', 'accepter', 'tillad alle', 'tillad alle cookies',
               'godkend alle', 'ok, forstået', 'accept all', 'accept all cookies', 'accept',
               'allow all', 'agree', 'i agree'];
  var n = 0;
  var t = setInterval(function () {
    n++;
    var els = document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]');
    for (var i = 0; i < els.length; i++) {
      var txt = (els[i].innerText || els[i].value || '').trim().toLowerCase();
      if (TEXTS.indexOf(txt) !== -1 && els[i].offsetParent !== null) {
        els[i].click();
        clearInterval(t);
        return;
      }
    }
    if (n > 60) clearInterval(t);
  }, 1000);
})();

// ===== FlightLogger: zoom, remove the navbar, toolbar at the top =====
// Adjust live in the console: TV.zoom, TV.space (>= 0), TV.shift (may be negative)
// Kept light on purpose: all tabs share one WebView renderer, and the earlier version
// (re-zooming and checking every element every second) froze it, so Fully restarted.
if (location.hostname.endsWith('flightlogger.net')) {
  window.TV = window.TV || { zoom: '0.65', space: '0px', shift: '-97px' };
  var flPinned = [];        // the toolbar element(s) we moved to the top
  var flLastScan = 0;

  function flSet(style, prop, value) {
    if (style[prop] !== value) style[prop] = value;   // only touch the page when something changed
  }

  function flFindToolbar() {
    flPinned = [];
    document.querySelectorAll('body *').forEach(function (el) {
      var s = getComputedStyle(el);
      if (s.position !== 'sticky' && s.position !== 'fixed') return;
      var r = el.getBoundingClientRect();
      if (r.height > 40 && r.height < 120 && r.top < 300) flPinned.push(el);
    });
  }

  setInterval(function () {
    var body = document.body;
    if (!body) return;
    flSet(document.documentElement.style, 'zoom', window.TV.zoom);
    flSet(body.style, 'marginTop', window.TV.shift);
    flSet(body.style, 'paddingTop', window.TV.space);
    var nav = document.querySelector('.fl-navbar');
    if (nav) flSet(nav.style, 'display', 'none');

    // Look for the toolbar only until it is found (or if the page replaced it), at most every 5 s
    var lost = !flPinned.length || flPinned.some(function (el) { return !el.isConnected; });
    if (lost && Date.now() - flLastScan > 5000) { flLastScan = Date.now(); flFindToolbar(); }
    flPinned.forEach(function (el) { flSet(el.style, 'top', '0px'); });
  }, 1000);
}

// ===== FlightLogger: reload in the background once it has been shown, so it has new bookings next time =====
if (location.hostname.endsWith('flightlogger.net') && typeof fully !== 'undefined') {
  (function () {
    var wasShown = false;
    setInterval(function () {
      if (tvIsCurrentTab()) { wasShown = true; return; }
      if (wasShown) { wasShown = false; location.reload(); }
    }, 1000);
  })();
}
