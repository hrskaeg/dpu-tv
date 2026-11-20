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
var SHOW_SECONDS = [180, 180, 180, 180, 180];
// Reload the tab in the background after it has been shown (only FlightLogger needs it;
// our own pages refresh themselves, Flightradar24 updates live and draws slowly)
var RELOAD_WHEN_LEFT = [false, false, false, false, true];
var MAX_LOGIN_HOLD = 15 * 60;  // max seconds to hold on a login / 2FA screen

// The rotation follows the clock, so it stays put across restarts, and each screen is
// shifted by its own offset so the two TVs never show the same thing at the same time.
// Keys are the Fully Device IDs (front page of the admin panel); offset in seconds.
var OFFSET_BY_DEVICE = {
  '6e6922e9-6e6922e9': 0,     // stick .57 (old Samsung TV)
  '80639665-80639665': 360    // stick .56 (LG): two tabs ahead
};

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

// Which tab should be showing right now, according to the clock and this screen's offset
function tvScheduledTab(count) {
  var offset = 0;
  try { offset = OFFSET_BY_DEVICE[fully.getDeviceId()] || 0; } catch (e) {}
  var times = [];
  for (var i = 0; i < count; i++) times.push(SHOW_SECONDS[i] || 60);
  var cycle = times.reduce(function (a, b) { return a + b; }, 0);
  var pos = (Math.floor(Date.now() / 1000) + offset) % cycle;
  for (var j = 0; j < count; j++) {
    if (pos < times[j]) return j;
    pos -= times[j];
  }
  return 0;
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
