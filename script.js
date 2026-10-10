const DEMO_DURATION_MS = 24_000;
const REAL_REPEAT_DELAY_MS = 30_000;
const DEMO_REPEAT_DELAY_MS = 3_000;

const slider = document.querySelector("#duration-slider");
const durationOutput = document.querySelector("#duration-output");
const demoMode = document.querySelector("#demo-mode");
const sessionMessage = document.querySelector("#session-message");
const cards = [...document.querySelectorAll(".hourglass-card")];

let selectedHours = Number(slider.value);
let activeCard = null;
let session = null;
let animationFrame = null;
let repeatSoundTimeout = null;
let audioContext = null;

function formatDuration(hours) {
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function getActiveCard(hours) {
  return hours <= 3 ? cards[0] : hours <= 9 ? cards[1] : cards[2];
}

function setSliderFill() {
  const percent = ((selectedHours - 1) / 15) * 100;
  slider.style.background = `linear-gradient(to right, var(--blue) 0%, var(--blue) ${percent}%, #dde2de ${percent}%, #dde2de 100%)`;
}

function setSand(card, upperPercent, lowerPercent) {
  card.style.setProperty("--upper-sand-level", `${upperPercent}%`);
  card.querySelector(".upper-sand").style.height = `${upperPercent}%`;
  card.querySelector(".lower-sand").style.height = `${lowerPercent}%`;
}

function updateSelection(fillActiveSand = true) {
  activeCard = getActiveCard(selectedHours);
  durationOutput.value = formatDuration(selectedHours);
  durationOutput.textContent = formatDuration(selectedHours);
  setSliderFill();

  cards.forEach((card) => {
    const isActive = card === activeCard;
    card.classList.toggle("active", isActive);
    card.classList.toggle("inactive", !isActive);
    if (!session) {
      card.classList.remove("running", "complete");
      setSand(card, isActive && fillActiveSand ? 78 : 0, 0);
      card.querySelector(".card-status").textContent = isActive ? "Ready when you are" : "Not selected";
    }
  });

  if (!session) {
    sessionMessage.textContent = fillActiveSand
      ? `The ${activeCard.dataset.size} hourglass is filled and ready. The other two stay empty.`
      : "Choose a duration to fill the matching hourglass. The three glasses start empty.";
  }
}

// A short Web Audio tone keeps completion feedback local and avoids an audio file.
function playCompletionTone() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    // Audio is optional feedback and may be unavailable in a restricted browser.
    console.warn("Completion sound could not be played.", error);
  }
}

function clearSessionTimers() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  if (repeatSoundTimeout) clearTimeout(repeatSoundTimeout);
  animationFrame = null;
  repeatSoundTimeout = null;
}

function renderProgress(now) {
  if (!session || session.state !== "running") return;
  const elapsed = now - session.startedAt;
  const progress = Math.min(elapsed / session.durationMs, 1);
  setSand(activeCard, 78 * (1 - progress), 78 * progress);
  activeCard.querySelector(".card-status").textContent = `${formatRemaining(session.durationMs - elapsed)} remaining`;

  if (progress >= 1) {
    completeSession();
    return;
  }
  animationFrame = requestAnimationFrame(renderProgress);
}

function formatRemaining(milliseconds) {
  if (session?.isDemo) return `${Math.ceil(milliseconds / 1000)} sec remaining`;
  const totalMinutes = Math.ceil(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours ? `${hours}h ` : ""}${minutes}m remaining`;
}

function startSession() {
  if (session) return;
  // The click is also the user gesture needed to resume/create the audio context.
  if (audioContext?.state === "suspended") audioContext.resume();
  const isDemo = demoMode.checked;
  const durationMs = isDemo ? DEMO_DURATION_MS : selectedHours * 60 * 60 * 1000;
  setSand(activeCard, 78, 0);
  session = { startedAt: performance.now(), durationMs, isDemo, state: "running" };
  slider.disabled = true;
  demoMode.disabled = true;
  activeCard.classList.add("running");
  activeCard.querySelector(".start-button").disabled = true;
  activeCard.querySelector(".card-status").textContent = "Sand is flowing";
  sessionMessage.textContent = isDemo
    ? "Demo Mode is running — the full session is compressed to 24 seconds."
    : "The hourglass is running. Point to the upper sand before you leave.";
  animationFrame = requestAnimationFrame(renderProgress);
}

function completeSession() {
  if (!session || session.state === "complete") return;
  session.state = "complete";
  clearSessionTimers();
  setSand(activeCard, 0, 78);
  activeCard.classList.remove("running");
  activeCard.classList.add("complete");
  activeCard.querySelector(".start-button").disabled = false;
  activeCard.querySelector(".card-status").textContent = "Time is up";
  sessionMessage.textContent = "Time is up. The yellow light stays on until you reset the hourglass.";
  playCompletionTone();
  repeatSoundTimeout = setTimeout(() => {
    if (session?.state === "complete") playCompletionTone();
  }, session.isDemo ? DEMO_REPEAT_DELAY_MS : REAL_REPEAT_DELAY_MS);
}

function resetSession() {
  clearSessionTimers();
  session = null;
  selectedHours = 1;
  slider.value = "1";
  demoMode.checked = false;
  slider.disabled = false;
  demoMode.disabled = false;
  cards.forEach((card) => {
    card.classList.remove("running", "complete", "inactive");
    card.querySelector(".start-button").disabled = false;
  });
  updateSelection(false);
  sessionMessage.textContent = "Reset complete. Choose a duration to begin again.";
}

slider.addEventListener("input", () => {
  if (session) return;
  selectedHours = Number(slider.value);
  updateSelection();
});

cards.forEach((card) => {
  card.querySelector(".start-button").addEventListener("click", startSession);
  card.querySelector(".reset-button").addEventListener("click", resetSession);
});

updateSelection(false);
