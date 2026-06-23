/* ============================================================
   Stillpoint — app logic
   ============================================================ */
(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- settings ---------- */
  const settings = {
    sound:  load("sp_sound", true),
    haptic: load("sp_haptic", true),
  };
  function load(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : v === "1"; } catch { return d; } }
  function save(k, v){ try { localStorage.setItem(k, v ? "1" : "0"); } catch {} }

  /* ---------- audio (soft sine cues, no files) ---------- */
  let actx = null;
  function audio(){
    if (!settings.sound) return null;
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function tone(freq, dur = 0.6, vol = 0.12, glideTo = null){
    const ctx = audio(); if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function buzz(ms){ if (settings.haptic && navigator.vibrate) navigator.vibrate(ms); }

  function cue(kind){
    if (kind === "in")      { tone(392, 0.9, 0.10, 466); buzz(28); }
    else if (kind === "out"){ tone(294, 1.3, 0.11, 220); buzz(18); }
    else if (kind === "hold"){ tone(330, 0.4, 0.05); buzz(12); }
    else if (kind === "tap"){ tone(523, 0.18, 0.08); buzz(14); }
    else if (kind === "tense"){ tone(440, 0.4, 0.09); buzz(30); }
    else if (kind === "release"){ tone(294, 1.0, 0.10, 233); buzz(16); }
    else if (kind === "done"){ tone(392, 0.5, 0.09); setTimeout(() => tone(523, 0.8, 0.09), 240); buzz([30, 60, 30]); }
  }

  /* ---------- routing ---------- */
  const screens = $$(".screen");
  function go(id){
    screens.forEach(s => s.classList.toggle("is-active", s.id === id));
    stopAll(id);
    const el = $("#" + id);
    if (el) el.scrollTop = 0;
    window.scrollTo(0, 0);
    if (el) el.focus({ preventScroll: true });
    if (id === "categories") resetCategories();
    if (id === "senses") resetSenses();
    if (id === "pmr") resetPmr();
    if (id === "move") resetMove();
  }
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-go]");
    if (!t) return;
    const dest = t.dataset.go;
    if (t.dataset.ex) pendingEx = t.dataset.ex;
    go(dest);
    if (dest === "player") startPlayer(pendingEx);
  });

  function stopAll(except){
    if (except !== "player") stopBreath();
    if (except !== "pmr") stopPmr();
    if (except !== "move") stopMove();
  }

  /* ============================================================
     BREATHING ENGINE
     ============================================================ */
  const BREATHING = {
    box: { name: "Box breathing",
      hint: "Breathe in as the orb grows, hold, out as it falls, hold.",
      phases: [
        { label: "Breathe in", dur: 4, scale: 1.0, k: "in" },
        { label: "Hold",       dur: 4, scale: 1.0, k: "hold" },
        { label: "Breathe out",dur: 4, scale: 0.5, k: "out" },
        { label: "Hold",       dur: 4, scale: 0.5, k: "hold" },
      ] },
    "478": { name: "4-7-8 breathing",
      hint: "The long exhale is the part that calms you — let it be slow.",
      phases: [
        { label: "Breathe in", dur: 4, scale: 1.0, k: "in" },
        { label: "Hold",       dur: 7, scale: 1.0, k: "hold" },
        { label: "Breathe out",dur: 8, scale: 0.45, k: "out" },
      ] },
    sigh: { name: "Physiological sigh",
      hint: "Two breaths in through the nose, one long breath out through the mouth.",
      phases: [
        { label: "Breathe in",        dur: 2.4, scale: 0.84, k: "in" },
        { label: "Sip a little more", dur: 1.1, scale: 1.0,  k: "in" },
        { label: "Long breath out",   dur: 6.0, scale: 0.42, k: "out" },
        { label: "Rest",              dur: 1.6, scale: 0.42, k: "hold" },
      ] },
  };
  const RING_C = 691.15;
  let pendingEx = "box";
  const breath = { ex: null, i: 0, cycles: 0, running: false, timer: null };

  const orb = $("#orb"), ringFill = $("#ring-fill"), phaseLabel = $("#phase-label");
  const breathToggle = $("#breath-toggle"), breathDone = $("#breath-done");
  const breathName = $("#breath-name"), breathHint = $("#breath-hint"), cycleCount = $("#cycle-count");

  function startPlayer(exKey){
    const ex = BREATHING[exKey] || BREATHING.box;
    breath.ex = ex; breath.i = 0; breath.cycles = 0; breath.running = false;
    breathName.textContent = ex.name;
    breathHint.textContent = ex.hint;
    cycleCount.textContent = "0";
    phaseLabel.textContent = "Ready when you are";
    phaseLabel.style.opacity = "1";
    orb.style.transition = "none";
    orb.style.transform = "scale(0.5)";
    ringFill.style.transition = "none";
    ringFill.style.strokeDashoffset = RING_C;
    breathToggle.textContent = "Begin";
    breathDone.hidden = true;
  }

  function runPhase(){
    if (!breath.running) return;
    const p = breath.ex.phases[breath.i];
    phaseLabel.textContent = p.label;
    cue(p.k);

    if (reduceMotion){
      orb.style.transition = "transform .6s linear, opacity .6s linear";
    } else {
      orb.style.transition = `transform ${p.dur}s cubic-bezier(.4,0,.2,1)`;
    }
    // force reflow so the new transition applies
    void orb.offsetWidth;
    orb.style.transform = `scale(${p.scale})`;

    // ring fills over the phase
    ringFill.style.transition = "none";
    ringFill.style.strokeDashoffset = RING_C;
    void ringFill.offsetWidth;
    ringFill.style.transition = `stroke-dashoffset ${p.dur}s linear`;
    ringFill.style.strokeDashoffset = "0";

    breath.timer = setTimeout(() => {
      breath.i++;
      if (breath.i >= breath.ex.phases.length){
        breath.i = 0;
        breath.cycles++;
        cycleCount.textContent = String(breath.cycles);
      }
      runPhase();
    }, p.dur * 1000);
  }

  function playBreath(){
    breath.running = true;
    breathToggle.textContent = "Pause";
    breathDone.hidden = false;
    audio(); // unlock on gesture
    runPhase();
  }
  function pauseBreath(){
    breath.running = false;
    clearTimeout(breath.timer);
    // freeze orb + ring where they are
    const m = getComputedStyle(orb).transform;
    orb.style.transition = "none"; orb.style.transform = m;
    const off = getComputedStyle(ringFill).strokeDashoffset;
    ringFill.style.transition = "none"; ringFill.style.strokeDashoffset = off;
    phaseLabel.textContent = "Paused";
    breathToggle.textContent = "Resume";
  }
  function stopBreath(){
    breath.running = false;
    clearTimeout(breath.timer);
  }
  breathToggle.addEventListener("click", () => {
    if (breath.running) pauseBreath();
    else playBreath();
  });
  breathDone.addEventListener("click", () => { cue("done"); go("home"); });

  /* ============================================================
     5-4-3-2-1
     ============================================================ */
  const SENSES = [
    { n: 5, prompt: "Five things you can see",   hint: "Look around the room — colours, shapes, small details." },
    { n: 4, prompt: "Four things you can feel",  hint: "Texture, temperature, the chair, your feet on the floor." },
    { n: 3, prompt: "Three things you can hear", hint: "Near and far — let the quiet sounds count too." },
    { n: 2, prompt: "Two things you can smell",  hint: "Or two scents you'd like to be near right now." },
    { n: 1, prompt: "One thing you can taste",   hint: "Or just one slow, deliberate breath." },
  ];
  let senseStep = 0;
  const senseProgress = $("#sense-progress"), sensePrompt = $("#sense-prompt"),
        senseHint = $("#sense-hint"), senseDots = $("#sense-dots"), senseNext = $("#sense-next");

  function resetSenses(){ senseStep = 0; renderSenses(); }
  function renderSenses(){
    const s = SENSES[senseStep];
    senseProgress.textContent = `${senseStep + 1} of 5`;
    sensePrompt.textContent = s.prompt;
    senseHint.textContent = s.hint;
    senseNext.textContent = senseStep === SENSES.length - 1 ? "Finish" : "Next sense";
    senseNext.disabled = true;
    senseDots.innerHTML = "";
    let filled = 0;
    for (let i = 0; i < s.n; i++){
      const d = document.createElement("button");
      d.className = "dot"; d.type = "button";
      d.setAttribute("aria-label", `Noticed ${i + 1}`);
      d.addEventListener("click", () => {
        if (d.classList.contains("filled")) return;
        d.classList.add("filled");
        d.textContent = "✓";
        cue("tap");
        filled++;
        if (filled >= s.n) senseNext.disabled = false;
      });
      senseDots.appendChild(d);
    }
  }
  senseNext.addEventListener("click", () => {
    if (senseStep < SENSES.length - 1){ senseStep++; renderSenses(); }
    else { cue("done"); go("home"); }
  });

  /* ============================================================
     CATEGORIES
     ============================================================ */
  const CATEGORIES = [
    "Coffee brewing methods", "Chess openings", "Fountain pen brands",
    "Cities you've visited", "Things that are blue", "Fruits",
    "Dog breeds", "Films you love", "Board games",
    "Trees", "Composers", "Breakfast foods",
  ];
  const catPick = $("#cat-pick"), catRun = $("#cat-run"), catGrid = $("#cat-grid"),
        catTitle = $("#cat-title"), catTally = $("#cat-tally"), catAdd = $("#cat-add"), catBack = $("#cat-back");
  let catCount = 0;

  function resetCategories(){
    catRun.hidden = true; catPick.hidden = false;
    catGrid.innerHTML = "";
    CATEGORIES.forEach(c => {
      const b = document.createElement("button");
      b.className = "cat-chip"; b.type = "button"; b.textContent = c;
      b.addEventListener("click", () => {
        catTitle.textContent = c; catCount = 0; catTally.textContent = "0";
        catPick.hidden = true; catRun.hidden = false;
      });
      catGrid.appendChild(b);
    });
  }
  catAdd.addEventListener("click", () => { catCount++; catTally.textContent = String(catCount); cue("tap"); });
  catBack.addEventListener("click", resetCategories);

  /* ============================================================
     PROGRESSIVE MUSCLE RELAXATION
     ============================================================ */
  const PMR_GROUPS = [
    "Hands & forearms", "Upper arms", "Shoulders", "Forehead & eyes",
    "Jaw & face", "Neck", "Chest & upper back", "Stomach",
    "Hips & glutes", "Thighs", "Calves", "Feet & toes",
  ];
  const PMR_RING_C = 326.73;
  const TENSE = 5, RELEASE = 10;
  const pmr = { i: 0, phase: null, running: false, timer: null, t0: 0, remain: 0 };
  const pmrProgress = $("#pmr-progress"), pmrGroup = $("#pmr-group"), pmrCue = $("#pmr-cue"),
        pmrRing = $("#pmr-ring"), pmrTimer = $("#pmr-timer"), pmrToggle = $("#pmr-toggle"), pmrSkip = $("#pmr-skip");

  function resetPmr(){
    pmr.i = 0; pmr.phase = null; pmr.running = false; clearTimeout(pmr.timer);
    pmrProgress.textContent = "Ready";
    pmrGroup.textContent = PMR_GROUPS[0];
    pmrCue.textContent = "Press start when you're settled.";
    pmrTimer.textContent = "";
    pmrRing.style.transition = "none"; pmrRing.style.strokeDashoffset = PMR_RING_C;
    pmrToggle.textContent = "Begin"; pmrSkip.hidden = true;
  }
  function pmrTick(secsLeft){
    pmrTimer.textContent = Math.ceil(secsLeft);
  }
  function pmrPhase(kind, dur){
    pmr.phase = kind;
    pmr.remain = dur; pmr.t0 = Date.now();
    pmrCue.textContent = kind === "tense"
      ? "Squeeze tight — and hold"
      : "Let go… soften completely";
    cue(kind);
    pmrRing.style.transition = "none"; pmrRing.style.strokeDashoffset = PMR_RING_C;
    void pmrRing.offsetWidth;
    pmrRing.style.transition = `stroke-dashoffset ${dur}s linear`;
    pmrRing.style.strokeDashoffset = "0";
    pmrTick(dur);
    const iv = setInterval(() => {
      const left = dur - (Date.now() - pmr.t0) / 1000;
      if (left <= 0 || !pmr.running){ clearInterval(iv); }
      else pmrTick(left);
    }, 200);
    pmr.timer = setTimeout(() => {
      clearInterval(iv);
      if (!pmr.running) return;
      if (kind === "tense") pmrPhase("release", RELEASE);
      else nextPmrGroup();
    }, dur * 1000);
  }
  function nextPmrGroup(){
    pmr.i++;
    if (pmr.i >= PMR_GROUPS.length){
      pmr.running = false;
      pmrGroup.textContent = "All the way down";
      pmrCue.textContent = "Notice how the body feels now.";
      pmrProgress.textContent = "Complete";
      pmrTimer.textContent = "";
      pmrRing.style.strokeDashoffset = "0";
      pmrToggle.textContent = "Begin again"; pmrSkip.hidden = true;
      cue("done");
      pmr.i = 0; pmr.phase = null;
      return;
    }
    pmrGroup.textContent = PMR_GROUPS[pmr.i];
    pmrProgress.textContent = `${pmr.i + 1} of ${PMR_GROUPS.length}`;
    pmrPhase("tense", TENSE);
  }
  function startPmr(){
    pmr.running = true;
    pmrToggle.textContent = "Pause"; pmrSkip.hidden = false;
    if (pmr.phase === null){
      pmrProgress.textContent = `1 of ${PMR_GROUPS.length}`;
      pmrGroup.textContent = PMR_GROUPS[pmr.i];
      pmrPhase("tense", TENSE);
    } else {
      pmrPhase(pmr.phase, Math.max(1, pmr.remain || (pmr.phase === "tense" ? TENSE : RELEASE)));
    }
  }
  function pausePmr(){
    pmr.running = false; clearTimeout(pmr.timer);
    pmr.remain = Math.max(1, Math.ceil(pmr.remain - (Date.now() - pmr.t0) / 1000));
    const off = getComputedStyle(pmrRing).strokeDashoffset;
    pmrRing.style.transition = "none"; pmrRing.style.strokeDashoffset = off;
    pmrCue.textContent = "Paused";
    pmrToggle.textContent = "Resume";
  }
  function stopPmr(){ pmr.running = false; clearTimeout(pmr.timer); }
  pmrToggle.addEventListener("click", () => {
    audio();
    if (pmr.running) pausePmr();
    else if (pmrToggle.textContent === "Begin again"){ resetPmr(); startPmr(); }
    else startPmr();
  });
  pmrSkip.addEventListener("click", () => {
    if (!pmr.running) return;
    clearTimeout(pmr.timer);
    nextPmrGroup();
  });

  /* ============================================================
     MOVEMENT (5 minutes)
     ============================================================ */
  const MOVE_TOTAL = 300, MOVE_RING_C = 326.73;
  const MOVE_PROMPTS = [
    "Stand up and roll your shoulders back",
    "Shake out your hands and arms",
    "Reach up tall, then fold gently forward",
    "Walk a slow lap of the room",
    "Loosen your neck, side to side",
    "Sway, march in place — keep it easy",
  ];
  const move = { left: MOVE_TOTAL, running: false, timer: null, t0: 0, pi: 0, pTimer: null };
  const moveTimer = $("#move-timer"), moveRing = $("#move-ring"),
        moveToggle = $("#move-toggle"), moveReset = $("#move-reset"), moveHint = $("#move-hint");

  function fmt(s){ const m = Math.floor(s / 60), ss = Math.floor(s % 60); return `${m}:${String(ss).padStart(2, "0")}`; }
  function resetMove(){
    move.running = false; clearTimeout(move.timer); clearInterval(move.pTimer);
    move.left = MOVE_TOTAL; move.pi = 0;
    moveTimer.textContent = fmt(MOVE_TOTAL);
    moveHint.textContent = MOVE_PROMPTS[0];
    moveRing.style.transition = "none"; moveRing.style.strokeDashoffset = MOVE_RING_C;
    moveToggle.textContent = "Begin"; moveReset.hidden = true;
  }
  function startMove(){
    move.running = true; move.t0 = Date.now();
    moveToggle.textContent = "Pause"; moveReset.hidden = false;
    audio();
    const startLeft = move.left;
    const elapsed = MOVE_TOTAL - startLeft;
    moveRing.style.transition = "none";
    moveRing.style.strokeDashoffset = MOVE_RING_C * (startLeft / MOVE_TOTAL);
    void moveRing.offsetWidth;
    moveRing.style.transition = `stroke-dashoffset ${startLeft}s linear`;
    moveRing.style.strokeDashoffset = "0";

    move.timer = setInterval(() => {
      const left = startLeft - (Date.now() - move.t0) / 1000;
      if (left <= 0){
        moveTimer.textContent = "0:00";
        clearInterval(move.timer); clearInterval(move.pTimer);
        move.running = false; move.left = 0;
        moveHint.textContent = "Nicely done — notice how that feels.";
        moveToggle.textContent = "Begin"; moveReset.hidden = false;
        cue("done");
        return;
      }
      move.left = left;
      moveTimer.textContent = fmt(left);
    }, 250);

    // rotate prompts every ~48s
    move.pTimer = setInterval(() => {
      move.pi = (move.pi + 1) % MOVE_PROMPTS.length;
      moveHint.textContent = MOVE_PROMPTS[move.pi];
      cue("hold");
    }, 48000);
  }
  function pauseMove(){
    move.running = false; clearInterval(move.timer); clearInterval(move.pTimer);
    const off = getComputedStyle(moveRing).strokeDashoffset;
    moveRing.style.transition = "none"; moveRing.style.strokeDashoffset = off;
    moveToggle.textContent = "Resume";
  }
  function stopMove(){ move.running = false; clearInterval(move.timer); clearInterval(move.pTimer); }
  moveToggle.addEventListener("click", () => {
    if (move.running) pauseMove();
    else if (move.left <= 0) { resetMove(); startMove(); }
    else startMove();
  });
  moveReset.addEventListener("click", resetMove);

  /* ============================================================
     SETTINGS SHEET
     ============================================================ */
  const sheet = $("#sheet"), optSound = $("#opt-sound"), optHaptic = $("#opt-haptic");
  optSound.checked = settings.sound; optHaptic.checked = settings.haptic;
  $("#open-settings").addEventListener("click", () => { sheet.hidden = false; });
  $("#sheet-close").addEventListener("click", () => { sheet.hidden = true; });
  sheet.addEventListener("click", e => { if (e.target === sheet) sheet.hidden = true; });
  optSound.addEventListener("change", () => { settings.sound = optSound.checked; save("sp_sound", settings.sound); if (settings.sound) cue("tap"); });
  optHaptic.addEventListener("change", () => { settings.haptic = optHaptic.checked; save("sp_haptic", settings.haptic); if (settings.haptic) buzz(20); });

  /* ---------- greeting by time of day ---------- */
  const h = new Date().getHours();
  const greet = h < 5 ? "It's late. Let's slow things down."
    : h < 12 ? "Let's start the day a little slower."
    : h < 18 ? "Take a slower minute."
    : "Let's wind the day down gently.";
  $("#greeting").textContent = greet;

  /* ---------- service worker ---------- */
  if ("serviceWorker" in navigator){
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();
