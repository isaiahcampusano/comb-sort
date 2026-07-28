const state = {
  stocksPayload: null,
  stepsPayload: null,
  resultsPayload: null,
  recordsByTicker: new Map(),
  initialOrder: [],
  currentOrder: [],
  stepIndex: -1,
  timerId: null,
  isPlaying: false,
  speedValue: 3,
  reverseFinalView: false,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
};

const speedLabels = {
  1: { label: "Slow study", delay: 1600 },
  2: { label: "Measured", delay: 1050 },
  3: { label: "Steady", delay: 700 },
  4: { label: "Quick", delay: 400 },
  5: { label: "Fast review", delay: 180 },
};

const elements = {
  chart: document.getElementById("chart"),
  sequenceTrack: document.getElementById("sequence-track"),
  stepText: document.getElementById("step-text"),
  resultsBody: document.getElementById("results-body"),
  resultsNote: document.getElementById("results-note"),
  stageStatus: document.getElementById("stage-status"),
  stageSpeed: document.getElementById("stage-speed"),
  metaSource: document.getElementById("meta-source"),
  metaGenerated: document.getElementById("meta-generated"),
  startBtn: document.getElementById("start-btn"),
  pauseBtn: document.getElementById("pause-btn"),
  nextBtn: document.getElementById("next-btn"),
  resetBtn: document.getElementById("reset-btn"),
  speedRange: document.getElementById("speed-range"),
  ascendingToggle: document.getElementById("ascending-toggle"),
  statItems: document.getElementById("stat-items"),
  statComparisons: document.getElementById("stat-comparisons"),
  statSwaps: document.getElementById("stat-swaps"),
  statCurrentGap: document.getElementById("stat-current-gap"),
  statSteps: document.getElementById("stat-steps"),
  statTime: document.getElementById("stat-time"),
  statProgress: document.getElementById("stat-progress"),
};

const formatPct = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getStats() {
  return state.stepsPayload?.stats ?? state.resultsPayload?.stats ?? null;
}

function getCurrentStep() {
  if (!state.stepsPayload || state.stepIndex < 0) {
    return null;
  }
  return state.stepsPayload.steps[state.stepIndex] ?? null;
}

function getChartRecords() {
  return state.currentOrder.map((ticker) => state.recordsByTicker.get(ticker)).filter(Boolean);
}

function updateControls() {
  const totalSteps = state.stepsPayload?.steps.length ?? 0;
  const atEnd = totalSteps === 0 || state.stepIndex >= totalSteps - 1;

  document.body.classList.toggle("is-playing", state.isPlaying);
  elements.startBtn.disabled = state.isPlaying || atEnd;
  elements.pauseBtn.disabled = !state.isPlaying;
  elements.nextBtn.disabled = state.isPlaying || atEnd;
  elements.resetBtn.disabled = false;
}

function formatGeneratedDate(rawValue) {
  if (!rawValue || rawValue === "fixture") {
    return "Fixture dataset";
  }

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    return rawValue;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function renderMetadata() {
  const metadata = state.stocksPayload?.metadata;
  if (!metadata) {
    return;
  }

  elements.metaSource.textContent = metadata.source;
  elements.metaGenerated.textContent = formatGeneratedDate(metadata.generated_at);
}

function renderSequence() {
  const currentStep = getCurrentStep();
  const activeTickers = currentStep
    ? new Set([currentStep.left_ticker, currentStep.right_ticker])
    : new Set();

  elements.sequenceTrack.innerHTML = state.currentOrder
    .map((ticker) => {
      const classes = ["sequence-chip"];
      if (activeTickers.has(ticker)) {
        classes.push("is-comparing");
      }

      return `<span class="${classes.join(" ")}">${ticker}</span>`;
    })
    .join("");
}

function renderChart() {
  const records = getChartRecords();
  const currentStep = getCurrentStep();
  const activeTickers = currentStep
    ? new Set([currentStep.left_ticker, currentStep.right_ticker])
    : new Set();
  const positiveMax = Math.max(...records.map((record) => Math.max(record.return_pct, 0)), 0);
  const negativeMax = Math.max(...records.map((record) => Math.max(-record.return_pct, 0)), 0);
  const totalMagnitude = positiveMax + negativeMax || 1;
  const positiveZone = positiveMax > 0 ? (positiveMax / totalMagnitude) * 100 : 50;
  const negativeZone = 100 - positiveZone;

  elements.chart.innerHTML = records
    .map((record) => {
      const isPositive = record.return_pct >= 0;
      const positiveHeight = positiveMax > 0 && isPositive ? (record.return_pct / positiveMax) * 100 : 0;
      const negativeHeight = negativeMax > 0 && !isPositive ? (Math.abs(record.return_pct) / negativeMax) * 100 : 0;
      const classes = ["chart-column"];

      if (activeTickers.has(record.ticker)) {
        classes.push("is-comparing");
      }

      if (currentStep?.swapped && activeTickers.has(record.ticker)) {
        classes.push("is-swapping");
      }

      const sign = record.return_pct >= 0 ? "+" : "";

      return `
        <div class="${classes.join(" ")}">
          <div class="chart-column__meter">
            <div class="chart-column__zone chart-column__zone--positive" style="height:${positiveZone}%;">
              ${isPositive ? `<span class="chart-column__bar" style="height:${positiveHeight}%"></span>` : ""}
            </div>
            <div class="chart-column__zone chart-column__zone--negative" style="height:${negativeZone}%;">
              ${!isPositive ? `<span class="chart-column__bar chart-column__bar--negative" style="height:${negativeHeight}%"></span>` : ""}
            </div>
          </div>
          <div class="chart-column__label">
            <span class="chart-column__ticker">${record.ticker}</span>
            <span class="chart-column__value">${sign}${formatPct.format(record.return_pct)}%</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderResults() {
  const baseResults = state.resultsPayload?.results ?? [];
  const displayResults = state.reverseFinalView ? [...baseResults].reverse() : baseResults;

  elements.resultsBody.innerHTML = displayResults
    .map((record, index) => {
      const rank = state.reverseFinalView ? displayResults.length - index : index + 1;
      const sign = record.return_pct >= 0 ? "+" : "";
      const returnClass = record.return_pct >= 0 ? "return-positive" : "return-negative";
      return `
        <tr>
          <td class="num">${rank}</td>
          <td>${record.ticker}</td>
          <td>${record.company}</td>
          <td>${record.sector}</td>
          <td class="num">${formatMoney.format(record.start_close)}</td>
          <td class="num">${formatMoney.format(record.end_close)}</td>
          <td class="num ${returnClass}">${sign}${formatPct.format(record.return_pct)}%</td>
        </tr>
      `;
    })
    .join("");
}

function renderStats() {
  const stats = getStats();
  const currentStep = getCurrentStep();
  if (!stats) {
    return;
  }

  const totalSteps = state.stepsPayload?.steps.length ?? 0;
  const completedSteps = currentStep ? currentStep.step : 0;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  elements.statItems.textContent = String(stats.item_count);
  elements.statComparisons.textContent = String(stats.comparisons);
  elements.statSwaps.textContent = String(stats.swaps);
  elements.statCurrentGap.textContent = currentStep ? String(currentStep.gap) : String(stats.initial_gap);
  elements.statSteps.textContent = String(totalSteps);
  elements.statTime.textContent = `${stats.execution_time_ms} ms`;
  elements.statProgress.textContent = `${progressPct}%`;
}

function renderStatusLine() {
  const stats = getStats();
  const currentStep = getCurrentStep();
  const speed = speedLabels[state.speedValue]?.label ?? "Steady";

  if (!stats) {
    elements.stageStatus.textContent = "Loading prepared stock data...";
    return;
  }

  if (!currentStep) {
    elements.stageStatus.textContent =
      `Comb Sort | ${stats.item_count} stocks | ${state.stepsPayload.steps.length} recorded steps | waiting to start`;
    return;
  }

  elements.stageStatus.textContent =
    `Comb Sort | step ${currentStep.step}/${state.stepsPayload.steps.length} | gap ${currentStep.gap} | ` +
    `${stats.comparisons} total comparisons | speed ${speed.toLowerCase()}`;
}

function describeStep() {
  const currentStep = getCurrentStep();

  if (!currentStep) {
    elements.stepText.innerHTML =
      `Gap: not started. The bars and chips are still showing the original unsorted order.` +
      `<span class="step-count">Press Start sort or Next step to begin the replay.</span>`;
    return;
  }

  const leftRecord = state.recordsByTicker.get(currentStep.left_ticker);
  const rightRecord = state.recordsByTicker.get(currentStep.right_ticker);
  const outcome = currentStep.swapped
    ? `${leftRecord.ticker} moved behind ${rightRecord.ticker} because its return was lower.`
    : `${leftRecord.ticker} stayed ahead because it was already in the correct order relative to ${rightRecord.ticker}.`;

  elements.stepText.innerHTML =
    `Gap ${currentStep.gap}: comparing ${leftRecord.ticker} (${formatPct.format(leftRecord.return_pct)}%) ` +
    `with ${rightRecord.ticker} (${formatPct.format(rightRecord.return_pct)}%). ${outcome}` +
    `<span class="step-count">Step ${currentStep.step} of ${state.stepsPayload.steps.length}</span>`;
}

function renderResultsNote() {
  const totalSteps = state.stepsPayload?.steps.length ?? 0;
  const finished = totalSteps > 0 && state.stepIndex >= totalSteps - 1;

  elements.resultsNote.textContent = finished
    ? "Replay complete. The stage order and the table below now match the final Python output."
    : "This table is the authoritative sorted result written by the Python pipeline.";
}

function syncView() {
  renderMetadata();
  renderSequence();
  renderChart();
  renderResults();
  renderStats();
  renderStatusLine();
  renderResultsNote();
  describeStep();
  updateControls();
}

function stopPlayback() {
  state.isPlaying = false;
  if (state.timerId !== null) {
    window.clearTimeout(state.timerId);
    state.timerId = null;
  }
  updateControls();
}

function resetPlayback() {
  stopPlayback();
  state.stepIndex = -1;
  state.currentOrder = [...state.initialOrder];
  syncView();
}

function applyStep(stepIndex) {
  const step = state.stepsPayload?.steps?.[stepIndex];
  if (!step) {
    return false;
  }

  state.stepIndex = stepIndex;
  state.currentOrder = [...step.snapshot];
  syncView();
  return true;
}

function advanceStep() {
  const didAdvance = applyStep(state.stepIndex + 1);
  if (!didAdvance) {
    stopPlayback();
  }
  return didAdvance;
}

function getStepDelay() {
  if (state.reducedMotion) {
    return 0;
  }
  return speedLabels[state.speedValue]?.delay ?? speedLabels[3].delay;
}

function playbackTick() {
  const advanced = advanceStep();
  if (!advanced) {
    return;
  }

  if (state.stepIndex >= state.stepsPayload.steps.length - 1) {
    stopPlayback();
    return;
  }

  state.timerId = window.setTimeout(playbackTick, getStepDelay());
}

function startPlayback() {
  if (state.isPlaying) {
    return;
  }
  state.isPlaying = true;
  updateControls();
  playbackTick();
}

function updateSpeedReadout() {
  const speed = speedLabels[state.speedValue]?.label ?? "Steady";
  elements.stageSpeed.textContent = `Speed: ${speed.toLowerCase()}`;
}

function attachEvents() {
  elements.startBtn.addEventListener("click", startPlayback);
  elements.pauseBtn.addEventListener("click", stopPlayback);
  elements.nextBtn.addEventListener("click", () => {
    stopPlayback();
    advanceStep();
  });
  elements.resetBtn.addEventListener("click", resetPlayback);
  elements.speedRange.addEventListener("input", (event) => {
    state.speedValue = Number(event.target.value);
    updateSpeedReadout();
    renderStatusLine();
  });
  elements.ascendingToggle.addEventListener("change", (event) => {
    state.reverseFinalView = event.target.checked;
    renderResults();
  });
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

async function bootstrap() {
  try {
    const [stocksPayload, stepsPayload, resultsPayload] = await Promise.all([
      loadJson("./data/stocks.json"),
      loadJson("./data/sort_steps.json"),
      loadJson("./data/sorted_results.json"),
    ]);

    state.stocksPayload = stocksPayload;
    state.stepsPayload = stepsPayload;
    state.resultsPayload = resultsPayload;
    state.initialOrder = stocksPayload.stocks.map((stock) => stock.ticker);
    state.currentOrder = [...state.initialOrder];
    state.recordsByTicker = new Map(stocksPayload.stocks.map((stock) => [stock.ticker, stock]));

    attachEvents();
    updateSpeedReadout();
    syncView();
  } catch (error) {
    elements.stageStatus.textContent = `Unable to load prepared data: ${error.message}`;
    elements.stepText.textContent = `Unable to load prepared data: ${error.message}`;
  }
}

bootstrap();
