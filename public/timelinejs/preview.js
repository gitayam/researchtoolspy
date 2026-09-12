(function () {
  'use strict';
  var nonce = location.hash.slice(1);
  var status = document.getElementById('preview-status');
  if (window.parent === window || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce)) return;
  var accepted = false;
  var finished = false;
  function signal(type) { window.parent.postMessage({ type: type, nonce: nonce }, '*'); }
  function fail() { throw new Error('Invalid presentation'); }
  function record(value, required, optional) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
    if (required.some(function (key) { return !Object.prototype.hasOwnProperty.call(value, key); })) fail();
    if (Object.keys(value).some(function (key) { return required.indexOf(key) === -1 && (optional || []).indexOf(key) === -1; })) fail();
    return value;
  }
  function text(value, max, paragraphs) {
    if (typeof value !== 'string' || value.length > max) fail();
    // Only adapter-generated formatting is permitted; human markup must be escaped.
    if (/[<>]/.test(paragraphs ? value.replace(/<\/?(?:p|strong)>/g, '') : value)) fail();
    return value;
  }
  function textBlock(value, headlineLimit) {
    record(value, ['headline', 'text']);
    return { headline: text(value.headline, headlineLimit, false), text: text(value.text, 131072, true) };
  }
  function date(value) {
    record(value, ['year'], ['month', 'day', 'hour', 'minute', 'second']);
    var result = {};
    var bounds = { year: [0, 9999], month: [1, 12], day: [1, 31], hour: [0, 23], minute: [0, 59], second: [0, 59] };
    Object.keys(value).forEach(function (key) {
      if (!Number.isInteger(value[key]) || value[key] < bounds[key][0] || value[key] > bounds[key][1]) fail();
      result[key] = value[key];
    });
    if (value.day !== undefined && value.month === undefined) fail();
    if ((value.hour !== undefined || value.minute !== undefined || value.second !== undefined) && value.day === undefined) fail();
    if ((value.hour === undefined) !== (value.minute === undefined) || (value.second !== undefined && value.minute === undefined)) fail();
    if (value.day !== undefined) {
      var leap = value.year % 4 === 0 && (value.year % 100 !== 0 || value.year % 400 === 0);
      var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (value.day > days[value.month - 1]) fail();
    }
    return result;
  }
  function projection(value) {
    record(value, ['title', 'events', 'scale']);
    if (value.scale !== 'human' || !Array.isArray(value.events) || value.events.length < 1 || value.events.length > 100) fail();
    record(value.title, ['text', 'unique_id', 'autolink']);
    if (value.title.unique_id !== 'narrative-title' || value.title.autolink !== false) fail();
    var ids = new Set();
    return {
      scale: 'human',
      title: { text: textBlock(value.title.text, 60000), unique_id: 'narrative-title', autolink: false },
      events: value.events.map(function (item) {
        record(item, ['start_date', 'text', 'unique_id', 'display_date', 'autolink'], ['group']);
        if (item.autolink !== false || typeof item.unique_id !== 'string' || item.unique_id.length > 606 || !item.unique_id.startsWith('event-') || ids.has(item.unique_id)) fail();
        var decoded = decodeURIComponent(item.unique_id.slice(6));
        if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(decoded) || 'event-' + encodeURIComponent(decoded) !== item.unique_id) fail();
        ids.add(item.unique_id);
        var copy = { start_date: date(item.start_date), text: textBlock(item.text, 6000), unique_id: item.unique_id, display_date: text(item.display_date, 1000, false), autolink: false };
        if (item.group !== undefined) copy.group = text(item.group, 8000, false);
        return copy;
      })
    };
  }
  function reportError() {
    if (finished) return;
    finished = true;
    status.hidden = false;
    status.textContent = 'Presentation unavailable. Return to the export preview to retry or use the native event list.';
    signal('timelinejs:error');
  }
  window.addEventListener('message', function (event) {
    if (accepted || event.source !== window.parent || !event.data || event.data.type !== 'timelinejs:render' || event.data.nonce !== nonce) return;
    try {
      var message = record(event.data, ['type', 'nonce', 'timeline', 'theme', 'startAtEnd']);
      if ((message.theme !== 'light' && message.theme !== 'dark') || typeof message.startAtEnd !== 'boolean') fail();
      var data = projection(message.timeline);
      accepted = true;
      finished = false;
      document.documentElement.dataset.theme = message.theme;
      status.textContent = 'Loading local TimelineJS presentation…';
      var controls = document.getElementById('presentation-controls');
      var previous = document.getElementById('previous-slide');
      var next = document.getElementById('next-slide');
      var position = document.getElementById('slide-position');
      var orderedIds = ['narrative-title'].concat(data.events.slice().sort(function (a, b) {
        var fields = ['year', 'month', 'day', 'hour', 'minute', 'second'];
        for (var i = 0; i < fields.length; i++) {
          var key = fields[i], fallback = key === 'month' || key === 'day' ? 1 : 0;
          var difference = (a.start_date[key] === undefined ? fallback : a.start_date[key]) - (b.start_date[key] === undefined ? fallback : b.start_date[key]);
          if (difference) return difference;
        }
        return 0;
      }).map(function (item) { return item.unique_id; }));
      var timeline = new window.TL.Timeline('timeline', data, {
        script_path: new URL('/vendor/timelinejs/3.9.13/', location.href).href,
        font: null, theme: null, language: 'en', ga_measurement_id: null, ga_property_id: null,
        track_events: [], hash_bookmark: false, soundcite: false,
        timenav_height_min: 90, timenav_mobile_height_percentage: 30, slide_padding_lr: 24,
        start_at_end: message.startAtEnd,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1000
      });
      function updateControls() {
        var slide = timeline.getCurrentSlide();
        var index = orderedIds.indexOf(slide && slide.data && slide.data.unique_id);
        previous.disabled = index <= 0;
        next.disabled = index < 0 || index === orderedIds.length - 1;
        position.textContent = index < 0 ? 'Slide position unavailable' : 'Slide ' + (index + 1) + ' of ' + orderedIds.length;
      }
      previous.addEventListener('click', function () { if (!previous.disabled) timeline.goToPrev(); });
      next.addEventListener('click', function () { if (!next.disabled) timeline.goToNext(); });
      timeline.on('change', updateControls);
      timeline.on('loaded', function () {
        if (finished) return;
        finished = true;
        status.hidden = true;
        updateControls();
        controls.hidden = false;
        signal('timelinejs:loaded');
      });
      timeline.on('error', reportError);
    } catch (_) { reportError(); }
  });
  signal('timelinejs:ready');
}());
