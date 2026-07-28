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

const speedDelays = {
  1: 1600,
  2: 1050,
  3: 700,
  4: 400,
  5: 180,
};

const elements = {
  tickerTrack: document.getElementById("ticker-tape-track"),
  chart: document.getElementById("chart"),
  stepText: document.getElementById("step-text"),
  resultsPanel: document.getElementById("results-panel"),
  resultsBody: document.getElementById("results-body"),
  startBtn: document.getElementById("start-btn"),
  pauseBtn: document.getElementById("pause-btn"),
  nextBtn: document.getElementById("next-btn"),
  resetBtn: document.getElementById("reset-btn"),
  speedRange: document.getElementById("speed-range"),
  ascendingToggle: document.getElementById("ascending-toggle"),
  statItems: document.getElementById("stat-items"),
  statComparisons: document.getElementById("stat-comparisons"),
  statSwaps: document.getElementById("stat-swaps"),
  statInitialGap: document.getElementById("stat-initial-gap"),
  statCurrentGap: document.getElementById("stat-current-gap"),
  statSteps: document.getElementById("stat-steps"),
  statTime: document.getElementById("stat-time"),
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

function getMaxMagnitude() {
  return getChartRecords().reduce((max, record) => Math.max(max, Math.abs(record.return_pct)), 0) || 1;
}

function updateControls() {
  const totalSteps = state.stepsPayload?.steps.length ?? 0;
  const atEnd = totalSteps === 0 || state.stepIndex >= totalSteps - 1;

  elements.startBtn.disabled = state.isPlaying || atEnd;
  elements.pauseBtn.disabled = !state.isPlaying;
  elements.nextBtn.disabled = state.isPlaying || atEnd;
  elements.resetBtn.disabled = false;
}

function renderTickerTape() {
  const items = state.initialOrder.map((ticker) => {
    const record = state.recordsByTicker.get(ticker);
    const directionClass = record.return_pct >= 0 ? "is-positive" : "is-negative";
    const sign = record.return_pct >= 0 ? "+" : "";
    return `
      <span class="ticker-tape__item ${directionClass}">
        <span class="ticker-tape__symbol">${record.ticker}</span>
        <span class="ticker-tape__change">${sign}${formatPct.format(record.return_pct)}%</span>
      </span>
    `;
  });

  elements.tickerTrack.innerHTML = items.concat(items).join("");
}

function renderChart() {
  const currentStep = getCurrentStep();
  const comparingIndexes = currentStep ? new Set([currentStep.left_index, currentStep.right_index]) : new Set();
  const maxMagnitude = getMaxMagnitude();

  elements.chart.innerHTML = getChartRecords()
    .map((record, index) => {
      const magnitude = Math.abs(record.return_pct) / maxMagnitude;
      const widthPercent = Math.max(4, magnitude * 50);
      const positive = record.return_pct >= 0;
      const barClass = positive ? "bar-row__bar bar-row__bar--positive" : "bar-row__bar bar-row__bar--negative";
      const barStyle = positive ? `width:${widthPercent}%;` : `width:${widthPercent}%;`;
      const valuePosition = positive
        ? `left: calc(50% + min(${widthPercent}%, 42%) + 8px);`
        : `right: calc(50% + min(${widthPercent}%, 42%) + 8px);`;

      const classes = ["bar-row"];
      if (comparingIndexes.has(index)) {
        classes.push("is-comparing");
      }
      if (currentStep?.swapped && comparingIndexes.has(index)) {
        classes.push("is-swapping");
      }
      if (state.stepIndex === (state.stepsPayload?.steps.length ?? 0) - 1) {
        classes.push("is-sorted");
      }

      return `
        <div class="${classes.join(" ")}" data-ticker="${record.ticker}">
          <div class="bar-row__label">
            <span class="bar-row__ticker">${record.ticker}</span>
            <span class="bar-row__company">${record.company}</span>
          </div>
          <div class="bar-row__track" title="${record.company} (${record.sector})">
            <span class="bar-row__zero" aria-hidden="true"></span>
            <span class="${barClass}" style="${barStyle}"></span>
            <span class="bar-row__value" style="${valuePosition}">
              ${record.return_pct >= 0 ? "+" : ""}${formatPct.format(record.return_pct)}%
            </span>
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
      const returnClass = record.return_pct >= 0 ? "return-positive" : "return-negative";
      const sign = record.return_pct >= 0 ? "+" : "";
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

  elements.statItems.textContent = String(stats.item_count);
  elements.statComparisons.textContent = String(stats.comparisons);
  elements.statSwaps.textContent = String(stats.swaps);
  elements.statInitialGap.textContent = String(stats.initial_gap);
  elements.statCurrentGap.textContent = currentStep ? String(currentStep.gap) : String(stats.initial_gap);
  elements.statSteps.textContent = String(state.stepsPayload?.steps.length ?? 0);
  elements.statTime.textContent = `${stats.execution_time_ms} ms`;
}

function describeStep() {
  const currentStep = getCurrentStep();
  if (!currentStep) {
    elements.stepText.innerHTML =
      "Gap: not started. The chart is showing the original unsorted ticker order.<span class=\"step-count\">Use Start sort or Next step to replay the recorded comparisons.</span>";
    return;
  }

  const leftRecord = state.recordsByTicker.get(currentStep.left_ticker);
  const rightRecord = state.recordsByTicker.get(currentStep.right_ticker);
  const outcome = currentStep.swapped
    ? `${currentStep.left_ticker} moved behind ${currentStep.right_ticker} because it had the lower return.`
    : `No swap was needed because ${currentStep.left_ticker} was already ordered correctly relative to ${currentStep.right_ticker}.`;

  elements.stepText.innerHTML = `Gap: ${currentStep.gap}. Comparing ${leftRecord.ticker} at index ${currentStep.left_index} with ${rightRecord.ticker} at index ${currentStep.right_index}. ${outcome}<span class="step-count">Step ${currentStep.step} of ${state.stepsPayload.steps.length}</span>`;
}

function showResultsIfFinished() {
  const totalSteps = state.stepsPayload?.steps.length ?? 0;
  const finished = totalSteps > 0 && state.stepIndex >= totalSteps - 1;
  elements.resultsPanel.hidden = !finished;
}

function syncView() {
  renderChart();
  renderResults();
  renderStats();
  describeStep();
  showResultsIfFinished();
  updateControls();
}

function resetPlayback() {
  state.stepIndex = -1;
  state.currentOrder = [...state.initialOrder];
  stopPlayback();
  syncView();
}

function applyStep(stepIndex) {
  const steps = state.stepsPayload?.steps ?? [];
  const step = steps[stepIndex];
  if (!step) {
    return false;
  }

  state.stepIndex = stepIndex;
  state.currentOrder = [...step.snapshot];
  syncView();
  return true;
}

function advanceStep() {
  const nextIndex = state.stepIndex + 1;
  const didAdvance = applyStep(nextIndex);
  if (!didAdvance) {
    stopPlayback();
  }
  return didAdvance;
}

function getStepDelay() {
  if (state.reducedMotion) {
    return 0;
  }
  return speedDelays[state.speedValue] ?? speedDelays[3];
}

function playbackTick() {
  const advanced = advanceStep();
  if (!advanced) {
    return;
  }
  if (state.stepIndex >= (state.stepsPayload.steps.length - 1)) {
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

function stopPlayback() {
  state.isPlaying = false;
  if (state.timerId !== null) {
    window.clearTimeout(state.timerId);
    state.timerId = null;
  }
  updateControls();
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

    renderTickerTape();
    attachEvents();
    syncView();
  } catch (error) {
    elements.stepText.textContent = `Unable to load prepared data: ${error.message}`;
  }
}

bootstrap();

