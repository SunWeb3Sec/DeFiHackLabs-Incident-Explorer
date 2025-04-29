// Import analysis functions and data loader
import {
  loadAndProcessData,
  analysisResults,
  combinedData as incidents,
  rootCauseData,
  renderCharts,
  makeAnalyticsCollapsible,
} from "./analysis.js";

document.addEventListener("DOMContentLoaded", async function () {
  // Global variables
  let currentPage = 1;
  const itemsPerPage = 50;
  let filteredIncidents = [];
  let sortedProjects = [];
  let currentProjectIndex = -1;

  // Variables for table sorting
  let currentSortColumn = null;
  let currentSortDirection = "desc"; // 'asc' or 'desc'

  // Currency conversion rates cache - make accessible globally
  window.conversionRates = {
    USD: 1, // Base currency is always 1
  };

  // Selected display currency
  let displayCurrency = "USD";

  // Get the table container element
  const tableContainerElement = document.getElementById("table-container");
  if (!tableContainerElement) {
    console.error("Table container element (#table-container) not found!");
    document.body.innerHTML =
      '<div class="error-message">Table container not found. Please check your HTML.</div>';
    return;
  }

  // Clear container to prevent duplication issues
  tableContainerElement.innerHTML = "";

  try {
    // 1. Load data first
    await loadAndProcessData();
    console.log("Data loaded, proceeding with UI setup.");

    // 2. Fetch initial currency rates
    await fetchCurrencyRates();

    // 3. Create UI components
    createUI();
  } catch (error) {
    console.error("Failed to initialize incident explorer:", error);
    tableContainerElement.innerHTML = `
            <div class="loading-error">
                <div class="error-icon">⚠️</div>
                <div class="error-message">Failed to load incident data: ${error.message}</div>
                <button class="retry-button">Retry</button>
            </div>
        `;

    // Add retry functionality
    document.querySelector(".retry-button")?.addEventListener("click", () => {
      window.location.reload();
    });
  }

  // Function to fetch currency rates from APIs
  async function fetchCurrencyRates() {
    try {
      // Fetch crypto rates from CoinGecko - adding BNB and other relevant cryptos
      const cryptoResponse = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,matic-network,solana,avalanche-2&vs_currencies=usd"
      );
      if (!cryptoResponse.ok) {
        throw new Error("Failed to fetch crypto rates");
      }

      const cryptoData = await cryptoResponse.json();

      // Update conversion rates with crypto data
      if (cryptoData.bitcoin && cryptoData.bitcoin.usd) {
        window.conversionRates["BTC"] = 1 / cryptoData.bitcoin.usd; // Rate to convert 1 USD to BTC
      } else {
        // Fallback value if API fails
        window.conversionRates["BTC"] = 0.000017;
        console.warn("Using fallback value for BTC conversion");
      }

      if (cryptoData.ethereum && cryptoData.ethereum.usd) {
        window.conversionRates["ETH"] = 1 / cryptoData.ethereum.usd; // Rate to convert 1 USD to ETH
      } else {
        // Fallback value if API fails
        window.conversionRates["ETH"] = 0.00033;
        console.warn("Using fallback value for ETH conversion");
      }

      // Add BNB conversion rate
      if (cryptoData.binancecoin && cryptoData.binancecoin.usd) {
        window.conversionRates["BNB"] = 1 / cryptoData.binancecoin.usd; // Rate to convert 1 USD to BNB
      } else {
        // Fallback value if API fails
        window.conversionRates["BNB"] = 0.002; // Approximate: 1 USD ≈ 0.002 BNB
        console.warn("Using fallback value for BNB conversion");
      }

      // Add MATIC conversion rate
      if (cryptoData["matic-network"] && cryptoData["matic-network"].usd) {
        window.conversionRates["MATIC"] = 1 / cryptoData["matic-network"].usd;
      } else {
        window.conversionRates["MATIC"] = 0.5; // Fallback
        console.warn("Using fallback value for MATIC conversion");
      }

      // Add SOL conversion rate
      if (cryptoData.solana && cryptoData.solana.usd) {
        window.conversionRates["SOL"] = 1 / cryptoData.solana.usd;
      } else {
        window.conversionRates["SOL"] = 0.01; // Fallback
        console.warn("Using fallback value for SOL conversion");
      }

      // Add AVAX conversion rate
      if (cryptoData["avalanche-2"] && cryptoData["avalanche-2"].usd) {
        window.conversionRates["AVAX"] = 1 / cryptoData["avalanche-2"].usd;
      } else {
        window.conversionRates["AVAX"] = 0.02; // Fallback
        console.warn("Using fallback value for AVAX conversion");
      }

      // For forex rates, we'd ideally use XE API but it requires authentication
      // As an alternative, we'll use the free Exchange Rates API
      // Note: In a production environment, you'd want to use a proper API with authentication
      const forexResponse = await fetch(
        "https://open.er-api.com/v6/latest/USD"
      );
      if (!forexResponse.ok) {
        throw new Error("Failed to fetch forex rates");
      }

      const forexData = await forexResponse.json();

      // Update conversion rates with forex data
      if (forexData.rates) {
        // Add forex rates
        if (forexData.rates.EUR)
          window.conversionRates["EUR"] = forexData.rates.EUR;
        if (forexData.rates.GBP)
          window.conversionRates["GBP"] = forexData.rates.GBP;
        if (forexData.rates.JPY)
          window.conversionRates["JPY"] = forexData.rates.JPY;
        if (forexData.rates.CNY)
          window.conversionRates["CNY"] = forexData.rates.CNY;
        if (forexData.rates.AED)
          window.conversionRates["AED"] = forexData.rates.AED;
        if (forexData.rates.KWD)
          window.conversionRates["KWD"] = forexData.rates.KWD;
        if (forexData.rates.TWD)
          window.conversionRates["TWD"] = forexData.rates.TWD;
      } else {
        // Fallback values if API fails
        window.conversionRates["EUR"] = 0.92;
        window.conversionRates["GBP"] = 0.79;
        window.conversionRates["JPY"] = 150.5;
        window.conversionRates["CNY"] = 7.2;
        window.conversionRates["AED"] = 3.67; // Fallback: 1 USD ≈ 3.67 AED
        window.conversionRates["KWD"] = 0.31; // Fallback: 1 USD ≈ 0.31 KWD
        window.conversionRates["TWD"] = 32.0; // Fallback: 1 USD ≈ 32.0 TWD
        console.warn("Using fallback values for forex conversion");
      }

      console.log(
        "Currency rates fetched successfully:",
        window.conversionRates
      );
    } catch (error) {
      console.error("Error fetching currency rates:", error);
      // Set fallback values
      window.conversionRates = {
        USD: 1,
        BTC: 0.000017, // Fallback: 1 USD ≈ 0.000017 BTC
        ETH: 0.00033, // Fallback: 1 USD ≈ 0.00033 ETH
        BNB: 0.002, // Fallback: 1 USD ≈ 0.002 BNB
        MATIC: 0.5, // Fallback: 1 USD ≈ 0.5 MATIC
        SOL: 0.01, // Fallback: 1 USD ≈ 0.01 SOL
        AVAX: 0.02, // Fallback: 1 USD ≈ 0.02 AVAX
        EUR: 0.92, // Fallback: 1 USD ≈ 0.92 EUR
        GBP: 0.79, // Fallback: 1 USD ≈ 0.79 GBP
        JPY: 150.5, // Fallback: 1 USD ≈ 150.5 JPY
        CNY: 7.2, // Fallback: 1 USD ≈ 7.2 CNY
        AED: 3.67, // Fallback: 1 USD ≈ 3.67 AED
        KWD: 0.31, // Fallback: 1 USD ≈ 0.31 KWD
        TWD: 32.0, // Fallback: 1 USD ≈ 32.0 TWD
      };
    }
  }

  // Main function to create the UI components
  function createUI() {
    // Get the main data arrays from the imported module
    const totalIncidentCount = incidents.length; // Get the total count

    // Create statistics container
    const statsContainer = document.createElement("div");
    statsContainer.className = "stats-container";

    // Total incidents count
    const totalIncidentsBox = document.createElement("div");
    totalIncidentsBox.className = "stat-box";
    totalIncidentsBox.id = "total-incidents-stat";
    totalIncidentsBox.innerHTML = `
            <h3>Total Incidents</h3>
            <p>${totalIncidentCount}</p>
        `;
    statsContainer.appendChild(totalIncidentsBox);

    // Total loss amount
    const totalLossBox = document.createElement("div");
    totalLossBox.className = "stat-box";
    totalLossBox.id = "total-loss-stat";
    totalLossBox.innerHTML = `
            <h3>Total Loss (USD)</h3>
            <p>${formatCurrency(analysisResults.totalLoss)}</p>
        `;
    statsContainer.appendChild(totalLossBox);

    tableContainerElement.appendChild(statsContainer);

    // Create settings panel
    createSettingsPanel();

    // Setup filters
    setupFilters();

    // Render the table initially
    updateTable();

    // Setup projects for navigation
    prepareSortedProjects(incidents, rootCauseData);

    // Make the table collapsible
    makeTableCollapsible();

    // Setup analytics
    setupAnalytics();

    // Setup modal functionality
    setupModalListeners();

    // Load user settings
    loadSettings();
  }

  // Helper function to format currency
  function formatCurrency(value) {
    if (typeof value !== "number") return "Unknown";

    return (
      "$" +
      value.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    );
  }

  // Function to set up the modal listeners
  function setupModalListeners() {
    const modal = document.getElementById("rootCauseModal");
    if (!modal) {
      console.warn("Root cause modal not found in the document");
      return;
    }

    const closeBtn = modal.querySelector(".close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
      });
    }

    // Navigation buttons functionality
    const prevButton = modal.querySelector(".prev-button");
    if (prevButton) {
      prevButton.addEventListener("click", () => {
        // Find the previous project with root cause data
        for (let i = currentProjectIndex - 1; i >= 0; i--) {
          const prevProjectName = sortedProjects[i];
          if (rootCauseData[prevProjectName]) {
            console.log(`Navigating to previous project: ${prevProjectName}`);
            showRootCauseModal(prevProjectName);
            return;
          }
        }

        // If we reached here, there are no previous projects with root cause data
        console.log("No previous projects with root cause data");
        alert("No more projects with root cause analysis available.");
      });
    }

    const nextButton = modal.querySelector(".next-button");
    if (nextButton) {
      nextButton.addEventListener("click", () => {
        // Find the next project with root cause data
        for (let i = currentProjectIndex + 1; i < sortedProjects.length; i++) {
          const nextProjectName = sortedProjects[i];
          if (rootCauseData[nextProjectName]) {
            console.log(`Navigating to next project: ${nextProjectName}`);
            showRootCauseModal(nextProjectName);
            return;
          }
        }

        // If we reached here, there are no more projects with root cause data
        console.log("No more projects with root cause data");
        alert("No more projects with root cause analysis available.");
      });
    }

    // Close the modal when the user clicks anywhere outside of the modal content
    window.addEventListener("click", (event) => {
      if (modal && event.target === modal) {
        modal.style.display = "none";
      }
    });
  }

  // Function to set up the analytics section
  function setupAnalytics() {
    // Create analytics container
    const chartsContainer = document.createElement("div");
    chartsContainer.id = "analytics-charts";
    chartsContainer.className = "analytics-charts-container";
    tableContainerElement.appendChild(chartsContainer);

    // Render charts using function from analysis.js
    renderCharts(incidents);

    // Make analytics section collapsible
    makeAnalyticsCollapsible();
  }

  // Function to set up filters after data is loaded
  function setupFilters() {
    // Create filters container
    const filtersContainer = document.createElement("div");
    filtersContainer.className = "filters-container";

    // Create year filter
    const yearFilter = document.createElement("div");
    yearFilter.className = "filter-group";
    yearFilter.innerHTML = `
            <label>Year</label>
            <select id="year-filter">
                <option value="">All Years</option>
                ${
                  analysisResults.countByYear
                    ? Object.keys(analysisResults.countByYear)
                        .sort((a, b) => b - a) // Sort years in descending order
                        .map(
                          (year) => `<option value="${year}">${year}</option>`
                        )
                        .join("")
                    : ""
                }
            </select>
        `;

    // Create attack type filter
    const typeFilter = document.createElement("div");
    typeFilter.className = "filter-group";
    typeFilter.innerHTML = `
            <label>Attack Type</label>
            <select id="type-filter">
                <option value="">All Types</option>
                ${
                  analysisResults.countByType
                    ? Object.keys(analysisResults.countByType)
                        .map(
                          (type) => `<option value="${type}">${type}</option>`
                        )
                        .join("")
                    : ""
                }
            </select>
        `;

    // Create sort filter
    const sortFilter = document.createElement("div");
    sortFilter.className = "filter-group";
    sortFilter.innerHTML = `
            <label>Sort By</label>
            <select id="sort-filter">
                <option value="date">Date (Latest)</option>
                <option value="loss_high">Loss (High to Low)</option>
                <option value="loss_low">Loss (Low to High)</option>
                <option value="root_cause_first">Root Cause First</option>
            </select>
            <span id="root-cause-count" style="display: none; margin-left: 10px; font-size: 0.9em;"></span>
        `;

    // Create currency filter
    const currencyFilter = document.createElement("div");
    currencyFilter.className = "filter-group";
    currencyFilter.innerHTML = `
            <label>Display Currency</label>
            <select id="currency-filter">
                <option value="USD">USD ($)</option>
                <option value="BTC">Bitcoin (₿)</option>
                <option value="ETH">Ethereum (Ξ)</option>
                <option value="EUR">Euro (€)</option>
                <option value="GBP">British Pound (£)</option>
                <option value="JPY">Japanese Yen (¥)</option>
                <option value="CNY">Chinese Yuan (¥)</option>
                <option value="AED">UAE Dirham (د.إ)</option>
                <option value="KWD">Kuwaiti Dinar (د.ك)</option>
                <option value="TWD">Taiwan Dollar (NT$)</option>
            </select>
        `;

    // Create settings button
    const settingsButton = document.createElement("div");
    settingsButton.className = "filter-group settings-filter-group";
    settingsButton.innerHTML = `
            <button id="open-settings" class="settings-button" title="Settings">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
            </button>
        `;

    // Create search box
    const searchBox = document.createElement("input");
    searchBox.id = "search-box";
    searchBox.type = "text";
    searchBox.placeholder = "Search by project name...";
    searchBox.className = "search-box";

    // Create first row for filters
    const filtersRow = document.createElement("div");
    filtersRow.className = "filters-row";

    // Add all filters to container
    filtersContainer.appendChild(yearFilter);
    filtersContainer.appendChild(typeFilter);
    filtersContainer.appendChild(sortFilter);
    filtersContainer.appendChild(currencyFilter);
    filtersContainer.appendChild(settingsButton);
    filtersRow.appendChild(filtersContainer);
    tableContainerElement.appendChild(filtersRow);

    // Create second row for search
    const searchRow = document.createElement("div");
    searchRow.className = "search-row";
    searchRow.appendChild(searchBox);
    tableContainerElement.appendChild(searchRow);

    // Create table container
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "table-container";

    // Create table
    const table = document.createElement("table");
    table.className = "incidents-table";
    tableWrapper.appendChild(table);
    tableContainerElement.appendChild(tableWrapper);

    // Create pagination container
    const paginationContainer = document.createElement("div");
    paginationContainer.className = "pagination-container";
    tableContainerElement.appendChild(paginationContainer);

    // Add event listeners to filters after they're created
    document.getElementById("year-filter")?.addEventListener("change", () => {
      currentPage = 1;
      updateTable();
    });

    document.getElementById("type-filter")?.addEventListener("change", () => {
      currentPage = 1;
      updateTable();
    });

    document.getElementById("sort-filter")?.addEventListener("change", () => {
      updateTable();
    });

    document
      .getElementById("currency-filter")
      ?.addEventListener("change", (e) => {
        displayCurrency = e.target.value;
        updateTable();
      });

    document.getElementById("search-box")?.addEventListener("input", () => {
      currentPage = 1;
      updateTable();
    });

    // Add event listener for the settings button in the filter section
    document.getElementById("open-settings")?.addEventListener("click", () => {
      openSettingsPanel();
    });
  }

  // Main function to update the table with filtered data and pagination
  function updateTable() {
    // Get the table element
    const table = document.querySelector(".incidents-table");
    if (!table) {
      console.error("Table element not found");
      return;
    }

    // Clear the table
    table.innerHTML = "";

    // Create table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    // Column definitions with their data keys and display names
    const columns = [
      { key: "date", display: "Date" },
      { key: "name", display: "Project" },
      { key: "type", display: "Attack Type" },
      { key: "Lost", display: "Loss Amount" },
      { key: "rootCause", display: "Root Cause" },
      { key: "poc", display: "POC" },
    ];

    // Add each header with sort functionality
    columns.forEach((column) => {
      const th = document.createElement("th");
      th.textContent = column.display;
      th.dataset.key = column.key;

      // Add sort indicator if this column is currently sorted
      if (currentSortColumn === column.key) {
        const indicator = document.createElement("span");
        indicator.className = "sort-indicator";
        indicator.textContent = currentSortDirection === "asc" ? " ▲" : " ▼";
        th.appendChild(indicator);
      }

      // Add click event for sorting
      th.addEventListener("click", () => {
        // Toggle direction if same column, otherwise default to descending
        if (currentSortColumn === column.key) {
          currentSortDirection =
            currentSortDirection === "desc" ? "asc" : "desc";
        } else {
          currentSortColumn = column.key;
          currentSortDirection = "desc"; // Default to descending order
        }

        updateTable();
      });

      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement("tbody");

    // Get filter values safely
    const yearFilter = document.getElementById("year-filter");
    const typeFilter = document.getElementById("type-filter");
    const sortFilter = document.getElementById("sort-filter");
    const searchBox = document.getElementById("search-box");

    const selectedYear = yearFilter?.value || "";
    const selectedType = typeFilter?.value || "";
    const sortBy = sortFilter?.value || "date";
    const searchQuery = searchBox?.value.toLowerCase() || "";

    // Filter incidents based on selected criteria
    filteredIncidents = incidents.filter((incident) => {
      if (!incident.dateObj) return false;

      const incidentYear = incident.dateObj.getUTCFullYear().toString();
      const matchesYear = !selectedYear || incidentYear === selectedYear;
      const matchesType = !selectedType || incident.type === selectedType;
      const matchesSearch =
        !searchQuery ||
        incident.name.toLowerCase().includes(searchQuery) ||
        (incident.type && incident.type.toLowerCase().includes(searchQuery));
      return matchesYear && matchesType && matchesSearch;
    });

    // Sort incidents based on header clicks or dropdown
    if (currentSortColumn) {
      // Custom sorting based on the column
      filteredIncidents.sort((a, b) => {
        let valueA, valueB;

        switch (currentSortColumn) {
          case "date":
            return currentSortDirection === "asc"
              ? a.date.localeCompare(b.date)
              : b.date.localeCompare(a.date);
          case "name":
            return currentSortDirection === "asc"
              ? a.name.localeCompare(b.name)
              : b.name.localeCompare(a.name);
          case "type":
            valueA = a.type || "";
            valueB = b.type || "";
            return currentSortDirection === "asc"
              ? valueA.localeCompare(valueB)
              : valueB.localeCompare(valueA);
          case "Lost":
            valueA = a.Lost || 0;
            valueB = b.Lost || 0;
            return currentSortDirection === "asc"
              ? valueA - valueB
              : valueB - valueA;
          case "rootCause":
            valueA = rootCauseData[a.name] ? 1 : 0;
            valueB = rootCauseData[b.name] ? 1 : 0;
            return currentSortDirection === "asc"
              ? valueA - valueB
              : valueB - valueA;
          case "poc":
            valueA = a.Contract ? 1 : 0;
            valueB = b.Contract ? 1 : 0;
            return currentSortDirection === "asc"
              ? valueA - valueB
              : valueB - valueA;
          default:
            return 0;
        }
      });
    } else {
      // Fallback to the dropdown sort if no column sorting is active
      switch (sortBy) {
        case "loss_high":
          filteredIncidents.sort((a, b) => (b.Lost || 0) - (a.Lost || 0));
          break;
        case "loss_low":
          filteredIncidents.sort((a, b) => (a.Lost || 0) - (b.Lost || 0));
          break;
        case "root_cause_first":
          filteredIncidents.sort((a, b) => {
            const aHasRootCause = rootCauseData[a.name] ? 1 : 0;
            const bHasRootCause = rootCauseData[b.name] ? 1 : 0;

            // If both have or don't have root cause, sort by date (latest first)
            if (aHasRootCause === bHasRootCause) {
              return b.date.localeCompare(a.date);
            }

            // Otherwise, prioritize the one with root cause
            return bHasRootCause - aHasRootCause;
          });
          break;
        default: // date
          filteredIncidents.sort((a, b) => b.date.localeCompare(a.date));
      }
    }

    // Calculate pagination boundaries
    const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = 1;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(
      startIndex + itemsPerPage,
      filteredIncidents.length
    );
    const currentIncidents = filteredIncidents.slice(startIndex, endIndex);

    // Add data rows
    currentIncidents.forEach((incident) => {
      const row = document.createElement("tr");

      // Date column
      const dateCell = document.createElement("td");
      dateCell.textContent = formatDate(incident.date);
      row.appendChild(dateCell);

      // Project column
      const projectCell = document.createElement("td");
      projectCell.textContent = incident.name;
      row.appendChild(projectCell);

      // Attack type column
      const typeCell = document.createElement("td");
      typeCell.textContent = incident.type || "-";
      row.appendChild(typeCell);

      // Loss amount column
      const lossCell = document.createElement("td");
      lossCell.textContent = formatLoss(incident.Lost, incident.lossType);
      row.appendChild(lossCell);

      // Root Cause column
      const rootCauseCell = document.createElement("td");
      // Check if root cause data exists for this project
      if (rootCauseData[incident.name]) {
        const rootCauseButton = document.createElement("button");
        rootCauseButton.textContent = "View Analysis";
        rootCauseButton.className = "view-root-cause";
        rootCauseButton.addEventListener("click", () => {
          showRootCauseModal(incident.name);
        });
        rootCauseCell.appendChild(rootCauseButton);
      } else {
        rootCauseCell.textContent = "-";
      }
      row.appendChild(rootCauseCell);

      // POC link column
      const pocCell = document.createElement("td");
      if (incident.Contract) {
        const pocLink = document.createElement("a");
        pocLink.href = `https://github.com/SunWeb3Sec/DeFiHackLabs/tree/main/${incident.Contract}`;
        pocLink.textContent = "View POC";
        pocLink.className = "view-poc";
        pocLink.target = "_blank";
        pocCell.appendChild(pocLink);
      } else {
        pocCell.textContent = "-";
      }
      row.appendChild(pocCell);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);

    // Update pagination controls
    updatePagination(totalPages);

    // Update statistics
    updateStats(filteredIncidents.length); // Pass the count of filtered incidents

    // Update analytics charts with filtered data
    updateAnalytics(filteredIncidents);
  }

  // Function to update pagination controls
  function updatePagination(totalPages) {
    // Clear pagination container
    const paginationContainer = document.querySelector(".pagination-container");
    if (!paginationContainer) {
      console.error("Pagination container not found");
      return;
    }

    paginationContainer.innerHTML = "";

    if (totalPages <= 1) {
      return;
    }

    // Create page info display
    const pageInfo = document.createElement("div");
    pageInfo.className = "page-info";
    pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${filteredIncidents.length} incidents)`;
    paginationContainer.appendChild(pageInfo);

    // Create pagination buttons
    const pageButtons = document.createElement("div");
    pageButtons.className = "page-buttons";

    // Previous page button
    const prevButton = document.createElement("button");
    prevButton.textContent = "< Previous";
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        updateTable();
      }
    });
    pageButtons.appendChild(prevButton);

    // Next page button
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next >";
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        updateTable();
      }
    });
    pageButtons.appendChild(nextButton);

    paginationContainer.appendChild(pageButtons);
  }

  // Function to calculate the loss in the selected display currency
  function convertLossToDisplayCurrency(loss, originalCurrency) {
    if (!loss || isNaN(loss)) return 0;

    // First convert to USD using the live rates from CoinGecko
    let lossInUSD = loss;

    // Convert original currency to USD based on the currency type
    if (originalCurrency === "ETH" || originalCurrency === "WETH") {
      if (window.conversionRates["ETH"]) {
        // We have the ETH rate (1/ETH price in USD), need to convert ETH to USD
        // If 1 USD = 0.0004 ETH, then 1 ETH = 1/0.0004 = 2500 USD
        lossInUSD = loss * (1 / window.conversionRates["ETH"]);
      } else {
        // Fallback value if rate is not available
        lossInUSD = loss * 2500;
        console.warn("Using fallback value for ETH to USD conversion");
      }
    } else if (originalCurrency === "BNB" || originalCurrency === "WBNB") {
      if (window.conversionRates["BNB"]) {
        lossInUSD = loss * (1 / window.conversionRates["BNB"]);
      } else {
        // Fallback value if rate is not available
        lossInUSD = loss * 500;
        console.warn("Using fallback value for BNB to USD conversion");
      }
    } else if (originalCurrency === "BTC" || originalCurrency === "WBTC") {
      if (window.conversionRates["BTC"]) {
        lossInUSD = loss * (1 / window.conversionRates["BTC"]);
      } else {
        // Fallback value if rate is not available
        lossInUSD = loss * 60000;
        console.warn("Using fallback value for BTC to USD conversion");
      }
    } else if (originalCurrency === "MATIC") {
      if (window.conversionRates["MATIC"]) {
        lossInUSD = loss * (1 / window.conversionRates["MATIC"]);
      } else {
        lossInUSD = loss * 2; // Fallback: 1 MATIC ≈ $2
        console.warn("Using fallback value for MATIC to USD conversion");
      }
    } else if (originalCurrency === "SOL") {
      if (window.conversionRates["SOL"]) {
        lossInUSD = loss * (1 / window.conversionRates["SOL"]);
      } else {
        lossInUSD = loss * 100; // Fallback: 1 SOL ≈ $100
        console.warn("Using fallback value for SOL to USD conversion");
      }
    } else if (originalCurrency === "AVAX") {
      if (window.conversionRates["AVAX"]) {
        lossInUSD = loss * (1 / window.conversionRates["AVAX"]);
      } else {
        lossInUSD = loss * 50; // Fallback: 1 AVAX ≈ $50
        console.warn("Using fallback value for AVAX to USD conversion");
      }
    } else if (originalCurrency !== "USD") {
      // For other currencies, assume it's already in USD
      // This is a fallback for currencies we haven't added specific handling for
      lossInUSD = loss;
      console.warn(
        `No specific handling for ${originalCurrency}, assuming USD equivalent`
      );
    }

    // Then convert from USD to display currency using the fetched rates
    if (displayCurrency === "USD") return lossInUSD;

    // Use the conversion rate or fallback to 1 if not available
    const rate = window.conversionRates[displayCurrency] || 1;
    return lossInUSD * rate;
  }

  // Function to update statistics
  function updateStats(filteredCount) {
    // Update total incidents count (for the filtered view)
    const totalIncidentsElement = document.getElementById(
      "total-incidents-stat"
    );
    if (totalIncidentsElement) {
      totalIncidentsElement.querySelector("p").textContent = filteredCount;
    } else {
      console.warn("Could not find total incidents stat element");
    }

    // Calculate total loss for filtered data
    let totalLoss = 0;
    filteredIncidents.forEach((incident) => {
      if (incident.Lost && !isNaN(incident.Lost)) {
        totalLoss += convertLossToDisplayCurrency(
          parseFloat(incident.Lost),
          incident.lossType || "USD"
        );
      }
    });

    // Format total loss with the appropriate currency symbol
    let formattedLoss;
    switch (displayCurrency) {
      case "USD":
        formattedLoss =
          "$" +
          totalLoss.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          });
        break;
      case "BTC":
        formattedLoss =
          "₿" +
          totalLoss.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 8,
          });
        break;
      case "ETH":
        formattedLoss =
          "Ξ" +
          totalLoss.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6,
          });
        break;
      case "EUR":
        formattedLoss =
          "€" +
          totalLoss.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          });
        break;
      case "GBP":
        formattedLoss =
          "£" +
          totalLoss.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          });
        break;
      case "JPY":
        formattedLoss =
          "¥" +
          totalLoss.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          });
        break;
      case "CNY":
        formattedLoss =
          "¥" +
          totalLoss.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          });
        break;
      case "AED":
        formattedLoss =
          "د.إ" +
          totalLoss.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          });
        break;
      case "KWD":
        formattedLoss =
          "د.ك" +
          totalLoss.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
          });
        break;
      default:
        formattedLoss =
          totalLoss.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          }) +
          " " +
          displayCurrency;
    }

    // Update total loss display
    const totalLossElement = document.getElementById("total-loss-stat");
    if (totalLossElement) {
      totalLossElement.querySelector("p").textContent = formattedLoss;
    }

    // Update title to include currency
    const lossTitle = totalLossElement?.querySelector("h3");
    if (lossTitle) {
      lossTitle.textContent = `Total Loss (${displayCurrency})`;
    }

    // Update root cause count if sorting by root cause
    const sortBy = document.getElementById("sort-filter")?.value;
    const rootCauseCountElement = document.getElementById("root-cause-count");

    if (rootCauseCountElement && sortBy === "root_cause_first") {
      // Count incidents with root cause data
      const rootCauseCount = filteredIncidents.filter(
        (incident) => rootCauseData && rootCauseData[incident.name]
      ).length;

      rootCauseCountElement.textContent = `(${rootCauseCount} root cause reports available)`;
      rootCauseCountElement.style.display = "inline";
    } else if (rootCauseCountElement) {
      rootCauseCountElement.style.display = "none";
    }
  }

  // Function to format date for display
  function formatDate(dateStr) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);

    // Convert month to English month name
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthName = months[parseInt(month, 10) - 1];

    return `${monthName} ${parseInt(day, 10)}, ${year}`;
  }

  // Function to convert date to YYYY-MM-DD format for rootCauseData comparison
  function formatDateForComparison(dateStr) {
    if (!dateStr) return "";
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);

    return `${year}-${month}-${day}`;
  }

  // Function to format loss amount
  function formatLoss(loss, lossType = "USD") {
    if (!loss && loss !== 0) return "Unknown";

    // Convert to display currency
    const convertedLoss = convertLossToDisplayCurrency(loss, lossType);

    // Format number
    let formattedValue;
    if (displayCurrency === "BTC") {
      // For BTC, show more decimal places
      if (convertedLoss >= 1000) {
        formattedValue = (convertedLoss / 1000).toFixed(4) + "K";
      } else {
        formattedValue = convertedLoss.toFixed(8);
      }
    } else if (displayCurrency === "ETH") {
      // For ETH, show more decimal places
      if (convertedLoss >= 1000) {
        formattedValue = (convertedLoss / 1000).toFixed(3) + "K";
      } else {
        formattedValue = convertedLoss.toFixed(6);
      }
    } else {
      // For fiat currencies, use standard formatting
      if (convertedLoss >= 1000000) {
        formattedValue = (convertedLoss / 1000000).toFixed(2) + "M";
      } else if (convertedLoss >= 1000) {
        formattedValue = (convertedLoss / 1000).toFixed(2) + "K";
      } else {
        formattedValue = convertedLoss.toFixed(2);
      }
    }

    // Add currency symbol
    switch (displayCurrency) {
      case "USD":
        return "$" + formattedValue;
      case "BTC":
        return "₿" + formattedValue;
      case "ETH":
        return "Ξ" + formattedValue;
      case "EUR":
        return "€" + formattedValue;
      case "GBP":
        return "£" + formattedValue;
      case "JPY":
        return "¥" + formattedValue;
      case "CNY":
        return "¥" + formattedValue;
      case "AED":
        return "د.إ" + formattedValue;
      case "KWD":
        return "د.ك" + formattedValue;
      case "TWD":
        return "NT$" + formattedValue;
      default:
        return formattedValue + " " + displayCurrency;
    }
  }

  // Function to format POC link
  function formatPocLink(pocLink) {
    if (!pocLink) return "-";

    // Use full GitHub repository path
    const githubPrefix =
      "https://github.com/SunWeb3Sec/DeFiHackLabs/tree/main/";

    // If link is already a complete URL, use it directly
    if (pocLink.startsWith("http")) {
      return `<a href="${pocLink}" target="_blank">View POC</a>`;
    }

    // Otherwise add GitHub prefix
    return `<a href="${githubPrefix}${pocLink}" target="_blank">View POC</a>`;
  }

  // Function to update navigation button states based on current project index
  function updateNavigationButtonStates() {
    const prevButton = document.querySelector(".prev-button");
    const nextButton = document.querySelector(".next-button");

    if (!prevButton || !nextButton) {
      console.warn("Navigation buttons not found");
      return;
    }

    // Find previous project with root cause data
    let hasPrevious = false;
    for (let i = currentProjectIndex - 1; i >= 0; i--) {
      if (rootCauseData[sortedProjects[i]]) {
        hasPrevious = true;
        break;
      }
    }

    // Find next project with root cause data
    let hasNext = false;
    for (let i = currentProjectIndex + 1; i < sortedProjects.length; i++) {
      if (rootCauseData[sortedProjects[i]]) {
        hasNext = true;
        break;
      }
    }

    // Disable/enable previous button based on available projects with root cause data
    if (!hasPrevious) {
      prevButton.disabled = true;
      prevButton.classList.add("disabled");
    } else {
      prevButton.disabled = false;
      prevButton.classList.remove("disabled");
    }

    // Disable/enable next button based on available projects with root cause data
    if (!hasNext) {
      nextButton.disabled = true;
      nextButton.classList.add("disabled");
    } else {
      nextButton.disabled = false;
      nextButton.classList.remove("disabled");
    }

    console.log(
      `Navigation state: index=${currentProjectIndex}, hasPrevious=${hasPrevious}, hasNext=${hasNext}`
    );
  }

  // Function to show the root cause modal with the project's data
  function showRootCauseModal(projectName) {
    console.log(`Showing root cause for: ${projectName}`);

    // Update current project index for navigation
    currentProjectIndex = sortedProjects.indexOf(projectName);
    console.log(`Current project index: ${currentProjectIndex}`);

    // Get the project data
    const projectData = rootCauseData[projectName];

    // If no root cause data is available, try to find the next project with data
    if (!projectData) {
      console.warn(`No root cause data found for ${projectName}`);

      // Look for the next project with root cause data
      let nextIndex = currentProjectIndex;
      let foundProject = false;

      // Try to find a project with root cause data
      while (nextIndex < sortedProjects.length - 1 && !foundProject) {
        nextIndex++;
        const nextProjectName = sortedProjects[nextIndex];
        if (rootCauseData[nextProjectName]) {
          foundProject = true;
          console.log(
            `Found next project with root cause data: ${nextProjectName}`
          );
          return showRootCauseModal(nextProjectName);
        }
      }

      // If we couldn't find any project with root cause data, show a message
      alert("No root cause analysis available for this project.");
      return;
    }

    // Find the incident in the incidents array
    const incident = incidents.find((inc) => inc.name === projectName);
    if (!incident) {
      console.error(`No incident data found for ${projectName}`);
      return;
    }

    // Log for debugging
    console.log(`Project: ${projectName}`);
    console.log(`Incident date: ${incident.date}`);
    console.log(`Root cause date: ${projectData.date}`);
    console.log(
      `Formatted incident date: ${formatDateForComparison(incident.date)}`
    );

    // Get modal elements
    const modal = document.getElementById("rootCauseModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalProjectName = document.getElementById("modalProjectName");
    const modalType = document.getElementById("modalType");
    const modalDate = document.getElementById("modalDate");
    const modalLoss = document.getElementById("modalLoss");
    const modalRootCause = document.getElementById("modalRootCause");
    const modalImagesSection = document.getElementById("modalImagesSection");
    const modalImages = document.getElementById("modalImages");

    if (
      !modal ||
      !modalTitle ||
      !modalProjectName ||
      !modalType ||
      !modalDate ||
      !modalLoss ||
      !modalRootCause ||
      !modalImagesSection ||
      !modalImages
    ) {
      console.error("One or more modal elements not found");
      return;
    }

    // Populate modal with project data
    modalTitle.textContent = "Root Cause Analysis";
    modalProjectName.textContent = projectName;
    modalType.textContent = `Attack Type: ${
      projectData.type || incident.type || "Unknown"
    }`;
    modalDate.textContent = `Date: ${
      projectData.date || formatDate(incident.date) || "Unknown"
    }`;
    modalLoss.textContent = `Loss: ${formatLoss(
      projectData.Lost || incident.Lost,
      incident.lossType
    )}`;

    // Root cause analysis
    // Use innerHTML to render markdown content
    modalRootCause.innerHTML = projectData.rootCause
      ? marked.parse(projectData.rootCause)
      : "No root cause analysis available.";

    // Images (if any)
    modalImages.innerHTML = "";

    if (projectData.images && projectData.images.length > 0) {
      projectData.images.forEach((imageUrl) => {
        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = `${projectName} incident image`;
        modalImages.appendChild(img);
      });
      modalImagesSection.style.display = "block";
    } else {
      modalImages.innerHTML = "<p>No images available.</p>";
      modalImagesSection.style.display = "none";
    }

    // Display the modal
    modal.style.display = "block";

    // Update navigation button states
    updateNavigationButtonStates();

    // Log information about the current project
    console.log(`Project: ${projectName}, Index: ${currentProjectIndex}`);
    console.log(
      `Root cause data available: ${Object.keys(rootCauseData).length} projects`
    );

    // Debug LavaLending specifically
    if (projectName === "LavaLending") {
      console.log("LavaLending root cause data:", projectData);
      console.log("LavaLending index in sorted projects:", currentProjectIndex);
      console.log(
        "Is LavaLending the last project?",
        currentProjectIndex === sortedProjects.length - 1
      );
    }
  }

  // Function to prepare sorted projects list for navigation
  function prepareSortedProjects(incidentsData, rootCauseLookup) {
    if (!incidentsData || !rootCauseLookup) {
      console.warn("Missing data for prepareSortedProjects");
      sortedProjects = [];
      return;
    }

    // Filter to only include projects with root cause data
    // This ensures we only navigate between projects that have analysis
    sortedProjects = incidentsData
      .filter((incident) => rootCauseLookup[incident.name]) // Only include those with root cause data
      .map((incident) => incident.name) // Get project names
      .sort((a, b) => {
        // Find corresponding incidents to sort by date
        const dateA = incidentsData.find((inc) => inc.name === a)?.date || "";
        const dateB = incidentsData.find((inc) => inc.name === b)?.date || "";
        return dateB.localeCompare(dateA); // Sort by date, newest first
      });

    // Log the projects with root cause data for debugging
    console.log(
      "Projects with root cause data for navigation:",
      sortedProjects.length
    );
    console.log("First 5 projects:", sortedProjects.slice(0, 5));
    console.log("Last 5 projects:", sortedProjects.slice(-5));
  }

  // Function to make the incidents table collapsible
  function makeTableCollapsible() {
    // Create a toggle button container
    const toggleContainer = document.createElement("div");
    toggleContainer.className = "toggle-container";

    // Create the toggle button
    const toggleButton = document.createElement("button");
    toggleButton.className = "toggle-table-button";
    toggleButton.innerHTML = "Hide Incidents Table <span>▲</span>";
    toggleButton.setAttribute("aria-expanded", "true");
    toggleContainer.appendChild(toggleButton);

    // Find the table container
    const tableContainer = document.querySelector(".table-container");
    const paginationContainer = document.querySelector(".pagination-container");
    const analyticsChartContainer = document.getElementById("analytics-charts");

    // If we can't find the elements, return early
    if (!tableContainer || !analyticsChartContainer) {
      console.warn("Could not find table or analytics container");
      return;
    }

    // Insert toggle button before the table
    if (tableContainer.parentNode) {
      tableContainer.parentNode.insertBefore(toggleContainer, tableContainer);
    }

    // Function to toggle the table visibility
    toggleButton.addEventListener("click", function () {
      const isExpanded = toggleButton.getAttribute("aria-expanded") === "true";

      if (isExpanded) {
        // Collapse the table
        tableContainer.style.display = "none";
        if (paginationContainer) paginationContainer.style.display = "none";
        toggleButton.innerHTML = "Show Incidents Table <span>▼</span>";
        toggleButton.setAttribute("aria-expanded", "false");
        // Scroll to analytics
        analyticsChartContainer.scrollIntoView({ behavior: "smooth" });
      } else {
        // Expand the table
        tableContainer.style.display = "block";
        if (paginationContainer) paginationContainer.style.display = "block";
        toggleButton.innerHTML = "Hide Incidents Table <span>▲</span>";
        toggleButton.setAttribute("aria-expanded", "true");
      }
    });
  }

  // Function to create and set up the settings panel
  function createSettingsPanel() {
    // Create panel overlay
    const overlay = document.createElement("div");
    overlay.className = "panel-overlay";
    document.body.appendChild(overlay);

    // Create settings panel
    const settingsPanel = document.createElement("div");
    settingsPanel.className = "settings-panel";
    settingsPanel.innerHTML = `
            <div class="settings-header">
                <h3>Display Settings</h3>
                <button class="close-settings">×</button>
            </div>
            <div class="settings-content">
                <div class="settings-section">
                    <h4>Theme</h4>
                    <div class="setting-item">
                        <span class="setting-label">Light Mode</span>
                        <label class="switch">
                            <input type="checkbox" id="toggle-theme">
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
                <div class="settings-section">
                    <h4>Visual Effects</h4>
                    <div class="setting-item">
                        <span class="setting-label">Reduce Glow Effects</span>
                        <label class="switch">
                            <input type="checkbox" id="toggle-glow">
                            <span class="slider round"></span>
                        </label>
                    </div>
                    <div class="setting-item">
                        <span class="setting-label">High Contrast Mode</span>
                        <label class="switch">
                            <input type="checkbox" id="toggle-contrast">
                            <span class="slider round"></span>
                        </label>
                    </div>
                    <div class="setting-item">
                        <span class="setting-label">Disable Animations</span>
                        <label class="switch">
                            <input type="checkbox" id="toggle-animations">
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
                
                <div class="settings-section">
                </div>
                
                <button class="reset-button" id="reset-settings">Reset to Default</button>
            </div>
        `;
    document.body.appendChild(settingsPanel);

    // Add event listeners
    document
      .getElementById("open-settings")
      ?.addEventListener("click", openSettingsPanel);
    document
      .querySelector(".close-settings")
      ?.addEventListener("click", closeSettingsPanel);
    overlay.addEventListener("click", closeSettingsPanel);

    // Toggle light/dark mode
    document
      .getElementById("toggle-theme")
      ?.addEventListener("change", function () {
        document.body.classList.toggle("light-mode", this.checked);
        saveSettings();
      });

    // Toggle settings
    document
      .getElementById("toggle-glow")
      ?.addEventListener("change", function () {
        document.body.classList.toggle("low-glow", this.checked);
        saveSettings();
      });

    document
      .getElementById("toggle-contrast")
      ?.addEventListener("change", function () {
        document.body.classList.toggle("high-contrast", this.checked);
        saveSettings();
      });

    document
      .getElementById("toggle-animations")
      ?.addEventListener("change", function () {
        document.body.classList.toggle("no-animations", this.checked);
        saveSettings();
      });

    // Slider for text size
    const textSizeSlider = document.getElementById("text-size-slider");
    if (textSizeSlider) {
      textSizeSlider.addEventListener("input", function () {
        document.documentElement.style.fontSize = `${this.value}%`;
        saveSettings();
      });
    }

    // Reset button
    document
      .getElementById("reset-settings")
      ?.addEventListener("click", resetSettings);
  }

  // Open settings panel
  function openSettingsPanel() {
    const settingsPanel = document.querySelector(".settings-panel");
    const overlay = document.querySelector(".panel-overlay");

    if (settingsPanel) settingsPanel.classList.add("open");
    if (overlay) overlay.classList.add("active");
  }

  // Close settings panel
  function closeSettingsPanel() {
    const settingsPanel = document.querySelector(".settings-panel");
    const overlay = document.querySelector(".panel-overlay");

    if (settingsPanel) settingsPanel.classList.remove("open");
    if (overlay) overlay.classList.remove("active");
  }

  // Save settings to localStorage
  function saveSettings() {
    const settings = {
      lightMode: document.getElementById("toggle-theme")?.checked || false,
      lowGlow: document.getElementById("toggle-glow")?.checked || false,
      highContrast:
        document.getElementById("toggle-contrast")?.checked || false,
      noAnimations:
        document.getElementById("toggle-animations")?.checked || false,
      textSize: document.getElementById("text-size-slider")?.value || 100,
    };

    localStorage.setItem("defihack-settings", JSON.stringify(settings));
  }

  // Load settings from localStorage
  function loadSettings() {
    const savedSettings = localStorage.getItem("defihack-settings");
    if (!savedSettings) return;

    try {
      const settings = JSON.parse(savedSettings);

      // Apply theme setting
      if (settings.lightMode) {
        document.body.classList.add("light-mode");
        document.getElementById("toggle-theme").checked = true;
      }

      // Apply visual settings
      if (settings.lowGlow) {
        document.body.classList.add("low-glow");
        document.getElementById("toggle-glow").checked = true;
      }

      if (settings.highContrast) {
        document.body.classList.add("high-contrast");
        document.getElementById("toggle-contrast").checked = true;
      }

      if (settings.noAnimations) {
        document.body.classList.add("no-animations");
        document.getElementById("toggle-animations").checked = true;
      }

      // Apply text size
      if (settings.textSize) {
        document.documentElement.style.fontSize = `${settings.textSize}%`;
        if (document.getElementById("text-size-slider")) {
          document.getElementById("text-size-slider").value = settings.textSize;
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  // Reset settings to default
  function resetSettings() {
    // Clear classes
    document.body.classList.remove(
      "light-mode",
      "low-glow",
      "high-contrast",
      "no-animations"
    );

    // Reset form controls
    if (document.getElementById("toggle-theme"))
      document.getElementById("toggle-theme").checked = false;
    if (document.getElementById("toggle-glow"))
      document.getElementById("toggle-glow").checked = false;
    if (document.getElementById("toggle-contrast"))
      document.getElementById("toggle-contrast").checked = false;
    if (document.getElementById("toggle-animations"))
      document.getElementById("toggle-animations").checked = false;
    if (document.getElementById("text-size-slider"))
      document.getElementById("text-size-slider").value = 100;

    // Reset text size
    document.documentElement.style.fontSize = "100%";

    // Save the default settings
    saveSettings();

    // Show feedback
    const resetButton = document.getElementById("reset-settings");
    if (resetButton) {
      const originalText = resetButton.textContent;
      resetButton.textContent = "Settings Reset!";
      setTimeout(() => {
        resetButton.textContent = originalText;
      }, 1500);
    }
  }

  // Function to update analytics based on filtered data
  function updateAnalytics(filteredData) {
    // Don't update if analytics container isn't visible
    const analyticsContainer = document.getElementById("analytics-charts");
    if (!analyticsContainer || analyticsContainer.style.display === "none") {
      return; // Skip update if analytics are hidden
    }

    // Check if we have data to analyze
    if (!filteredData || filteredData.length === 0) {
      analyticsContainer.innerHTML =
        '<p class="no-data-message">No data available for the current filters.</p>';
      return;
    }

    // Analyze the filtered data directly
    // Calculate analysis results for filtered data
    let filteredAnalysis = analyzeFilteredData(filteredData);

    // Render charts with filtered data
    renderCharts(filteredData, filteredAnalysis);
  }

  // Function to perform analytics on filtered data
  function analyzeFilteredData(filteredData) {
    // Create a filtered analytics result object
    const filteredResults = {};

    // Calculate total loss in user's preferred display currency
    filteredResults.totalLoss = filteredData.reduce((sum, incident) => {
      if (typeof incident.Lost === "number" && !isNaN(incident.Lost)) {
        // Convert to user's selected display currency
        const lossInDisplayCurrency = convertLossToDisplayCurrency(
          incident.Lost,
          incident.lossType || "USD"
        );
        return sum + lossInDisplayCurrency;
      }
      return sum;
    }, 0);

    // Normalize to USD for consistent analytics if not in USD
    if (displayCurrency !== "USD") {
      const conversionFactor =
        1 / (window.conversionRates[displayCurrency] || 1);
      filteredResults.totalLoss = filteredResults.totalLoss * conversionFactor;
    }

    // Count incidents by year
    filteredResults.countByYear = {};
    filteredData.forEach((incident) => {
      if (incident.dateObj) {
        const year = incident.dateObj.getUTCFullYear().toString();
        filteredResults.countByYear[year] =
          (filteredResults.countByYear[year] || 0) + 1;
      }
    });

    // Count incidents by type
    filteredResults.countByType = {};
    filteredData.forEach((incident) => {
      if (incident.type) {
        filteredResults.countByType[incident.type] =
          (filteredResults.countByType[incident.type] || 0) + 1;
      }
    });

    // Aggregate loss by type in user's preferred display currency
    filteredResults.lossByType = {};
    filteredData.forEach((incident) => {
      if (
        incident.type &&
        typeof incident.Lost === "number" &&
        !isNaN(incident.Lost)
      ) {
        const lossInDisplayCurrency = convertLossToDisplayCurrency(
          incident.Lost,
          incident.lossType || "USD"
        );

        // Normalize to USD if not already in USD
        let normalizedLoss = lossInDisplayCurrency;
        if (displayCurrency !== "USD") {
          const conversionFactor =
            1 / (window.conversionRates[displayCurrency] || 1);
          normalizedLoss = lossInDisplayCurrency * conversionFactor;
        }

        filteredResults.lossByType[incident.type] =
          (filteredResults.lossByType[incident.type] || 0) + normalizedLoss;
      }
    });

    // Aggregate loss by year in user's preferred display currency
    filteredResults.lossByYear = {};
    filteredData.forEach((incident) => {
      if (
        incident.dateObj &&
        typeof incident.Lost === "number" &&
        !isNaN(incident.Lost)
      ) {
        const year = incident.dateObj.getUTCFullYear().toString();
        const lossInDisplayCurrency = convertLossToDisplayCurrency(
          incident.Lost,
          incident.lossType || "USD"
        );

        // Normalize to USD if not already in USD
        let normalizedLoss = lossInDisplayCurrency;
        if (displayCurrency !== "USD") {
          const conversionFactor =
            1 / (window.conversionRates[displayCurrency] || 1);
          normalizedLoss = lossInDisplayCurrency * conversionFactor;
        }

        filteredResults.lossByYear[year] =
          (filteredResults.lossByYear[year] || 0) + normalizedLoss;
      }
    });

    // Get protocol frequency
    const protocolCounts = getProtocolFrequencyFromData(filteredData);
    filteredResults.protocolFrequency = protocolCounts;

    // Attack type by year calculation
    const attackTypesByYear = getAttackTypesByYearFromData(
      filteredData,
      filteredResults.countByType
    );
    filteredResults.attackTypesByYear = attackTypesByYear;

    // Get root cause frequency from filtered data
    const rootCauseFreq = getRootCauseFrequency(filteredData);
    filteredResults.rootCauseFrequency = rootCauseFreq;

    return filteredResults;
  }

  // Get root cause frequency from filtered data
  function getRootCauseFrequency(filteredData) {
    const counts = {};
    for (const incident of filteredData) {
      const rootCauseInfo = rootCauseData[incident.name];
      if (rootCauseInfo && rootCauseInfo.type) {
        const mainType = rootCauseInfo.type.split(",")[0].trim();
        if (mainType) {
          counts[mainType] = (counts[mainType] || 0) + 1;
        }
      } else if (incident.type) {
        counts[incident.type] = (counts[incident.type] || 0) + 1;
      }
    }
    return counts;
  }

  // Get protocol frequency from filtered data
  function getProtocolFrequencyFromData(filteredData) {
    const protocolCounts = {};
    const protocolMap = {}; // Map to normalize similar protocol names

    // Create a mapping of common protocol name variations
    const commonProtocolMap = {
      // Exact matches or substring matches for known protocols
      uni: "Uniswap",
      sushi: "SushiSwap",
      pancake: "PancakeSwap",
      curve: "Curve Finance",
      balancer: "Balancer",
      aave: "Aave",
      compound: "Compound",
      maker: "MakerDAO",
      weth: "Wrapped ETH",
      yearn: "Yearn Finance",
      kyber: "Kyber Network",
      synthetix: "Synthetix",
      "0x": "0x Protocol",
      cream: "Cream Finance",
      harvest: "Harvest Finance",
      bancor: "Bancor",
      parity: "Parity",
      beanstalk: "Beanstalk",
      ronin: "Ronin Bridge",
      badger: "BadgerDAO",
      cover: "Cover Protocol",
      pickle: "Pickle Finance",
      dforce: "dForce",
      lend: "LendHub",
      nomad: "Nomad Bridge",
      poly: "Polygon",
      harmony: "Harmony",
      rari: "Rari Capital",
      bsc: "Binance Smart Chain",
      ftx: "FTX",
      euler: "Euler Finance",
      mango: "Mango Markets",
      deus: "Deus Finance",
      fei: "Fei Protocol",
    };

    // Special full name handling - exact matches override the substring matching
    const exactNameMap = {
      bZx: "bZx",
      dYdX: "dYdX",
      AlchemixFinance: "Alchemix Finance",
      Opyn: "Opyn Protocol",
      pNetwork: "pNetwork",
      GMX: "GMX",
      BEAN: "Bean Protocol",
      "FEI+TRIBE": "Fei Protocol",
      CREAM: "Cream Finance",
      PAID: "PAID Network",
      DODO: "DODO Exchange",
      ENS: "ENS",
      PancakeBunny: "PancakeBunny",
      BurgerSwap: "BurgerSwap",
      ForceDAO: "ForceDAO",
      "Grim Finance": "Grim Finance",
      "88mph": "88mph",
      "Orion Protocol": "Orion Protocol",
    };

    // Helper function to check if a string contains any of the patterns
    const containsAny = (str, patterns) => {
      const lowerStr = str.toLowerCase();
      return patterns.some((pattern) =>
        lowerStr.includes(pattern.toLowerCase())
      );
    };

    // Cache for processed names to ensure consistency
    const processedNameCache = new Map();

    // Iterate through all incidents
    for (const incident of filteredData) {
      if (!incident.name) continue;

      // Check if we've already processed this name
      if (processedNameCache.has(incident.name)) {
        const cached = processedNameCache.get(incident.name);
        protocolCounts[cached] = (protocolCounts[cached] || 0) + 1;
        if (!protocolMap[cached]) protocolMap[cached] = new Set();
        protocolMap[cached].add(incident.name);
        continue;
      }

      // Skip certain patterns
      if (
        /^0x[a-fA-F0-9]{10,}$/.test(incident.name) ||
        containsAny(incident.name, [
          "unverified",
          "unknown",
          "null",
          "mev",
          "wallet",
        ])
      ) {
        continue;
      }

      // Check for exact name matches first
      if (exactNameMap[incident.name]) {
        const mappedName = exactNameMap[incident.name];
        processedNameCache.set(incident.name, mappedName);
        protocolCounts[mappedName] = (protocolCounts[mappedName] || 0) + 1;
        continue;
      }

      // Clean the protocol name
      let cleanName = incident.name
        .replace(/\s?[vV]\d+(\.\d+)?/i, "")
        .replace(/\s+Protocol$/i, "")
        .replace(/\s+Finance$/i, "")
        .replace(/\s+DAO$/i, "")
        .replace(/\s+DeFi$/i, "")
        .replace(/\s+NFT$/i, "")
        .replace(/\s+Swap$/i, "")
        .replace(/\s+Bridge$/i, "")
        .replace(/\s+Exchange$/i, "")
        .replace(/\s+Capital$/i, "")
        .replace(/\s+Network$/i, "")
        .trim();

      // Extract core name
      const nameComponents = cleanName.split(/[\s_\-()]/);
      const coreName = nameComponents[0].toLowerCase();

      // Check for common protocol name matches
      let foundMatch = false;
      for (const [pattern, mappedName] of Object.entries(commonProtocolMap)) {
        if (
          coreName === pattern ||
          coreName.includes(pattern) ||
          cleanName.toLowerCase().includes(pattern.toLowerCase())
        ) {
          processedNameCache.set(incident.name, mappedName);
          protocolCounts[mappedName] = (protocolCounts[mappedName] || 0) + 1;
          foundMatch = true;
          break;
        }
      }

      if (foundMatch) continue;

      // Default name handling
      let canonicalName;

      // For multi-word names, keep the full cleaned name with proper capitalization
      if (nameComponents.length > 1) {
        canonicalName = nameComponents
          .map(
            (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          )
          .join(" ");
      } else {
        // For single word, capitalize first letter
        canonicalName =
          coreName.charAt(0).toUpperCase() + coreName.slice(1).toLowerCase();
      }

      processedNameCache.set(incident.name, canonicalName);
      protocolCounts[canonicalName] = (protocolCounts[canonicalName] || 0) + 1;
    }

    // Filter out protocols with only one occurrence
    const filteredCounts = Object.entries(protocolCounts)
      .filter(([, count]) => count > 1)
      .reduce((obj, [protocol, count]) => {
        obj[protocol] = count;
        return obj;
      }, {});

    // Return top 15 protocols
    return Object.entries(filteredCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 15)
      .reduce((obj, [protocol, count]) => {
        obj[protocol] = count;
        return obj;
      }, {});
  }

  // Get attack types by year from filtered data
  function getAttackTypesByYearFromData(filteredData, countByType) {
    // Get unique years and attack types
    const years = new Set();

    // First pass: get all unique years
    filteredData.forEach((incident) => {
      if (incident.dateObj && incident.type) {
        const year = incident.dateObj.getUTCFullYear().toString();
        years.add(year);
      }
    });

    // Convert sets to sorted arrays
    const sortedYears = Array.from(years).sort();

    // Keep only top 5 attack types to avoid chart clutter
    const topAttackTypes = Object.entries(countByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type]) => type);

    // Create data structure for each attack type by year
    const result = {};
    topAttackTypes.forEach((attackType) => {
      result[attackType] = sortedYears.reduce((acc, year) => {
        acc[year] = 0;
        return acc;
      }, {});
    });

    // Second pass: count incidents by attack type and year
    filteredData.forEach((incident) => {
      if (
        incident.dateObj &&
        incident.type &&
        topAttackTypes.includes(incident.type)
      ) {
        const year = incident.dateObj.getUTCFullYear().toString();
        result[incident.type][year]++;
      }
    });

    return {
      years: sortedYears,
      attackTypes: topAttackTypes,
      data: result,
    };
  }
});
