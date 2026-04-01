const BANK_NAME = "Indian Bank";
const BRANCH_NAME = "Sulankurichi";
const CATEGORY_NAMES = ["Agri", "Retail", "KCC", "MSME"];
const APPRAISERS = ["Selvaraj", "NallaThambi", "Raja"];
const LEGACY_APPRAISER_MAP = {
  Appraiser1: "Selvaraj",
  Appraiser2: "NallaThambi",
  Appraiser3: "Raja",
  Nallathambi: "NallaThambi",
};
const DEFAULT_AUTH = { username: "admin", password: "admin123" };
const STATE_KEY = "main";
const SESSION_KEY = "jewel-loan-session";
const STATE_API_URL = "/api/state";

let appState;
let activeModalId = null;
let toastTimer;

const elements = {
  loginView: document.getElementById("loginView"),
  dashboardView: document.getElementById("dashboardView"),
  reportView: document.getElementById("reportView"),
  summaryReportView: document.getElementById("summaryReportView"),
  loginForm: document.getElementById("loginForm"),
  logoutButton: document.getElementById("logoutButton"),
  categorySetupForm: document.getElementById("categorySetupForm"),
  entryForm: document.getElementById("entryForm"),
  manualEntryForm: document.getElementById("manualEntryForm"),
  adjustmentForm: document.getElementById("adjustmentForm"),
  closureForm: document.getElementById("closureForm"),
  shareFilterForm: document.getElementById("shareFilterForm"),
  openReportButton: document.getElementById("openReportButton"),
  openSummaryReportButton: document.getElementById("openSummaryReportButton"),
  backToDashboardButton: document.getElementById("backToDashboardButton"),
  backFromSummaryButton: document.getElementById("backFromSummaryButton"),
  modalOverlay: document.getElementById("modalOverlay"),
  categoryCards: document.getElementById("categoryCards"),
  appraiserCards: document.getElementById("appraiserCards"),
  loanReportBody: document.getElementById("loanReportBody"),
  reportSearchInput: document.getElementById("reportSearchInput"),
  reportFromDate: document.getElementById("reportFromDate"),
  reportToDate: document.getElementById("reportToDate"),
  reportStatusFilter: document.getElementById("reportStatusFilter"),
  reportPdfButton: document.getElementById("reportPdfButton"),
  summaryPeriodFilter: document.getElementById("summaryPeriodFilter"),
  summaryAnchorDate: document.getElementById("summaryAnchorDate"),
  summaryStartDate: document.getElementById("summaryStartDate"),
  summaryEndDate: document.getElementById("summaryEndDate"),
  summaryCategoryFilter: document.getElementById("summaryCategoryFilter"),
  summaryPdfButton: document.getElementById("summaryPdfButton"),
  summaryPngButton: document.getElementById("summaryPngButton"),
  summaryReportBody: document.getElementById("summaryReportBody"),
  summaryRangeLabel: document.getElementById("summaryRangeLabel"),
  summaryCategoryLabel: document.getElementById("summaryCategoryLabel"),
  summaryTrendTitle: document.getElementById("summaryTrendTitle"),
  summaryTrendCanvas: document.getElementById("summaryTrendCanvas"),
  sharePreview: document.getElementById("sharePreview"),
  setupStatus: document.getElementById("setupStatus"),
  closureLoanSummary: document.getElementById("closureLoanSummary"),
  closureLoanId: document.getElementById("closureLoanId"),
  shareDate: document.getElementById("shareDate"),
  toast: document.getElementById("toast"),
  todayStamp: document.getElementById("todayStamp"),
  overallPockets: document.getElementById("overallPockets"),
  overallWeight: document.getElementById("overallWeight"),
  overallAmount: document.getElementById("overallAmount"),
  appraiserPeriod: document.getElementById("appraiserPeriod"),
  exportPdfButton: document.getElementById("exportPdfButton"),
  exportPngButton: document.getElementById("exportPngButton"),
  manualEntryMode: document.getElementById("manualEntryMode"),
  newEntryButton: document.getElementById("newEntryButton"),
};

document.addEventListener("DOMContentLoaded", bootstrap);

async function bootstrap() {
  try {
    appState = await loadState();
    let changed = false;
    ({ state: appState, changed } = ensureAppraiserReset(appState));

    if (changed) {
      await saveState(appState);
    }

    setupStaticDefaults();
    attachEventListeners();
    restoreSession();
    renderAll();
  } catch (error) {
    console.error(error);
    showToast("Unable to load the local database.", "error");
  }
}

function setupStaticDefaults() {
  const today = toDateInputValue(new Date());
  applyDateLimits(today);
  elements.entryForm.elements.date.value = today;
  elements.manualEntryForm.elements.date.value = today;
  elements.adjustmentForm.elements.date.value = today;
  elements.shareDate.value = today;
  elements.summaryAnchorDate.value = today;
  elements.summaryStartDate.value = today;
  elements.summaryEndDate.value = today;
  elements.todayStamp.textContent = formatLongDate(today);
}

function applyDateLimits(maxDate) {
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    input.max = maxDate;

    if (input.value && input.value > maxDate) {
      input.value = maxDate;
    }
  });
}

function attachEventListeners() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.categorySetupForm.addEventListener("submit", handleCategorySetup);
  elements.entryForm.addEventListener("submit", handleNewEntry);
  elements.manualEntryForm.addEventListener("submit", handleManualEntry);
  elements.adjustmentForm.addEventListener("submit", handleOldAdjustment);
  elements.closureForm.addEventListener("submit", handleLoanClosure);
  elements.shareFilterForm.addEventListener("input", renderSharePreview);
  elements.openReportButton.addEventListener("click", () => switchView("report"));
  elements.openSummaryReportButton.addEventListener("click", () => switchView("summary"));
  elements.backToDashboardButton.addEventListener("click", () => switchView("dashboard"));
  elements.backFromSummaryButton.addEventListener("click", () => switchView("dashboard"));
  elements.exportPdfButton.addEventListener("click", exportShareAsPdf);
  elements.exportPngButton.addEventListener("click", exportShareAsPng);
  elements.reportPdfButton.addEventListener("click", exportReportAsPdf);
  elements.summaryPdfButton.addEventListener("click", exportSummaryReportAsPdf);
  elements.summaryPngButton.addEventListener("click", exportSummaryReportAsPng);
  elements.modalOverlay.addEventListener("click", handleOverlayClick);
  elements.reportSearchInput.addEventListener("input", renderLoanReport);
  elements.reportFromDate.addEventListener("input", renderLoanReport);
  elements.reportToDate.addEventListener("input", renderLoanReport);
  elements.reportStatusFilter.addEventListener("change", renderLoanReport);
  elements.summaryPeriodFilter.addEventListener("change", renderSummaryReport);
  elements.summaryAnchorDate.addEventListener("input", renderSummaryReport);
  elements.summaryStartDate.addEventListener("input", renderSummaryReport);
  elements.summaryEndDate.addEventListener("input", renderSummaryReport);
  elements.summaryCategoryFilter.addEventListener("change", renderSummaryReport);

  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const modalId = button.dataset.openModal;

      if (modalId !== "shareModal" && !appState.categoriesInitialized) {
        showToast("Initialize categories before using transactions.", "error");
        return;
      }

      if (modalId === "shareModal") {
        renderSharePreview();
      }

      openModal(modalId);
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeActiveModal);
  });

  document.querySelectorAll("[data-manual-mode]").forEach((button) => {
    button.addEventListener("click", () => setManualEntryMode(button.dataset.manualMode));
  });

  elements.loanReportBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-close-loan]");

    if (!button) {
      return;
    }

    prepareClosureModal(button.dataset.closeLoan);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeModalId) {
      closeActiveModal();
    }
  });
}

function restoreSession() {
  const activeUser = localStorage.getItem(SESSION_KEY);
  const isAuthenticated = activeUser === appState.auth.username;
  switchView(isAuthenticated ? "dashboard" : "login");
}

function switchView(target) {
  elements.loginView.classList.toggle("hidden", target !== "login");
  elements.dashboardView.classList.toggle("hidden", target !== "dashboard");
  elements.reportView.classList.toggle("hidden", target !== "report");
  elements.summaryReportView.classList.toggle("hidden", target !== "summary");

  if (target === "report") {
    renderLoanReport();
  } else if (target === "summary") {
    renderSummaryReport();
  } else if (target === "dashboard") {
    renderDashboard();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const username = elements.loginForm.elements.username.value.trim();
  const password = elements.loginForm.elements.password.value;

  if (username !== appState.auth.username || password !== appState.auth.password) {
    showToast("Invalid username or password.", "error");
    return;
  }

  localStorage.setItem(SESSION_KEY, username);
  elements.loginForm.reset();
  switchView("dashboard");
  showToast("Login successful.", "success");
}

function handleLogout() {
  localStorage.removeItem(SESSION_KEY);
  switchView("login");
  closeActiveModal();
}

async function handleCategorySetup(event) {
  event.preventDefault();

  if (appState.categoriesInitialized) {
    showToast("Categories are already initialized.", "error");
    return;
  }

  const updatedCategories = {};

  for (const category of CATEGORY_NAMES) {
    const pockets = Number(elements.categorySetupForm.elements[`${category}_pockets`].value);
    const weight = Number(elements.categorySetupForm.elements[`${category}_weight`].value);
    const amount = Number(elements.categorySetupForm.elements[`${category}_amount`].value);

    if (
      !Number.isInteger(pockets) ||
      ![weight, amount].every((value) => Number.isFinite(value) && value >= 0) ||
      pockets < 0
    ) {
      showToast(`Enter valid opening values for ${category}.`, "error");
      return;
    }

    updatedCategories[category] = {
      pockets: Math.trunc(pockets),
      weight: roundToThree(weight),
      amount: roundToTwo(amount),
    };
  }

  appState.categories = updatedCategories;
  appState.categoriesInitialized = true;
  appState.categorySetupDate = new Date().toISOString();
  await saveState(appState);
  renderAll();
  showToast("Category balances saved.", "success");
}

async function handleNewEntry(event) {
  event.preventDefault();

  const form = elements.entryForm.elements;
  const cardNumber = form.cardNumber.value.trim();

  if (!appState.categoriesInitialized) {
    showToast("Initialize categories before adding loans.", "error");
    return;
  }

  if (appState.loans.some((loan) => loan.cardNumber.toLowerCase() === cardNumber.toLowerCase())) {
    showToast("Card number must be unique.", "error");
    return;
  }

  const weight = Number(form.weight.value);
  const amount = Number(form.amount.value);
  const category = form.category.value;
  const appraiser = form.appraiser.value;

  if (!isPositive(weight) || !isPositive(amount)) {
    showToast("Weight and amount must be greater than zero.", "error");
    return;
  }

  let changed = false;
  ({ state: appState, changed } = ensureAppraiserReset(appState));

  if (changed) {
    showToast("Appraiser counts were reset for the new month.", "success");
  }

  const loan = {
    id: crypto.randomUUID(),
    name: form.name.value.trim(),
    cardNumber,
    date: form.date.value,
    address: form.address.value.trim(),
    weight: roundToThree(weight),
    amount: roundToTwo(amount),
    category,
    appraiser,
    status: "Open",
    pockets: 1,
    createdAt: new Date().toISOString(),
    closingDate: null,
    interestAmount: 0,
    closureTotal: 0,
    closedAt: null,
  };

  if (!loan.name || !loan.address || !loan.date) {
    showToast("Complete all required loan fields.", "error");
    return;
  }

  incrementCategory(category, { pockets: 1, weight: loan.weight, amount: loan.amount });
  appState.loans.push(loan);
  appState.appraiserStats.counts[appraiser] += 1;
  await saveState(appState);
  renderAll();
  closeActiveModal();
  elements.entryForm.reset();
  elements.entryForm.elements.date.value = toDateInputValue(new Date());
  showToast("Loan created successfully.", "success");
}

async function handleManualEntry(event) {
  event.preventDefault();

  if (!appState.categoriesInitialized) {
    showToast("Initialize categories before adding manual balances.", "error");
    return;
  }

  const form = elements.manualEntryForm.elements;
  const entryDate = form.date.value;
  const incomingChanges = getManualChanges("incoming", form);
  const outgoingChanges = getManualChanges("outgoing", form);
  const appraiserCounts = getManualAppraiserCounts(form);

  if (!entryDate) {
    showToast("Select a manual entry date.", "error");
    return;
  }

  if (!incomingChanges.valid) {
    showToast(incomingChanges.message, "error");
    return;
  }

  if (!outgoingChanges.valid) {
    showToast(outgoingChanges.message, "error");
    return;
  }

  if (!appraiserCounts.valid) {
    showToast(appraiserCounts.message, "error");
    return;
  }

  if (!incomingChanges.entries.length || !outgoingChanges.entries.length) {
    showToast("Enter both incoming and outgoing values before saving.", "error");
    return;
  }

  const totalIncomingPockets = incomingChanges.entries.reduce((sum, entry) => sum + entry.pockets, 0);
  const totalAppraiserCount = APPRAISERS.reduce((sum, appraiser) => sum + appraiserCounts.counts[appraiser], 0);

  if (totalAppraiserCount !== totalIncomingPockets) {
    showToast("Incoming appraiser count must match the total incoming pockets.", "error");
    return;
  }

  let changed = false;
  ({ state: appState, changed } = ensureAppraiserReset(appState));

  for (const category of CATEGORY_NAMES) {
    const currentCategory = appState.categories[category];
    const incoming = incomingChanges.entries.find((entry) => entry.category === category) || { pockets: 0, weight: 0, amount: 0 };
    const outgoing = outgoingChanges.entries.find((entry) => entry.category === category) || { pockets: 0, weight: 0, amount: 0 };

    if (
      currentCategory.pockets + incoming.pockets < outgoing.pockets ||
      roundToThree(currentCategory.weight + incoming.weight) < outgoing.weight ||
      roundToTwo(currentCategory.amount + incoming.amount) < outgoing.amount
    ) {
      showToast(`Outgoing entry exceeds ${category} balance after incoming posting.`, "error");
      return;
    }
  }

  for (const change of incomingChanges.entries) {
    incrementCategory(change.category, change);
  }

  for (const change of outgoingChanges.entries) {
    decrementCategory(change.category, change);
  }

  APPRAISERS.forEach((appraiser) => {
    appState.appraiserStats.counts[appraiser] += appraiserCounts.counts[appraiser];
  });

  appState.manualEntries.push({
    id: crypto.randomUUID(),
    date: entryDate,
    createdAt: new Date().toISOString(),
    type: "combined",
    incomingEntries: incomingChanges.entries,
    outgoingEntries: outgoingChanges.entries,
    incomingAppraiserCounts: appraiserCounts.counts,
  });

  await saveState(appState);
  renderAll();
  closeActiveModal();
  resetManualEntryForm();
  showToast(changed ? "Manual entry saved and appraiser counts reset for the new month." : "Manual incoming and outgoing entry saved.", "success");
}

async function handleOldAdjustment(event) {
  event.preventDefault();

  if (!appState.categoriesInitialized) {
    showToast("Initialize categories before adjusting totals.", "error");
    return;
  }

  const form = elements.adjustmentForm.elements;
  const pockets = Number(form.pockets.value);
  const weight = Number(form.weight.value);
  const amount = Number(form.amount.value);
  const category = form.category.value;

  if (!Number.isInteger(pockets) || pockets < 1 || ![weight, amount].every(isPositive)) {
    showToast("All adjustment values must be greater than zero.", "error");
    return;
  }

  const currentCategory = appState.categories[category];
  if (
    currentCategory.pockets < pockets ||
    currentCategory.weight < weight ||
    currentCategory.amount < amount
  ) {
    showToast("Adjustment exceeds the selected category balance.", "error");
    return;
  }

  decrementCategory(category, {
    pockets: Math.trunc(pockets),
    weight: roundToThree(weight),
    amount: roundToTwo(amount),
  });

  appState.adjustments.push({
    id: crypto.randomUUID(),
    date: form.date.value,
    category,
    pockets: Math.trunc(pockets),
    weight: roundToThree(weight),
    amount: roundToTwo(amount),
    createdAt: new Date().toISOString(),
  });

  await saveState(appState);
  renderAll();
  closeActiveModal();
  elements.adjustmentForm.reset();
  elements.adjustmentForm.elements.date.value = toDateInputValue(new Date());
  showToast("Old adjustment saved.", "success");
}

function prepareClosureModal(loanId) {
  const loan = appState.loans.find((item) => item.id === loanId);

  if (!loan || loan.status === "Closed") {
    showToast("This loan is already closed.", "error");
    return;
  }

  elements.closureLoanId.value = loan.id;
  elements.closureForm.elements.closingDate.value = toDateInputValue(new Date());
  elements.closureForm.elements.interestAmount.value = "0";
  elements.closureLoanSummary.innerHTML = `
    <div class="row"><strong>${escapeHtml(loan.name)}</strong><span>${escapeHtml(loan.cardNumber)}</span></div>
    <div class="row"><span>Category</span><span>${escapeHtml(loan.category)}</span></div>
    <div class="row"><span>Weight</span><span>${formatWeight(loan.weight)}</span></div>
    <div class="row"><span>Principal</span><span>${formatCurrency(loan.amount)}</span></div>
  `;
  openModal("closureModal");
}

async function handleLoanClosure(event) {
  event.preventDefault();

  const loanId = elements.closureLoanId.value;
  const loan = appState.loans.find((item) => item.id === loanId);

  if (!loan) {
    showToast("Loan not found.", "error");
    return;
  }

  const interestAmount = Number(elements.closureForm.elements.interestAmount.value);
  const closingDate = elements.closureForm.elements.closingDate.value;

  if (!Number.isFinite(interestAmount) || interestAmount < 0 || !closingDate) {
    showToast("Enter a valid closing date and interest amount.", "error");
    return;
  }

  const currentCategory = appState.categories[loan.category];
  if (
    currentCategory.pockets < 1 ||
    currentCategory.weight < loan.weight ||
    currentCategory.amount < loan.amount
  ) {
    showToast("Closing this loan would create a negative category total.", "error");
    return;
  }

  decrementCategory(loan.category, {
    pockets: 1,
    weight: loan.weight,
    amount: loan.amount,
  });

  loan.status = "Closed";
  loan.closingDate = closingDate;
  loan.interestAmount = roundToTwo(interestAmount);
  loan.closureTotal = roundToTwo(loan.amount + loan.interestAmount);
  loan.closedAt = new Date().toISOString();

  await saveState(appState);
  renderAll();
  closeActiveModal();
  showToast("Loan closed successfully.", "success");
}

function renderAll() {
  renderDashboard();
  renderLoanReport();
  renderSummaryReport();
  renderSharePreview();
}

function renderDashboard() {
  const totals = getOverallTotals();
  elements.overallPockets.textContent = totals.pockets.toString();
  elements.overallWeight.textContent = formatWeight(totals.weight);
  elements.overallAmount.textContent = formatCurrency(totals.amount);
  elements.newEntryButton.disabled = true;
  document.getElementById("categorySetupPanel").classList.toggle("hidden", appState.categoriesInitialized);

  if (appState.categoriesInitialized) {
    elements.setupStatus.textContent = `Saved on ${formatLongDate(appState.categorySetupDate)}`;
    elements.setupStatus.className = "status-pill success";
    Array.from(elements.categorySetupForm.elements).forEach((field) => {
      if (field instanceof HTMLInputElement || field instanceof HTMLButtonElement) {
        field.disabled = true;
      }
    });
  } else {
    elements.setupStatus.textContent = "Pending";
    elements.setupStatus.className = "status-pill neutral";
  }

  elements.categoryCards.innerHTML = CATEGORY_NAMES.map((category) => {
    const item = appState.categories[category];
    return `
      <article class="category-card">
        <div>
          <p class="eyebrow">${category}</p>
          <h3>${category}</h3>
        </div>
        <dl>
          <div class="row"><dt>Pockets</dt><dd>${item.pockets}</dd></div>
          <div class="row"><dt>Weight</dt><dd>${formatWeight(item.weight)}</dd></div>
          <div class="row"><dt>Amount</dt><dd>${formatCurrency(item.amount)}</dd></div>
        </dl>
      </article>
    `;
  }).join("");

  elements.appraiserPeriod.textContent = `Reset period: ${appState.appraiserStats.period}`;
  elements.appraiserCards.innerHTML = APPRAISERS.map((name) => `
    <article class="appraiser-card">
      <div>
        <p class="eyebrow">Appraiser</p>
        <h3>${name}</h3>
      </div>
      <dl>
        <div class="row"><dt>Loans handled</dt><dd>${appState.appraiserStats.counts[name]}</dd></div>
      </dl>
    </article>
  `).join("");

}

function renderLoanReport() {
  const sortedLoans = getFilteredLoans().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  elements.loanReportBody.innerHTML = sortedLoans.length
    ? sortedLoans.map((loan) => `
      <tr>
        <td>${escapeHtml(loan.name)}</td>
        <td>${escapeHtml(loan.cardNumber)}</td>
        <td>${formatShortDate(loan.date)}</td>
        <td>${escapeHtml(loan.category)}</td>
        <td>${escapeHtml(loan.appraiser)}</td>
        <td>${formatWeight(loan.weight)}</td>
        <td>${formatCurrency(loan.amount)}</td>
        <td><span class="table-status ${loan.status.toLowerCase()}">${loan.status}</span></td>
        <td>
          ${
            loan.status === "Open"
              ? `<button type="button" class="mini-button" data-close-loan="${loan.id}">Close</button>`
              : `${formatShortDate(loan.closingDate)} / ${formatCurrency(loan.closureTotal)}`
          }
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="9">No loans match the current filters.</td></tr>';
}

function getFilteredLoans() {
  const searchTerm = elements.reportSearchInput.value.trim().toLowerCase();
  const fromDate = elements.reportFromDate.value;
  const toDate = elements.reportToDate.value;
  const status = elements.reportStatusFilter.value;

  return appState.loans.filter((loan) => {
    const matchesSearch = !searchTerm || [
      loan.name,
      loan.cardNumber,
      loan.category,
      loan.appraiser,
      loan.address,
    ].some((value) => value.toLowerCase().includes(searchTerm));

    const matchesStatus = status === "all" || loan.status === status;
    const matchesFrom = !fromDate || loan.date >= fromDate;
    const matchesTo = !toDate || loan.date <= toDate;

    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });
}

function renderSummaryReport() {
  const period = elements.summaryPeriodFilter.value;
  const needsCustomRange = period === "custom";
  const hasRequiredDate = needsCustomRange
    ? elements.summaryStartDate.value && elements.summaryEndDate.value
    : elements.summaryAnchorDate.value;

  updateSummaryRangeInputs(period);

  if (!hasRequiredDate) {
    elements.summaryReportBody.innerHTML = "";
    elements.summaryRangeLabel.textContent = "";
    elements.summaryCategoryLabel.textContent = "Select the required date range to view totals.";
    return;
  }

  const summary = getSummaryReport(
    period,
    elements.summaryAnchorDate.value,
    elements.summaryCategoryFilter.value,
    elements.summaryStartDate.value,
    elements.summaryEndDate.value,
  );

  elements.summaryRangeLabel.textContent = summary.rangeLabel;
  elements.summaryCategoryLabel.textContent = summary.categoryLabel;
  elements.summaryTrendTitle.textContent = summary.trendTitle;
  elements.summaryReportBody.innerHTML = summary.rows.map((row) => {
    return `
      <tr>
        <td>${row.category}</td>
        <td>${row.incomingPockets}</td>
        <td>${formatWeight(row.incomingWeight)}</td>
        <td>${formatCurrency(row.incomingAmount)}</td>
        <td>${row.outgoingPockets}</td>
        <td>${formatWeight(row.outgoingWeight)}</td>
        <td>${formatCurrency(row.outgoingAmount)}</td>
      </tr>
    `;
  }).join("");
  drawSummaryTrendGraph(summary.trendSeries);
}

function getSummaryReport(period, anchorDate, categoryFilter, customStartDate = "", customEndDate = "") {
  const range = getDateRange(period, anchorDate, customStartDate, customEndDate);
  const incomingEntries = getIncomingEntries(range.startDate, range.endDate);
  const outgoingEntries = getOutgoingEntries(range.startDate, range.endDate);

  const categories = categoryFilter === "all" ? ["Overall", ...CATEGORY_NAMES] : [categoryFilter];
  const rows = categories.map((category) => {
    const incoming = summarizeEntries(incomingEntries, category);
    const outgoing = summarizeEntries(outgoingEntries, category);

    return {
      category,
      incomingPockets: incoming.pockets,
      incomingWeight: incoming.weight,
      incomingAmount: incoming.amount,
      outgoingPockets: outgoing.pockets,
      outgoingWeight: outgoing.weight,
      outgoingAmount: outgoing.amount,
    };
  });

  return {
    period,
    anchorDate,
    rangeLabel: `${capitalize(period)} Report | ${range.label}`,
    categoryLabel: categoryFilter === "all" ? "Overall and category-wise totals" : `${categoryFilter} totals only`,
    rows,
    trendTitle: categoryFilter === "all" ? "Overall Amount Trend" : `${categoryFilter} Amount Trend`,
    trendSeries: getSummaryTrendSeries(period, range, categoryFilter, incomingEntries, outgoingEntries),
  };
}

function getSummaryTrendSeries(period, range, categoryFilter, incomingEntries, outgoingEntries) {
  const bucketMode = getTrendBucketMode(period, range.startDate, range.endDate);
  const buckets = buildTrendBuckets(bucketMode, range.startDate, range.endDate);
  const matchCategory = (entry) => categoryFilter === "all" || entry.category === categoryFilter;

  return buckets.map((bucket) => ({
    label: bucket.label,
    incomingAmount: roundToTwo(
      incomingEntries
        .filter((entry) => matchCategory(entry) && isDateWithinRange(entry.date, bucket.startDate, bucket.endDate))
        .reduce((sum, entry) => sum + entry.amount, 0),
    ),
    outgoingAmount: roundToTwo(
      outgoingEntries
        .filter((entry) => matchCategory(entry) && isDateWithinRange(entry.date, bucket.startDate, bucket.endDate))
        .reduce((sum, entry) => sum + entry.amount, 0),
    ),
  }));
}

function updateSummaryRangeInputs(period) {
  const isCustom = period === "custom";
  elements.summaryAnchorDate.classList.toggle("hidden", isCustom);
  elements.summaryStartDate.classList.toggle("hidden", !isCustom);
  elements.summaryEndDate.classList.toggle("hidden", !isCustom);
}

function getIncomingEntries(startDate, endDate) {
  const loanEntries = appState.loans
    .filter((loan) => isDateWithinRange(loan.date, startDate, endDate))
    .map((loan) => ({
      date: loan.date,
      category: loan.category,
      pockets: loan.pockets || 1,
      weight: loan.weight,
      amount: loan.amount,
    }));

  const manualEntries = normalizeManualEntries(
    appState.manualEntries.filter((entry) => isDateWithinRange(entry.date, startDate, endDate)),
    "incoming",
  );

  return [...loanEntries, ...manualEntries];
}

function getOutgoingEntries(startDate, endDate) {
  const closureEntries = appState.loans
    .filter((loan) => loan.status === "Closed" && isDateWithinRange(loan.closingDate, startDate, endDate))
    .map((loan) => ({
      date: loan.closingDate,
      category: loan.category,
      pockets: loan.pockets || 1,
      weight: loan.weight,
      amount: loan.closureTotal,
    }));

  const manualEntries = normalizeManualEntries(
    appState.manualEntries.filter((entry) => isDateWithinRange(entry.date, startDate, endDate)),
    "outgoing",
  );

  const adjustmentEntries = appState.adjustments
    .filter((entry) => isDateWithinRange(entry.date, startDate, endDate))
    .map((entry) => ({
      date: entry.date,
      category: entry.category,
      pockets: entry.pockets,
      weight: entry.weight,
      amount: entry.amount,
    }));

  return [...closureEntries, ...manualEntries, ...adjustmentEntries];
}

function summarizeEntries(entries, category) {
  const filteredEntries = category === "Overall"
    ? entries
    : entries.filter((entry) => entry.category === category);

  return filteredEntries.reduce((totals, entry) => {
    totals.pockets += entry.pockets;
    totals.weight = roundToThree(totals.weight + entry.weight);
    totals.amount = roundToTwo(totals.amount + entry.amount);
    return totals;
  }, { pockets: 0, weight: 0, amount: 0 });
}

function getDateRange(period, anchorDate, customStartDate = "", customEndDate = "") {
  if (period === "custom") {
    const start = customStartDate || customEndDate;
    const end = customEndDate || customStartDate;
    const orderedStart = start <= end ? start : end;
    const orderedEnd = end >= start ? end : start;

    return {
      startDate: orderedStart,
      endDate: orderedEnd,
      label: `${formatShortDate(orderedStart)} to ${formatShortDate(orderedEnd)}`,
    };
  }

  const anchor = parseDisplayDate(anchorDate);

  if (period === "weekly") {
    const day = anchor.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(anchor);
    start.setDate(anchor.getDate() + mondayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(end),
      label: `${formatShortDate(start)} to ${formatShortDate(end)}`,
    };
  }

  if (period === "monthly") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);

    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(end),
      label: new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric",
      }).format(start),
    };
  }

  if (period === "yearly") {
    const start = new Date(anchor.getFullYear(), 0, 1);
    const end = new Date(anchor.getFullYear(), 11, 31);

    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(end),
      label: `${anchor.getFullYear()}`,
    };
  }

  return {
    startDate: anchorDate,
    endDate: anchorDate,
    label: formatLongDate(anchorDate),
  };
}

function getTrendBucketMode(period, startDate, endDate) {
  if (period === "yearly") {
    return "monthly";
  }

  const totalDays = getRangeDayCount(startDate, endDate);

  if (period === "custom" && totalDays > 62) {
    return "monthly";
  }

  if (period === "custom" && totalDays > 21) {
    return "weekly";
  }

  return "daily";
}

function buildTrendBuckets(mode, startDate, endDate) {
  if (mode === "monthly") {
    const buckets = [];
    let cursor = parseDisplayDate(startDate);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const limit = parseDisplayDate(endDate);

    while (cursor <= limit) {
      const bucketStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      buckets.push({
        startDate: toDateInputValue(bucketStart),
        endDate: toDateInputValue(bucketEnd <= limit ? bucketEnd : limit),
        label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(bucketStart),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return buckets;
  }

  if (mode === "weekly") {
    const buckets = [];
    let cursor = parseDisplayDate(startDate);
    const limit = parseDisplayDate(endDate);

    while (cursor <= limit) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(cursor);
      bucketEnd.setDate(bucketEnd.getDate() + 6);
      buckets.push({
        startDate: toDateInputValue(bucketStart),
        endDate: toDateInputValue(bucketEnd <= limit ? bucketEnd : limit),
        label: formatShortDate(bucketStart),
      });
      cursor.setDate(cursor.getDate() + 7);
    }

    return buckets;
  }

  const buckets = [];
  let cursor = parseDisplayDate(startDate);
  const limit = parseDisplayDate(endDate);

  while (cursor <= limit) {
    buckets.push({
      startDate: toDateInputValue(cursor),
      endDate: toDateInputValue(cursor),
      label: new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(cursor),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function getRangeDayCount(startDate, endDate) {
  const start = parseDisplayDate(startDate);
  const end = parseDisplayDate(endDate);
  return Math.floor((end - start) / 86400000) + 1;
}

function isDateWithinRange(date, startDate, endDate) {
  return Boolean(date) && date >= startDate && date <= endDate;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function drawSummaryTrendGraph(series) {
  const canvas = elements.summaryTrendCanvas;

  if (!canvas) {
    return;
  }

  const cssWidth = Math.max(canvas.parentElement?.clientWidth || 0, 880);
  const cssHeight = 320;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(cssWidth * ratio);
  canvas.height = Math.floor(cssHeight * ratio);
  canvas.style.height = `${cssHeight}px`;
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const padding = { top: 24, right: 24, bottom: 54, left: 62 };
  const chartWidth = cssWidth - padding.left - padding.right;
  const chartHeight = cssHeight - padding.top - padding.bottom;
  const maxValue = Math.max(
    1,
    ...series.flatMap((point) => [point.incomingAmount, point.outgoingAmount]),
  );

  context.strokeStyle = "rgba(29, 63, 145, 0.12)";
  context.lineWidth = 1;
  context.font = "12px Trebuchet MS";
  context.fillStyle = "#5c6783";

  for (let step = 0; step <= 4; step += 1) {
    const y = padding.top + (chartHeight / 4) * step;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(cssWidth - padding.right, y);
    context.stroke();

    const value = maxValue - (maxValue / 4) * step;
    context.fillText(formatCompactCurrency(value), 8, y + 4);
  }

  if (!series.length) {
    context.fillStyle = "#5c6783";
    context.fillText("No trend data available for this range.", padding.left, padding.top + 40);
    return;
  }

  const xForIndex = (index) => {
    if (series.length === 1) {
      return padding.left + chartWidth / 2;
    }

    return padding.left + (chartWidth / (series.length - 1)) * index;
  };

  const yForValue = (value) => padding.top + chartHeight - (value / maxValue) * chartHeight;

  drawTrendLine(context, series, xForIndex, yForValue, "incomingAmount", "#1d3f91");
  drawTrendLine(context, series, xForIndex, yForValue, "outgoingAmount", "#d3a329");

  context.fillStyle = "#5c6783";
  context.textAlign = "center";
  series.forEach((point, index) => {
    const x = xForIndex(index);
    context.fillText(point.label, x, cssHeight - 18);
  });
  context.textAlign = "left";
}

function drawTrendLine(context, series, xForIndex, yForValue, key, color) {
  context.beginPath();
  context.lineWidth = 3;
  context.strokeStyle = color;

  series.forEach((point, index) => {
    const x = xForIndex(index);
    const y = yForValue(point[key]);

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();

  series.forEach((point, index) => {
    const x = xForIndex(index);
    const y = yForValue(point[key]);
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(x, y, 5.5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.stroke();
  });
}

function formatCompactCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function renderSharePreview() {
  if (!elements.shareDate.value) {
    return;
  }

  const report = getShareReport(elements.shareDate.value);
  const differenceClass = report.differenceAmount < 0 ? "negative" : report.differenceAmount > 0 ? "positive" : "neutral";

  elements.sharePreview.innerHTML = `
    <div id="shareCard" class="share-card">
      <div class="share-header">
        <div>
          <h3>${BANK_NAME}</h3>
          <p class="muted-text">${BRANCH_NAME}</p>
        </div>
        <div class="share-date-block">
          <span class="muted-text">Date</span>
          <strong>${formatLongDate(report.date)}</strong>
        </div>
      </div>
      <div class="share-table-wrap">
        <table class="share-table">
          <thead>
            <tr>
              <th></th>
              <th>No. of Pockets</th>
              <th>Total Weight</th>
              <th>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Incoming</th>
              <td>${report.incomingPockets}</td>
              <td>${formatWeight(report.incomingWeight)}</td>
              <td>${formatCurrency(report.incomingAmount)}</td>
            </tr>
            <tr>
              <th scope="row">Outgoing</th>
              <td>${report.outgoingPockets}</td>
              <td>${formatWeight(report.outgoingWeight)}</td>
              <td>${formatCurrency(report.outgoingAmount)}</td>
            </tr>
            <tr class="difference-row">
              <th scope="row" colspan="3">Difference</th>
              <td class="diff-value ${differenceClass}">${formatCurrency(report.differenceAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function getShareReport(date) {
  const incomingLoans = appState.loans.filter((loan) => loan.date === date);
  const outgoingLoans = appState.loans.filter((loan) => loan.status === "Closed" && loan.closingDate === date);
  const manualEntriesForDate = appState.manualEntries.filter((entry) => entry.date === date);
  const incomingManualEntries = normalizeManualEntries(manualEntriesForDate, "incoming");
  const outgoingManualEntries = normalizeManualEntries(manualEntriesForDate, "outgoing");

  const incomingLoanPockets = incomingLoans.reduce((sum, loan) => sum + (loan.pockets || 1), 0);
  const incomingLoanWeight = incomingLoans.reduce((sum, loan) => sum + loan.weight, 0);
  const incomingLoanAmount = incomingLoans.reduce((sum, loan) => sum + loan.amount, 0);

  const outgoingLoanPockets = outgoingLoans.reduce((sum, loan) => sum + (loan.pockets || 1), 0);
  const outgoingLoanWeight = outgoingLoans.reduce((sum, loan) => sum + loan.weight, 0);
  const outgoingLoanAmount = outgoingLoans.reduce((sum, loan) => sum + loan.closureTotal, 0);

  const incomingManualPockets = incomingManualEntries.reduce((sum, entry) => sum + entry.pockets, 0);
  const incomingManualWeight = incomingManualEntries.reduce((sum, entry) => sum + entry.weight, 0);
  const incomingManualAmount = incomingManualEntries.reduce((sum, entry) => sum + entry.amount, 0);

  const outgoingManualPockets = outgoingManualEntries.reduce((sum, entry) => sum + entry.pockets, 0);
  const outgoingManualWeight = outgoingManualEntries.reduce((sum, entry) => sum + entry.weight, 0);
  const outgoingManualAmount = outgoingManualEntries.reduce((sum, entry) => sum + entry.amount, 0);

  const incomingPockets = incomingLoanPockets + incomingManualPockets;
  const incomingWeight = roundToThree(incomingLoanWeight + incomingManualWeight);
  const incomingAmount = roundToTwo(incomingLoanAmount + incomingManualAmount);

  const outgoingPockets = outgoingLoanPockets + outgoingManualPockets;
  const outgoingWeight = roundToThree(outgoingLoanWeight + outgoingManualWeight);
  const outgoingAmount = roundToTwo(outgoingLoanAmount + outgoingManualAmount);

  return {
    date,
    incomingPockets,
    incomingWeight,
    incomingAmount,
    outgoingPockets,
    outgoingWeight,
    outgoingAmount,
    differenceAmount: roundToTwo(incomingAmount - outgoingAmount),
  };
}

function normalizeManualEntries(entries, direction) {
  return entries.flatMap((entry) => {
    if (entry.type === "combined") {
      return Array.isArray(entry[`${direction}Entries`])
        ? entry[`${direction}Entries`].map((item) => ({ ...item, date: entry.date }))
        : [];
    }

    if (entry.type === direction) {
      return Array.isArray(entry.entries)
        ? entry.entries.map((item) => ({ ...item, date: entry.date }))
        : [];
    }

    return [];
  });
}

function getManualChanges(direction, form) {
  const entries = [];

  for (const category of CATEGORY_NAMES) {
    const pockets = Number(form[`${direction}_${category}_pockets`].value);
    const weight = Number(form[`${direction}_${category}_weight`].value);
    const amount = Number(form[`${direction}_${category}_amount`].value);

    if (!Number.isInteger(pockets) || pockets < 0 || ![weight, amount].every((value) => Number.isFinite(value) && value >= 0)) {
      return {
        valid: false,
        message: `Enter valid ${direction} values for ${category}.`,
        entries: [],
      };
    }

    if (pockets > 0 || weight > 0 || amount > 0) {
      entries.push({
        category,
        pockets: Math.trunc(pockets),
        weight: roundToThree(weight),
        amount: roundToTwo(amount),
      });
    }
  }

  return {
    valid: true,
    message: "",
    entries,
  };
}

function getManualAppraiserCounts(form) {
  const counts = {};

  for (const appraiser of APPRAISERS) {
    const value = Number(form[`incoming_appraiser_${appraiser}`].value);

    if (!Number.isInteger(value) || value < 0) {
      return {
        valid: false,
        message: `Enter a valid incoming count for ${appraiser}.`,
        counts: {},
      };
    }

    counts[appraiser] = value;
  }

  return {
    valid: true,
    message: "",
    counts,
  };
}

function setManualEntryMode(mode) {
  elements.manualEntryMode.value = mode;

  document.querySelectorAll("[data-manual-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.manualMode === mode);
  });

  document.querySelectorAll("[data-manual-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.manualPanel !== mode);
  });
}

function resetManualEntryForm() {
  elements.manualEntryForm.reset();
  elements.manualEntryForm.elements.date.value = toDateInputValue(new Date());
  setManualEntryMode("incoming");

  for (const direction of ["incoming", "outgoing"]) {
    for (const category of CATEGORY_NAMES) {
      elements.manualEntryForm.elements[`${direction}_${category}_pockets`].value = "0";
      elements.manualEntryForm.elements[`${direction}_${category}_weight`].value = "0";
      elements.manualEntryForm.elements[`${direction}_${category}_amount`].value = "0";
    }
  }

  APPRAISERS.forEach((appraiser) => {
    elements.manualEntryForm.elements[`incoming_appraiser_${appraiser}`].value = "0";
  });
}

function openModal(modalId) {
  closeActiveModal();
  activeModalId = modalId;
  if (modalId === "manualEntryModal") {
    resetManualEntryForm();
  }
  elements.modalOverlay.classList.remove("hidden");
  document.getElementById(modalId).classList.remove("hidden");
}

function closeActiveModal() {
  if (!activeModalId) {
    return;
  }

  document.getElementById(activeModalId).classList.add("hidden");
  elements.modalOverlay.classList.add("hidden");
  activeModalId = null;
}

function handleOverlayClick(event) {
  if (event.target === elements.modalOverlay) {
    closeActiveModal();
  }
}

function showToast(message, type = "success") {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type}`;
  elements.toast.classList.remove("hidden");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 3200);
}

async function exportShareAsPng() {
  const report = getShareReport(elements.shareDate.value);
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const context = canvas.getContext("2d");

  context.fillStyle = "#edf3fb";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#1d3f91");
  gradient.addColorStop(1, "#d3a329");
  context.fillStyle = gradient;
  context.fillRect(60, 60, canvas.width - 120, canvas.height - 120);

  context.fillStyle = "rgba(255,255,255,0.95)";
  roundRect(context, 120, 120, canvas.width - 240, canvas.height - 240, 28);
  context.fill();

  context.fillStyle = "#0f2237";
  context.font = "bold 42px Georgia";
  context.fillText(BANK_NAME, 180, 210);
  context.font = "24px Trebuchet MS";
  context.fillText(BRANCH_NAME, 180, 252);
  context.textAlign = "right";
  context.font = "22px Trebuchet MS";
  context.fillText(`Date: ${formatLongDate(report.date)}`, canvas.width - 180, 220);
  context.textAlign = "left";

  const columns = [
    { label: "", value: "" },
    { label: "No. of Pockets", value: "" },
    { label: "Total Weight", value: "" },
    { label: "Total Amount", value: "" },
  ];

  const rows = [
    ["Incoming", `${report.incomingPockets}`, formatWeight(report.incomingWeight), formatCurrency(report.incomingAmount)],
    ["Outgoing", `${report.outgoingPockets}`, formatWeight(report.outgoingWeight), formatCurrency(report.outgoingAmount)],
  ];

  const left = 220;
  const top = 340;
  const columnWidth = 290;
  const headerHeight = 82;
  const bodyHeight = 76;

  context.font = "bold 22px Trebuchet MS";
  columns.forEach((column, index) => {
    const x = left + index * columnWidth;
    context.fillStyle = "#e5ecfa";
    context.fillRect(x, top, columnWidth, headerHeight);
    context.strokeStyle = "#c2d1ee";
    context.strokeRect(x, top, columnWidth, headerHeight);
    context.fillStyle = "#1d3f91";
    wrapCanvasText(context, column.label, x + 14, top + 30, columnWidth - 24, 24);
  });

  context.font = "22px Trebuchet MS";
  rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const x = left + columnIndex * columnWidth;
      const y = top + headerHeight + rowIndex * bodyHeight;
      context.fillStyle = "#ffffff";
      context.fillRect(x, y, columnWidth, bodyHeight);
      context.strokeStyle = "#c2d1ee";
      context.strokeRect(x, y, columnWidth, bodyHeight);
      context.fillStyle = "#10275f";
      wrapCanvasText(context, value, x + 14, y + 42, columnWidth - 24, 24);
    });
  });

  const diffTop = top + headerHeight + rows.length * bodyHeight;
  context.fillStyle = "#fff7df";
  context.fillRect(left, diffTop, columnWidth * 3, bodyHeight);
  context.strokeStyle = "#c2d1ee";
  context.strokeRect(left, diffTop, columnWidth * 3, bodyHeight);
  context.fillStyle = "#7b5800";
  context.font = "bold 22px Trebuchet MS";
  context.fillText("Difference", left + 16, diffTop + 42);

  context.fillStyle = "#ffffff";
  context.fillRect(left + columnWidth * 3, diffTop, columnWidth, bodyHeight);
  context.strokeStyle = "#c2d1ee";
  context.strokeRect(left + columnWidth * 3, diffTop, columnWidth, bodyHeight);
  context.fillStyle = report.differenceAmount < 0 ? "#c23535" : report.differenceAmount > 0 ? "#1f7a3d" : "#7b5800";
  wrapCanvasText(context, formatCurrency(report.differenceAmount), left + columnWidth * 3 + 14, diffTop + 42, columnWidth - 24, 24);

  const url = canvas.toDataURL("image/png");
  downloadUrl(url, `share-report-${report.date}.png`);
  showToast("PNG report downloaded.", "success");
}

function exportShareAsPdf() {
  const report = getShareReport(elements.shareDate.value);
  const reportWindow = window.open("", "_blank", "width=960,height=720");
  const differenceColor = report.differenceAmount < 0 ? "#c23535" : report.differenceAmount > 0 ? "#1f7a3d" : "#7b5800";

  if (!reportWindow) {
    showToast("Allow popups to export PDF.", "error");
    return;
  }

  reportWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Share Report</title>
      <style>
        body {
          margin: 0;
          padding: 48px;
          font-family: "Trebuchet MS", sans-serif;
          color: #162132;
          background: #f5f8fb;
        }
        .sheet {
          max-width: 780px;
          margin: 0 auto;
          padding: 36px;
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 18px 40px rgba(19, 35, 61, 0.12);
        }
        h1 {
          margin: 0 0 8px;
          font-family: Georgia, serif;
        }
        p {
          color: #56657a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 18px;
          font-size: 14px;
        }
        th, td {
          border: 1px solid #dde6f1;
          padding: 14px 12px;
          text-align: left;
        }
        th {
          background: #e9effb;
          color: #1d3f91;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 18px;
        }
        .header h1 {
          margin: 0 0 6px;
        }
        .header p {
          margin: 0;
        }
        .difference-row th {
          background: #fff4d3;
          color: #7b5800;
        }
        .difference-value {
          color: ${differenceColor};
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="header">
          <div>
            <h1>${BANK_NAME}</h1>
            <p>${BRANCH_NAME}</p>
          </div>
          <div>
            <p><strong>Date:</strong> ${formatLongDate(report.date)}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>No. of Pockets</th>
              <th>Total Weight</th>
              <th>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Incoming</th>
              <td>${report.incomingPockets}</td>
              <td>${formatWeight(report.incomingWeight)}</td>
              <td>${formatCurrency(report.incomingAmount)}</td>
            </tr>
            <tr>
              <th scope="row">Outgoing</th>
              <td>${report.outgoingPockets}</td>
              <td>${formatWeight(report.outgoingWeight)}</td>
              <td>${formatCurrency(report.outgoingAmount)}</td>
            </tr>
            <tr class="difference-row">
              <th scope="row" colspan="3">Difference</th>
              <td class="difference-value">${formatCurrency(report.differenceAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <script>
        window.onload = () => window.print();
      <\/script>
    </body>
    </html>
  `);
  reportWindow.document.close();
  showToast("PDF export opened in print dialog.", "success");
}

function exportReportAsPdf() {
  const filteredLoans = getFilteredLoans().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const reportWindow = window.open("", "_blank", "width=1280,height=900");

  if (!reportWindow) {
    showToast("Allow popups to export the loan report PDF.", "error");
    return;
  }

  const tableRows = filteredLoans.length
    ? filteredLoans.map((loan) => `
        <tr>
          <td>${escapeHtml(loan.name)}</td>
          <td>${escapeHtml(loan.cardNumber)}</td>
          <td>${formatShortDate(loan.date)}</td>
          <td>${escapeHtml(loan.category)}</td>
          <td>${escapeHtml(loan.appraiser)}</td>
          <td>${formatWeight(loan.weight)}</td>
          <td>${formatCurrency(loan.amount)}</td>
          <td>${loan.status}</td>
          <td>${loan.status === "Closed" ? `${formatShortDate(loan.closingDate)} / ${formatCurrency(loan.closureTotal)}` : "Open"}</td>
        </tr>
      `).join("")
    : '<tr><td colspan="9">No loans match the current filters.</td></tr>';

  reportWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Loan Report</title>
      <style>
        body {
          margin: 0;
          padding: 36px;
          font-family: "Trebuchet MS", sans-serif;
          color: #162132;
          background: #f5f8fb;
        }
        h1 {
          margin: 0 0 6px;
          font-family: Georgia, serif;
        }
        p {
          margin: 0 0 18px;
          color: #56657a;
        }
        .sheet {
          background: #ffffff;
          border-radius: 24px;
          padding: 28px;
          box-shadow: 0 18px 40px rgba(19, 35, 61, 0.12);
        }
        .meta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th, td {
          border: 1px solid #d7e1ee;
          padding: 10px 8px;
          text-align: left;
        }
        th {
          background: #eaf2fb;
        }
        @media print {
          body {
            padding: 0;
            background: #ffffff;
          }
          .sheet {
            box-shadow: none;
            border-radius: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <h1>${BANK_NAME} - Loan Report</h1>
        <p>${BRANCH_NAME} branch register export</p>
        <div class="meta">
          <span>Generated on: ${formatLongDate(new Date())}</span>
          <span>Status filter: ${elements.reportStatusFilter.value === "all" ? "All Loans" : elements.reportStatusFilter.value}</span>
          <span>Date filter: ${elements.reportFromDate.value || "Any"} to ${elements.reportToDate.value || "Any"}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Card Number</th>
              <th>Date</th>
              <th>Category</th>
              <th>Appraiser</th>
              <th>Weight</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Closure</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <script>
        window.onload = () => window.print();
      <\/script>
    </body>
    </html>
  `);
  reportWindow.document.close();
  showToast("Loan report PDF opened in print dialog.", "success");
}

function exportSummaryReportAsPdf() {
  const summary = getSummaryReport(
    elements.summaryPeriodFilter.value,
    elements.summaryAnchorDate.value,
    elements.summaryCategoryFilter.value,
    elements.summaryStartDate.value,
    elements.summaryEndDate.value,
  );
  const reportWindow = window.open("", "_blank", "width=1200,height=860");

  if (!reportWindow) {
    showToast("Allow popups to export the summary report PDF.", "error");
    return;
  }

  const tableRows = summary.rows.map((row) => `
      <tr>
        <td>${row.category}</td>
        <td>${row.incomingPockets}</td>
        <td>${formatWeight(row.incomingWeight)}</td>
        <td>${formatCurrency(row.incomingAmount)}</td>
        <td>${row.outgoingPockets}</td>
        <td>${formatWeight(row.outgoingWeight)}</td>
        <td>${formatCurrency(row.outgoingAmount)}</td>
      </tr>
    `).join("");

  reportWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Summary Report</title>
      <style>
        body {
          margin: 0;
          padding: 36px;
          font-family: "Trebuchet MS", sans-serif;
          color: #162132;
          background: #f5f8fb;
        }
        .sheet {
          background: #ffffff;
          border-radius: 24px;
          padding: 28px;
          box-shadow: 0 18px 40px rgba(19, 35, 61, 0.12);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
        }
        h1 {
          margin: 0 0 6px;
          font-family: Georgia, serif;
        }
        p {
          margin: 0;
          color: #56657a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th, td {
          border: 1px solid #d7e1ee;
          padding: 10px 8px;
          text-align: left;
        }
        th {
          background: #eaf2fb;
          color: #1d3f91;
        }
        @media print {
          body {
            padding: 0;
            background: #ffffff;
          }
          .sheet {
            box-shadow: none;
            border-radius: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="header">
          <div>
            <h1>${BANK_NAME}</h1>
            <p>${BRANCH_NAME}</p>
          </div>
          <div>
            <p><strong>${summary.rangeLabel}</strong></p>
            <p>${summary.categoryLabel}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Incoming Pockets</th>
              <th>Incoming Weight</th>
              <th>Incoming Amount</th>
              <th>Outgoing Pockets</th>
              <th>Outgoing Weight</th>
              <th>Outgoing Amount</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <script>
        window.onload = () => window.print();
      <\/script>
    </body>
    </html>
  `);
  reportWindow.document.close();
  showToast("Summary report PDF opened in print dialog.", "success");
}

async function exportSummaryReportAsPng() {
  const summary = getSummaryReport(
    elements.summaryPeriodFilter.value,
    elements.summaryAnchorDate.value,
    elements.summaryCategoryFilter.value,
    elements.summaryStartDate.value,
    elements.summaryEndDate.value,
  );
  const canvas = document.createElement("canvas");
  const rowCount = Math.max(summary.rows.length, 1);
  canvas.width = 1900;
  canvas.height = 420 + rowCount * 86;
  const context = canvas.getContext("2d");

  context.fillStyle = "#edf3fb";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#1d3f91");
  gradient.addColorStop(1, "#d3a329");
  context.fillStyle = gradient;
  context.fillRect(60, 60, canvas.width - 120, canvas.height - 120);

  context.fillStyle = "rgba(255,255,255,0.96)";
  roundRect(context, 110, 110, canvas.width - 220, canvas.height - 220, 28);
  context.fill();

  context.fillStyle = "#0f2237";
  context.font = "bold 42px Georgia";
  context.fillText(BANK_NAME, 160, 190);
  context.font = "24px Trebuchet MS";
  context.fillText(BRANCH_NAME, 160, 228);
  context.textAlign = "right";
  context.fillText(summary.rangeLabel, canvas.width - 160, 190);
  context.fillText(summary.categoryLabel, canvas.width - 160, 228);
  context.textAlign = "left";

  const columns = [
    "Category",
    "Incoming Pockets",
    "Incoming Weight",
    "Incoming Amount",
    "Outgoing Pockets",
    "Outgoing Weight",
    "Outgoing Amount",
  ];
  const startX = 145;
  const top = 290;
  const columnWidth = 228;
  const headerHeight = 74;
  const rowHeight = 74;

  context.font = "bold 19px Trebuchet MS";
  columns.forEach((label, index) => {
    const x = startX + index * columnWidth;
    context.fillStyle = "#e5ecfa";
    context.fillRect(x, top, columnWidth, headerHeight);
    context.strokeStyle = "#c2d1ee";
    context.strokeRect(x, top, columnWidth, headerHeight);
    context.fillStyle = "#1d3f91";
    wrapCanvasText(context, label, x + 12, top + 28, columnWidth - 24, 22);
  });

  summary.rows.forEach((row, rowIndex) => {
    const values = [
      row.category,
      `${row.incomingPockets}`,
      formatWeight(row.incomingWeight),
      formatCurrency(row.incomingAmount),
      `${row.outgoingPockets}`,
      formatWeight(row.outgoingWeight),
      formatCurrency(row.outgoingAmount),
    ];

    values.forEach((value, columnIndex) => {
      const x = startX + columnIndex * columnWidth;
      const y = top + headerHeight + rowIndex * rowHeight;
      context.fillStyle = "#ffffff";
      context.fillRect(x, y, columnWidth, rowHeight);
      context.strokeStyle = "#c2d1ee";
      context.strokeRect(x, y, columnWidth, rowHeight);
      context.fillStyle = "#10275f";
      context.font = "18px Trebuchet MS";
      wrapCanvasText(context, value, x + 12, y + 30, columnWidth - 20, 22);
    });
  });

  const url = canvas.toDataURL("image/png");
  downloadUrl(url, `summary-report-${elements.summaryPeriodFilter.value}-${elements.summaryAnchorDate.value}.png`);
  showToast("Summary report PNG downloaded.", "success");
}

function downloadUrl(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function getOverallTotals() {
  return CATEGORY_NAMES.reduce((totals, category) => {
    totals.pockets += appState.categories[category].pockets;
    totals.weight += appState.categories[category].weight;
    totals.amount += appState.categories[category].amount;
    return totals;
  }, { pockets: 0, weight: 0, amount: 0 });
}

function incrementCategory(category, values) {
  const current = appState.categories[category];
  current.pockets += values.pockets;
  current.weight = roundToThree(current.weight + values.weight);
  current.amount = roundToTwo(current.amount + values.amount);
}

function decrementCategory(category, values) {
  const current = appState.categories[category];
  current.pockets -= values.pockets;
  current.weight = roundToThree(current.weight - values.weight);
  current.amount = roundToTwo(current.amount - values.amount);
}

function ensureAppraiserReset(state) {
  const currentPeriod = getCurrentPeriod();

  if (state.appraiserStats.period === currentPeriod) {
    return { state, changed: false };
  }

  state.appraiserStats = {
    period: currentPeriod,
    counts: APPRAISERS.reduce((counts, name) => {
      counts[name] = 0;
      return counts;
    }, {}),
  };

  return { state, changed: true };
}

function getCurrentPeriod() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value).replace("₹", "Rs. ");
}

function formatWeight(value) {
  return `${Number(value).toFixed(3)} g`;
}

function formatShortDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseDisplayDate(value));
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parseDisplayDate(value));
}

function toDateInputValue(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function roundToThree(value) {
  return Math.round(value * 1000) / 1000;
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function isPositive(value) {
  return Number.isFinite(value) && value > 0;
}

function parseDisplayDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  return new Date(value);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  let line = "";
  let top = y;

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;

    if (context.measureText(nextLine).width > maxWidth && line) {
      context.fillText(line, x, top);
      line = word;
      top += lineHeight;
    } else {
      line = nextLine;
    }
  }

  if (line) {
    context.fillText(line, x, top);
  }
}

function createDefaultState() {
  return {
    id: STATE_KEY,
    auth: { ...DEFAULT_AUTH },
    categoriesInitialized: false,
    categorySetupDate: null,
    categories: CATEGORY_NAMES.reduce((all, name) => {
      all[name] = { pockets: 0, weight: 0, amount: 0 };
      return all;
    }, {}),
    loans: [],
    adjustments: [],
    manualEntries: [],
    appraiserStats: {
      period: getCurrentPeriod(),
      counts: APPRAISERS.reduce((counts, name) => {
        counts[name] = 0;
        return counts;
      }, {}),
    },
  };
}

async function loadState() {
  const payload = await requestJson(STATE_API_URL);
  return hydrateState(payload);
}

async function saveState(state) {
  await requestJson(STATE_API_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(state),
  });
  return state;
}

function hydrateState(rawState) {
  const defaultState = createDefaultState();
  const legacyCounts = rawState.appraiserStats?.counts || {};
  const migratedLoans = Array.isArray(rawState.loans)
    ? rawState.loans.map((loan) => ({
      ...loan,
      appraiser: LEGACY_APPRAISER_MAP[loan.appraiser] || loan.appraiser,
    }))
    : [];

  return {
    ...defaultState,
    ...rawState,
    auth: { ...defaultState.auth, ...(rawState.auth || {}) },
    categories: CATEGORY_NAMES.reduce((all, name) => {
      all[name] = { ...defaultState.categories[name], ...(rawState.categories?.[name] || {}) };
      return all;
    }, {}),
    loans: migratedLoans,
    adjustments: Array.isArray(rawState.adjustments) ? rawState.adjustments : [],
    manualEntries: Array.isArray(rawState.manualEntries) ? rawState.manualEntries : [],
    appraiserStats: {
      ...defaultState.appraiserStats,
      ...(rawState.appraiserStats || {}),
      counts: APPRAISERS.reduce((counts, name) => {
        counts[name] = Number(legacyCounts[name] ?? 0);

        for (const [legacyName, mappedName] of Object.entries(LEGACY_APPRAISER_MAP)) {
          if (mappedName === name) {
            counts[name] += Number(legacyCounts[legacyName] ?? 0);
          }
        }

        return counts;
      }, {}),
    },
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed.");
  }

  return response.json();
}
