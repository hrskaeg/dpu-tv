// ===== Lounge TV script for Fully Kiosk Browser (loaded from a file by the loader in Inject JavaScript) =====

// ===== TAB ROTATION: show each tab for a while, reload the one we left in the background =====
// Must match the order of the Start URLs (one per line) in Fully
var TABS = [
  'https://hrskaeg.github.io/dpu-tv/radar.html',
  'https://www.flightradar24.com/56.23,10.51/8',
  'https://hrskaeg.github.io/dpu-tv/airport.html',
  'https://hrskaeg.github.io/dpu-tv/slides.html',
  'https://dpu.flightlogger.net/a/dpu/bookings/overview'
];
// Seconds each tab is shown, same order as TABS (make the slideshow long enough for all slides)
var SHOW_SECONDS = [60, 60, 60, 60, 60];
// Reload the tab in the background after it has been shown (only FlightLogger needs it;
// our own pages refresh themselves, Flightradar24 updates live and draws slowly)
var RELOAD_WHEN_LEFT = [false, false, false, false, true];
var MAX_LOGIN_HOLD = 15 * 60;  // max seconds to hold on a login / 2FA screen

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
  var wasCurrent = false;
  var shown = 0;
  var held = 0;

  setInterval(function () {
    var current = fully.getCurrentTabIndex() === me;
    if (!current) { wasCurrent = false; shown = 0; held = 0; return; }

    // Count the tabs Fully actually has, so a Start URL list that doesn't match TABS
    // (e.g. while updating the sticks) can't make the rotation jump to a tab that isn't there
    var count = TABS.length;
    try { count = JSON.parse(fully.getTabList()).length || TABS.length; } catch (e) {}

    if (!wasCurrent) {
      // Just came into view: refresh the previous tab in the background (if allowed)
      wasCurrent = true;
      var prev = (me - 1 + count) % count;
      if (count === TABS.length && prev !== me && RELOAD_WHEN_LEFT[prev]) {
        fully.loadUrlInTabByIndex(prev, TABS[prev]);
      }
    }

    // Login or 2FA code on screen: wait so someone can type it
    if (tvLoginFieldVisible() && held < MAX_LOGIN_HOLD) { held++; return; }
    held = 0;

    shown++;
    if (shown >= (SHOW_SECONDS[me] || 60)) {
      shown = 0;
      fully.focusTabByIndex((me + 1) % count);
    }
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
if (location.hostname.endsWith('flightlogger.net')) {
  window.TV = window.TV || { zoom: '0.65', space: '0px', shift: '-97px' };

  setInterval(function () {
    document.body.style.transform = '';
    document.body.style.marginTop = window.TV.shift;
    document.documentElement.style.zoom = '0.74';
    var nav = document.querySelector('.fl-navbar');
    if (nav) nav.style.display = 'none';
    document.querySelectorAll('body *').forEach(function (el) {
      var s = getComputedStyle(el);
      if (s.position !== 'sticky' && s.position !== 'fixed') return;
      var r = el.getBoundingClientRect();
      if ((r.top > 40 && r.top < 80 && r.height > 40) ||
          (r.height > 40 && r.height < 120 && r.top < 300)) {
        el.style.top = '0px';
      }
    });
    document.body.style.paddingTop = window.TV.space;
    document.documentElement.style.zoom = window.TV.zoom;
  }, 1000);
}
