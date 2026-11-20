// ===== Lounge TV script for Fully Kiosk Browser (loaded from a file by the loader in Inject JavaScript) =====

// ===== TAB ROTATION: show each tab for a while, reload the one we left in the background =====
// Must match the order of the Start URLs (one per line) in Fully
var TABS = [
  'https://www.flightradar24.com/56.23,10.51/8',
  'https://www.dmi.dk/#radar',
  'https://dpu.flightlogger.net/a/dpu/bookings/overview'
];
var RELOAD_WHEN_LEFT = [false, false, true];  // DMI refreshes itself instead, so its zoom is kept
var SHOW_SECONDS = 60;         // how long each tab is shown
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

    if (!wasCurrent) {
      // Just came into view: refresh the previous tab in the background (if allowed)
      wasCurrent = true;
      var prev = (me - 1 + TABS.length) % TABS.length;
      if (prev !== me && RELOAD_WHEN_LEFT[prev]) fully.loadUrlInTabByIndex(prev, TABS[prev]);
    }

    // Login or 2FA code on screen: wait so someone can type it
    if (tvLoginFieldVisible() && held < MAX_LOGIN_HOLD) { held++; return; }
    held = 0;

    shown++;
    if (shown >= SHOW_SECONDS) {
      shown = 0;
      fully.focusTabByIndex((me + 1) % TABS.length);
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

// ===== DMI: keep panel closed + radar playing; zoom once when first on screen; refresh data every 10 min =====
if (location.hostname.endsWith('dmi.dk')) {
  var dmiZoomed = false;
  var dmiSeconds = 0;
  var dmiVisibleTicks = 0;
  var DMI_REFRESH_SECONDS = 600;
  var DMI_ZOOM_AFTER_VISIBLE = 3;   // seconds the tab must be on screen before zooming

  function zoomAt(xPct, yPct, amount) {
    var vp = document.querySelector('#new-map-viewer .ol-viewport');
    if (!vp) return false;
    var r = vp.getBoundingClientRect();
    if (r.width < 100 || r.height < 100) return false;
    vp.dispatchEvent(new WheelEvent('wheel', {
      deltaY: -(amount || 300), deltaMode: 0, bubbles: true, cancelable: true,
      clientX: r.left + r.width * xPct, clientY: r.top + r.height * yPct
    }));
    return true;
  }

  setInterval(function () {
    dmiSeconds++;
    var radar = document.querySelector('#map-radar');
    if (!radar) return;

    var closer = radar.querySelector('.map-menu2021-menu-wrapper.expanded .map-menu2021-menu-closer');
    if (closer) { closer.click(); return; }

    var playIcon = radar.querySelector('.playbutton .icon-play');
    if (playIcon) { playIcon.click(); return; }

    // zoom once, after this tab has been on screen for a few seconds (a hidden map ignores the zoom)
    if (tvIsCurrentTab()) dmiVisibleTicks++; else dmiVisibleTicks = 0;
    if (!dmiZoomed && dmiVisibleTicks >= DMI_ZOOM_AFTER_VISIBLE && zoomAt(0.42, 0.45)) {
      dmiZoomed = true;
      console.log('TV: DMI zoom applied');
    }

    // refresh radar data with DMI's own button instead of reloading the page
    if (dmiSeconds >= DMI_REFRESH_SECONDS) {
      dmiSeconds = 0;
      var reload = radar.querySelector('.reload-button');
      if (reload) reload.click();
    }
  }, 1000);
}

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
