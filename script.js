const DEMO_DURATION_MS = 20_000;
const REAL_REPEAT_DELAY_MS = 30_000;
const DEMO_REPEAT_DELAY_MS = 2_000;
const COMPLETION_SOUND_COUNT = 5;

const slider = document.querySelector("#duration-slider");
const durationOutput = document.querySelector("#duration-output");
const demoMode = document.querySelector("#demo-mode");
const sessionMessage = document.querySelector("#session-message");
const startButton = document.querySelector("#start-button");
const resetButton = document.querySelector("#reset-button");
const cards = [...document.querySelectorAll(".hourglass-card")];

let selectedHours = Number(slider.value);
let activeCard = null;
let session = null;
let animationFrame = null;
let repeatSoundTimeouts = [];
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
  // Draw past the chamber edges and let each SVG clip path shape the sand to
  // the curved glass boundary without leaving an artificial inner gutter.
  const upperSurface = 28 + (1 - upperPercent / 78) * 110;
  const lowerSurface = 292 - (lowerPercent / 78) * 114;
  const upperSand = card.querySelector(".upper-sand");
  const lowerSand = card.querySelector(".lower-sand");
  upperSand.querySelector(".sand-body").setAttribute(
    "d",
    `M 15 ${upperSurface + 7} Q 90 ${upperSurface - 5} 165 ${upperSurface + 7} L 165 165 L 15 165 Z`,
  );
  lowerSand.querySelector(".sand-body").setAttribute(
    "d",
    `M 15 ${lowerSurface + 7} Q 90 ${lowerSurface - 6} 165 ${lowerSurface + 7} L 165 305 L 15 305 Z`,
  );
  upperSand.style.opacity = upperPercent > 0.5 ? "1" : "0";
  lowerSand.style.opacity = lowerPercent > 0.5 ? "1" : "0";
}

function createSandGrains() {
  const upperPositions = [
    [48, 48, 3.1], [78, 63, 2.7], [117, 50, 3.2], [137, 77, 2.5],
    [61, 91, 2.4], [99, 82, 3], [126, 104, 2.7], [48, 113, 2.8],
    [78, 121, 2.4], [108, 116, 2.5], [140, 126, 2.2],
  ];
  const lowerPositions = [
    [50, 273, 2.5], [73, 260, 3], [105, 269, 2.5], [132, 277, 2.8],
    [62, 245, 2.4], [91, 251, 3.1], [119, 237, 2.5], [83, 228, 2.4],
    [108, 220, 2.6], [72, 282, 2.4], [127, 286, 2.7],
  ];
  const fallingPositions = [[87, 155, 2.3], [93, 159, 2.7], [89, 164, 2.1], [94, 169, 2.4], [88, 173, 2.2]];
  cards.forEach((card) => {
    const svg = card.querySelector(".glass-frame");
    const addCircles = (selector, positions) => {
      const group = svg.querySelector(selector);
      positions.forEach(([cx, cy, r]) => {
        const grain = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        grain.setAttribute("cx", cx);
        grain.setAttribute("cy", cy);
        grain.setAttribute("r", r);
        group.appendChild(grain);
      });
    };
    addCircles(".upper-grains", upperPositions);
    addCircles(".lower-grains", lowerPositions);
    addCircles(".falling-grains", fallingPositions);
  });
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
    gain.gain.exponentialRampToValueAtTime(0.9, audioContext.currentTime + 0.02);
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
  repeatSoundTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
  animationFrame = null;
  repeatSoundTimeouts = [];
}

function renderProgress(now) {
  if (!session || session.state !== "running") return;
  const elapsed = now - session.startedAt;
  const progress = Math.min(elapsed / session.durationMs, 1);
  setSand(activeCard, 78 * (1 - progress), 78 * progress);
  activeCard.querySelector(".card-status").textContent = `${formatRemaining(session.durationMs - elapsed)}`;

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
  startButton.disabled = true;
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
  startButton.disabled = false;
  activeCard.querySelector(".card-status").textContent = "Time is up";
  sessionMessage.textContent = "Time is up. The yellow light stays on until you reset the hourglass.";
  playCompletionTone();
  const repeatDelay = session.isDemo ? DEMO_REPEAT_DELAY_MS : REAL_REPEAT_DELAY_MS;
  for (let soundNumber = 1; soundNumber < COMPLETION_SOUND_COUNT; soundNumber += 1) {
    const timeoutId = setTimeout(() => {
      if (session?.state === "complete") playCompletionTone();
    }, repeatDelay * soundNumber);
    repeatSoundTimeouts.push(timeoutId);
  }
}

function resetSession() {
  clearSessionTimers();
  session = null;
  selectedHours = 1;
  slider.value = "1";
  demoMode.checked = false;
  slider.disabled = false;
  demoMode.disabled = false;
  cards.forEach((card) => card.classList.remove("running", "complete", "inactive"));
  startButton.disabled = false;
  updateSelection(false);
  sessionMessage.textContent = "Reset complete. Choose a duration to begin again.";
}

slider.addEventListener("input", () => {
  if (session) return;
  selectedHours = Number(slider.value);
  updateSelection();
});

createSandGrains();
startButton.addEventListener("click", startSession);
resetButton.addEventListener("click", resetSession);

updateSelection(false);
