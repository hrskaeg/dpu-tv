// ===== Lounge TV script for Fully Kiosk Browser (loaded from a file by the loader in Inject JavaScript) =====

// ===== TAB ROTATION: show each tab for a while, reload the one we left in the background =====
// Each stick has its own tab list. Five tabs on one Fire TV stick was too much (the WebView
// renderer kept freezing), so the heavy pages are split: Flightradar24 on one screen, the
// live camera on the other. The lists MUST match each stick's Start URLs (one per line).
var RADAR       = 'https://hrskaeg.github.io/dpu-tv/radar.html';
var FR24        = 'https://www.flightradar24.com/56.23,10.51/8';
var AIRPORT     = 'https://hrskaeg.github.io/dpu-tv/airport.html';
var SLIDES      = 'https://hrskaeg.github.io/dpu-tv/slides.html';
var FLIGHTLOGGER = 'https://dpu.flightlogger.net/a/dpu/bookings/overview';

// Keys are the Fully Device IDs (front page of the admin panel).
// The slideshow sits at a different position on each screen, so the two never show it at once.
var SCREENS = {
  '6e6922e9-6e6922e9': {            // stick .57 (old Samsung TV)
    tabs:   [RADAR, FR24, SLIDES],
    reload: [false, false, false]
  },
  '80639665-80639665': {            // stick .56 (LG)
    tabs:   [SLIDES, AIRPORT, FLIGHTLOGGER],
    reload: [false, false, true]    // FlightLogger: reload after showing, to get new bookings
  }
};
var SHOW_SECONDS = 180;            // how long each tab is shown
var MAX_LOGIN_HOLD = 15 * 60;      // max seconds to hold on a login / 2FA screen

var tvScreen = SCREENS['6e6922e9-6e6922e9'];
try { tvScreen = SCREENS[fully.getDeviceId()] || tvScreen; } catch (e) {}
var TABS = tvScreen.tabs;
var RELOAD_WHEN_LEFT = tvScreen.reload;

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

// Which tab should be showing right now, according to the clock (same clock on both sticks)
function tvScheduledTab(count) {
  return Math.floor(Date.now() / 1000 / SHOW_SECONDS) % count;
}

(function () {
  if (typeof fully === 'undefined') return;   // JavaScript Interface not enabled
  var me = fully.getThisTabIndex();
  var wasCurrent = false;
  var held = 0;

  setInterval(function () {
    var current = fully.getCurrentTabIndex() === me;
    if (!current) { wasCurrent = false; held = 0; return; }

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

    // Only the tab that is showing moves the rotation on
    var target = tvScheduledTab(count);
    if (target !== me) fully.focusTabByIndex(target);
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
