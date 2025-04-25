// Import incident data loader
import { loadIncidents } from './data.js'; // Import the loader function

let rootCauseData = {};
let combinedData = [];
let analysisResults = {};
let dataLoaded = false;
let dataLoadPromise = null;

// --- Chart Rendering Variables (using Chart.js) ---
// Sci-fi theme colors
const sciFiColors = [
    'rgba(0, 255, 255, 0.7)', // Cyan
    'rgba(255, 0, 255, 0.7)', // Magenta
    'rgba(50, 255, 50, 0.7)',  // Lime Green
    'rgba(255, 100, 0, 0.7)', // Orange
    'rgba(100, 100, 255, 0.7)',// Purple-Blue
    'rgba(255, 255, 0, 0.7)',  // Yellow
    'rgba(255, 0, 0, 0.7)',    // Red
    'rgba(0, 150, 255, 0.7)', // Sky Blue
];
const sciFiGridColor = 'rgba(0, 255, 255, 0.2)';
const sciFiTickColor = 'rgba(0, 255, 255, 0.7)';
const sciFiFont = { family: 'Orbitron, sans-serif' }; // Assuming Orbitron font is loaded

async function loadAndProcessData() {
    if (dataLoaded) return analysisResults;
    if (dataLoadPromise) return dataLoadPromise;

    dataLoadPromise = new Promise(async (resolve, reject) => {
        try {
            // Load incidents data first
            const rawIncidents = await loadIncidents();

            // Load root cause data using fetch
            const response = await fetch('./rootcause_data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            rootCauseData = await response.json();

            console.log('Incident data loaded:', rawIncidents.length, 'records');
            console.log('Root cause data loaded:', Object.keys(rootCauseData).length, 'records');

            // --- Analysis Functions (keep internal or move to separate utils file if large) ---
            function parseDate(dateString) {
                if (!dateString || dateString.length !== 8) return null;
                const year = parseInt(dateString.substring(0, 4), 10);
                const month = parseInt(dateString.substring(4, 6), 10) - 1; // Month is 0-indexed
                const day = parseInt(dateString.substring(6, 8), 10);
                if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
                if (year < 1970 || year > 2050 || month < 0 || month > 11 || day < 1 || day > 31) {
                    // console.warn(`Invalid date components in string: ${dateString}`);
                }
                try {
                    const date = new Date(Date.UTC(year, month, day));
                    if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                        return date;
                    }
                    return null;
                } catch (e) {
                    return null;
                }
            }

            function calculateTotalLossUSD(incidentData) {
                 return incidentData.reduce((sum, incident) => {
                    if (incident.lossType && incident.lossType.toUpperCase() === 'USD' && typeof incident.Lost === 'number' && !isNaN(incident.Lost)) {
                        return sum + incident.Lost;
                    }
                    return sum;
                }, 0);
            }

            function aggregateLossByYearUSD(incidentData) {
                const yearlyLosses = {};
                for (const incident of incidentData) {
                    if (incident.dateObj && incident.lossType && incident.lossType.toUpperCase() === 'USD' && typeof incident.Lost === 'number' && !isNaN(incident.Lost)) {
                         const year = incident.dateObj.getUTCFullYear().toString();
                         yearlyLosses[year] = (yearlyLosses[year] || 0) + incident.Lost;
                    }
                }
                return Object.entries(yearlyLosses)
                             .sort(([yearA], [yearB]) => parseInt(yearA, 10) - parseInt(yearB, 10))
                             .reduce((obj, [year, loss]) => { obj[year] = loss; return obj; }, {});
            }

            function aggregateLossByTypeUSD(incidentData) {
                const typeLosses = {};
                for (const incident of incidentData) {
                    if (incident.type && incident.lossType && incident.lossType.toUpperCase() === 'USD' && typeof incident.Lost === 'number' && !isNaN(incident.Lost)) {
                        typeLosses[incident.type] = (typeLosses[incident.type] || 0) + incident.Lost;
                    }
                }
                return Object.entries(typeLosses)
                             .sort(([, lossA], [, lossB]) => lossB - lossA)
                             .reduce((obj, [type, loss]) => { obj[type] = loss; return obj; }, {});
            }

            function countIncidentsByType(incidentData) {
                 const counts = {};
                for (const incident of incidentData) {
                    if (incident.type) {
                        counts[incident.type] = (counts[incident.type] || 0) + 1;
                    }
                }
                return Object.entries(counts)
                             .sort(([, countA], [, countB]) => countB - countA)
                             .reduce((obj, [type, count]) => { obj[type] = count; return obj; }, {});
            }

             function countIncidentsByYear(incidentData) {
                const counts = {};
                for (const incident of incidentData) {
                    if (incident.dateObj) {
                         const year = incident.dateObj.getUTCFullYear().toString();
                         counts[year] = (counts[year] || 0) + 1;
                    }
                }
                return Object.entries(counts)
                             .sort(([yearA], [yearB]) => parseInt(yearB, 10) - parseInt(yearA, 10))
                             .reduce((obj, [year, count]) => { obj[year] = count; return obj; }, {});
            }

             function getRootCauseTypeFrequency(incidentData, rootCauseLookup) {
                 const counts = {};
                for (const incident of incidentData) {
                    const rootCauseInfo = rootCauseLookup[incident.name];
                    if (rootCauseInfo && rootCauseInfo.type) {
                        const mainType = rootCauseInfo.type.split(',')[0].trim();
                        if (mainType) {
                            counts[mainType] = (counts[mainType] || 0) + 1;
                        }
                    } else if (incident.type) {
                        counts[incident.type] = (counts[incident.type] || 0) + 1;
                    }
                }
                return Object.entries(counts)
                             .sort(([, countA], [, countB]) => countB - countA)
                             .reduce((obj, [type, count]) => { obj[type] = count; return obj; }, {});
            }

            // --- Data Preparation ---
            combinedData = rawIncidents.map(incident => {
                const rootCauseInfo = rootCauseData[incident.name] || {};
                return {
                    ...incident,
                    dateObj: parseDate(incident.date),
                    rootCauseType: rootCauseInfo.type || incident.type,
                    rootCauseDetails: rootCauseInfo.rootCause || 'N/A',
                };
            }).filter(item => item.dateObj); // Filter out incidents with unparseable dates

            console.log('Combined data created:', combinedData.length, 'records');

            // Aggregate data for charts
            const totalLoss = calculateTotalLossUSD(combinedData);
            const lossByYear = aggregateLossByYearUSD(combinedData);
            const lossByType = aggregateLossByTypeUSD(combinedData);
            const countByType = countIncidentsByType(combinedData);
            const countByYear = countIncidentsByYear(combinedData);
            const rootCauseFrequency = getRootCauseTypeFrequency(combinedData, rootCauseData);

            analysisResults = {
                totalLoss,
                lossByYear,
                lossByType,
                countByType,
                countByYear,
                rootCauseFrequency
            };

            dataLoaded = true;
            dataLoadPromise = null; // Clear the promise
            resolve(analysisResults);

        } catch (error) {
            console.error("Error loading or processing data:", error);
            dataLoadPromise = null; // Clear the promise on error
            reject(error);
        }
    });
    return dataLoadPromise;
}

// Export the function to load data and the results once loaded
export { loadAndProcessData, analysisResults, combinedData, rootCauseData };

// --- HTML Generation ---

// Function to generate HTML for analytics
function generateAnalyticsHTML(analysisResults) {
    // This function is no longer used - analytics are now displayed in compact form
    // in the renderCompactAnalytics function
    return ''; // Return empty string instead of generating HTML
}

// --- DOM Manipulation ---

// Function to run analysis and update the DOM
function displayAnalytics() {
    // This function is no longer used - analytics are now displayed in compact form
    // in the renderCompactAnalytics function
    console.log('displayAnalytics is deprecated, using compact analytics instead');
    return;
}

// Run the analysis when the DOM is fully loaded
// Check if running in a browser environment before adding DOMContentLoaded listener
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async function() {
    try {
      // Make sure data is loaded before displaying analytics
      await loadAndProcessData();
      // displayAnalytics(); // Commented out as we now use compact analytics in the charts section
    } catch(err) {
      console.error("Error loading data for analytics:", err);
    }
  });
} else {
  // If not in a browser (e.g., Node.js environment for testing/bundling),
  // perhaps just log the analysis or export functions.
  console.log("Not running in a browser environment. Skipping DOM manipulation.");
}

// Export functions if needed for testing or use in other modules (Node.js context)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    incidents: combinedData, // Export combined data
    rootCauseData,
    analysisResults, // Use the already defined analysisResults object
    // Export individual functions if needed elsewhere, though maybe not necessary
    // if script.js only consumes analysisResults
    // calculateTotalLossUSD,
    // aggregateLossByYearUSD,
    // aggregateLossByTypeUSD,
    // countIncidentsByType,
    // countIncidentsByYear,
    // getRootCauseTypeFrequency
  };
}

// -------------------------------
// CHARTING AND VISUALIZATION CODE
// -------------------------------

// Function to render all charts
export function renderCharts(incidentData) {
    if (!analysisResults || !document.getElementById('analytics-charts')) {
        console.warn('Cannot render charts, missing data or container');
        return;
    }

    // Check if Chart is defined - if not, load it
    if (typeof Chart === 'undefined') {
        console.log('Chart.js not found, loading from CDN...');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = function() {
            console.log('Chart.js loaded successfully');
            // Now we can safely render charts
            renderChartsWhenReady(incidentData);
        };
        script.onerror = function() {
            console.error('Failed to load Chart.js');
            const chartContainer = document.getElementById('analytics-charts');
            chartContainer.innerHTML = '<p>Error loading Chart.js library. Charts unavailable.</p>';
        };
        document.head.appendChild(script);
        return;
    }

    // If Chart is already defined, render charts directly
    renderChartsWhenReady(incidentData);
}

// Function to actually render the charts once Chart.js is available
function renderChartsWhenReady(incidentData) {
    // Clear any existing charts
    const chartContainer = document.getElementById('analytics-charts');
    chartContainer.innerHTML = '';
    
    // Add CSS for charts
    addAnalyticsStyles();
    
    // Create title for the analytics section
    const analyticsTitle = document.createElement('h2');
    analyticsTitle.textContent = 'DeFi Incident Analytics';
    analyticsTitle.className = 'analytics-title';
    chartContainer.appendChild(analyticsTitle);

    try {
        // Create a grid layout for charts
        const chartGrid = document.createElement('div');
        chartGrid.className = 'chart-grid';
        chartContainer.appendChild(chartGrid);
        
        // Render loss over time chart if data exists
        if (analysisResults.lossByYear && Object.keys(analysisResults.lossByYear).length > 0) {
            const lossTimeChartBox = createChartBox('Loss Over Time (USD)', 'lossOverTimeChart');
            chartGrid.appendChild(lossTimeChartBox);
            renderLossOverTimeChart(analysisResults.lossByYear, 'lossOverTimeChart');
        }

        // Render loss by type chart if data exists
        if (analysisResults.lossByType && Object.keys(analysisResults.lossByType).length > 0) {
            const lossByTypeBox = createChartBox('Loss Distribution by Type (USD)', 'lossByTypeChart');
            chartGrid.appendChild(lossByTypeBox);
            renderLossByTypeChart(analysisResults.lossByType, 'lossByTypeChart');
        }
        
        // Render incidents by year chart if data exists
        if (analysisResults.countByYear && Object.keys(analysisResults.countByYear).length > 0) {
            const incidentsByYearBox = createChartBox('Incidents by Year', 'incidentsByYearChart');
            chartGrid.appendChild(incidentsByYearBox);
            renderIncidentsByYearChart(analysisResults.countByYear, 'incidentsByYearChart');
        }

        // Render root cause frequency chart if data exists
        if (analysisResults.rootCauseFrequency && Object.keys(analysisResults.rootCauseFrequency).length > 0) {
            const rootCauseBox = createChartBox('Incident Frequency by Root Cause/Type', 'rootCauseFrequencyChart');
            chartGrid.appendChild(rootCauseBox);
            renderRootCauseFrequencyChart(analysisResults.rootCauseFrequency, 'rootCauseFrequencyChart');
        }
        
        // Render top projects by loss chart
        renderTopProjectsByLossChart(incidentData, 'topProjectsChart', chartGrid);
        
        // Render monthly distribution chart
        renderMonthlyDistributionChart(incidentData, 'monthlyDistributionChart', chartGrid);
        
        // Add compact analytics section below charts
        renderCompactAnalytics(chartContainer);
        
    } catch (error) {
        console.error('Error rendering charts:', error);
        chartContainer.innerHTML = '<p>Error rendering charts. See console for details.</p>';
    }
}

// New function to render compact analytics section
function renderCompactAnalytics(container) {
    if (!analysisResults) return;
    
    // Create compact analytics container
    const compactContainer = document.createElement('div');
    compactContainer.className = 'compact-analytics-container';
    
    // Create title
    const title = document.createElement('h3');
    title.className = 'compact-analytics-title';
    title.textContent = 'Summary Statistics';
    compactContainer.appendChild(title);
    
    // Create analytics grid
    const grid = document.createElement('div');
    grid.className = 'compact-analytics-grid';
    
    // Total Loss
    const totalLossSection = document.createElement('div');
    totalLossSection.className = 'compact-analytics-section';
    totalLossSection.innerHTML = `
        <h4>Total Estimated Loss</h4>
        <div class="analytics-value">${formatCurrency(analysisResults.totalLoss)}</div>
    `;
    grid.appendChild(totalLossSection);
    
    // Incidents by Year
    const yearSection = document.createElement('div');
    yearSection.className = 'compact-analytics-section';
    let yearContent = '<h4>Incidents by Year</h4><div class="analytics-tags">';
    
    if (analysisResults.countByYear) {
        const sortedYears = Object.keys(analysisResults.countByYear).sort((a, b) => b - a);
        for (const year of sortedYears) {
            yearContent += `<span class="analytics-tag">${year}: ${analysisResults.countByYear[year]}</span>`;
        }
    }
    
    yearContent += '</div>';
    yearSection.innerHTML = yearContent;
    grid.appendChild(yearSection);
    
    // Incidents by Type
    const typeSection = document.createElement('div');
    typeSection.className = 'compact-analytics-section wide-section';
    let typeContent = '<h4>Incidents by Type</h4><div class="analytics-tags">';
    
    if (analysisResults.countByType) {
        const sortedTypes = Object.entries(analysisResults.countByType)
            .sort(([, countA], [, countB]) => countB - countA);
        
        for (const [type, count] of sortedTypes) {
            typeContent += `<span class="analytics-tag">${type}: ${count}</span>`;
        }
    }
    
    typeContent += '</div>';
    typeSection.innerHTML = typeContent;
    grid.appendChild(typeSection);
    
    // Add grid to container
    compactContainer.appendChild(grid);
    
    // Add container to main container
    container.appendChild(compactContainer);
}

// Helper function to format currency
function formatCurrency(value) {
    if (typeof value !== 'number') return 'Unknown';
    
    return '$' + value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

// Helper function to create a chart container
function createChartBox(title, canvasId) {
    const container = document.createElement('div');
    container.className = 'chart-box';
    
    const header = document.createElement('h4');
    header.textContent = title;
    container.appendChild(header);
    
    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    container.appendChild(canvas);
    
    return container;
}

// Function to render the loss over time chart
function renderLossOverTimeChart(lossByYear, canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Sort years chronologically
    const sortedYears = Object.keys(lossByYear).sort((a, b) => a - b);
    const sortedLosses = sortedYears.map(year => lossByYear[year]);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedYears,
            datasets: [{
                label: 'Total Loss (USD)',
                data: sortedLosses,
                borderColor: sciFiColors[0],
                backgroundColor: 'rgba(0, 255, 255, 0.1)',
                tension: 0.2,
                fill: true,
                pointBackgroundColor: sciFiColors[0],
                pointRadius: 4,
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: sciFiTickColor,
                        font: sciFiFont,
                        callback: function(value) { 
                            if (value >= 1e9) return '$' + (value / 1e9).toFixed(1) + 'B';
                            if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
                            if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
                            return '$' + value;
                        }
                    },
                    grid: { color: sciFiGridColor }
                },
                x: {
                    ticks: { color: sciFiTickColor, font: sciFiFont },
                    grid: { color: sciFiGridColor }
                }
            }
        }
    });
}

// Function to render the loss by type chart (pie)
function renderLossByTypeChart(lossByType, canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Limit to top types for clarity if too many
    const topN = 6;
    const topTypesData = Object.entries(lossByType).slice(0, topN);
    const otherLoss = Object.entries(lossByType).slice(topN).reduce((sum, [, loss]) => sum + loss, 0);
    
    const chartData = [...topTypesData];
    if (otherLoss > 0) {
         chartData.push(['Other', otherLoss]);
    }

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartData.map(([type]) => type),
            datasets: [{
                label: 'Loss (USD)',
                data: chartData.map(([, loss]) => loss),
                backgroundColor: sciFiColors.slice(0, chartData.length),
                borderColor: 'rgba(0, 10, 20, 0.8)',
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { 
                        color: sciFiTickColor, 
                        font: sciFiFont, 
                        boxWidth: 15,
                        padding: 15 
                    },
                    maxHeight: 400
                },
                title: { display: false }
            },
            layout: {
                padding: {
                    left: 10,
                    right: 10,
                    top: 10,
                    bottom: 10
                }
            },
            // This cutout percentage controls the size of the hole in the middle
            cutout: '65%'
        }
    });
}

// Function to render root cause frequency chart
function renderRootCauseFrequencyChart(rootCauseFrequency, canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Limit to top causes for clarity
    const topN = 8;
    const topCausesData = Object.entries(rootCauseFrequency).slice(0, topN);
    
    // Sort by frequency
    topCausesData.sort((a, b) => b[1] - a[1]);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topCausesData.map(([type]) => type),
            datasets: [{
                label: 'Incident Count',
                data: topCausesData.map(([, count]) => count),
                backgroundColor: sciFiColors[1],
                borderColor: 'rgba(0, 10, 20, 0.8)',
                borderWidth: 1,
                borderRadius: 4,
                barThickness: 'flex'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: sciFiTickColor, font: sciFiFont },
                    grid: { color: sciFiGridColor }
                },
                y: {
                    ticks: { 
                        color: sciFiTickColor, 
                        font: sciFiFont,
                        callback: function(value) {
                            // Truncate long labels
                            const label = this.getLabelForValue(value);
                            if (label.length > 20) {
                                return label.substr(0, 18) + '...';
                            }
                            return label;
                        }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// Function to render incidents by year chart
function renderIncidentsByYearChart(countByYear, canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Sort years chronologically
    const sortedYears = Object.keys(countByYear).sort((a, b) => a - b);
    const incidentCounts = sortedYears.map(year => countByYear[year]);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedYears,
            datasets: [{
                label: 'Number of Incidents',
                data: incidentCounts,
                backgroundColor: sciFiColors[2],
                borderColor: 'rgba(0, 10, 20, 0.8)',
                borderWidth: 1,
                borderRadius: 4,
                barThickness: 'flex'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        color: sciFiTickColor, 
                        font: sciFiFont,
                        precision: 0
                    },
                    grid: { color: sciFiGridColor }
                },
                x: {
                    ticks: { color: sciFiTickColor, font: sciFiFont },
                    grid: { color: sciFiGridColor }
                }
            }
        }
    });
}

// Function to render top projects by loss amount
function renderTopProjectsByLossChart(incidentData, canvasId, chartGrid) {
    const chartBox = createChartBox('Top 10 Projects by Loss Amount (USD)', canvasId);
    chartGrid.appendChild(chartBox);
    
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Filter projects with USD loss and sort by loss amount
    const projectsWithLoss = incidentData
        .filter(incident => 
            incident.lossType && 
            incident.lossType.toUpperCase() === 'USD' && 
            typeof incident.Lost === 'number' && 
            !isNaN(incident.Lost))
        .sort((a, b) => b.Lost - a.Lost)
        .slice(0, 10);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: projectsWithLoss.map(p => p.name),
            datasets: [{
                label: 'Loss Amount (USD)',
                data: projectsWithLoss.map(p => p.Lost),
                backgroundColor: sciFiColors[3],
                borderColor: 'rgba(0, 10, 20, 0.8)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { 
                        color: sciFiTickColor, 
                        font: sciFiFont,
                        callback: function(value) { 
                            if (value >= 1e9) return '$' + (value / 1e9).toFixed(1) + 'B';
                            if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
                            if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
                            return '$' + value;
                        }
                    },
                    grid: { color: sciFiGridColor }
                },
                y: {
                    ticks: { 
                        color: sciFiTickColor, 
                        font: sciFiFont,
                        callback: function(value) {
                            // Truncate long project names
                            const label = this.getLabelForValue(value);
                            if (label.length > 15) {
                                return label.substr(0, 13) + '...';
                            }
                            return label;
                        }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// Function to render monthly distribution of incidents
function renderMonthlyDistributionChart(incidentData, canvasId, chartGrid) {
    const chartBox = createChartBox('Monthly Distribution of Incidents', canvasId);
    chartGrid.appendChild(chartBox);
    
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Initialize monthly counts
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthCounts = Array(12).fill(0);
    
    // Count incidents by month
    incidentData.forEach(incident => {
        if (incident.dateObj) {
            const month = incident.dateObj.getUTCMonth();
            monthCounts[month]++;
        }
    });
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthNames,
            datasets: [{
                label: 'Number of Incidents',
                data: monthCounts,
                borderColor: sciFiColors[4],
                backgroundColor: 'rgba(100, 100, 255, 0.2)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: sciFiColors[4],
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        color: sciFiTickColor, 
                        font: sciFiFont,
                        precision: 0
                    },
                    grid: { color: sciFiGridColor }
                },
                x: {
                    ticks: { color: sciFiTickColor, font: sciFiFont },
                    grid: { color: sciFiGridColor }
                }
            }
        }
    });
}

// Function to make the analytics section collapsible
export function makeAnalyticsCollapsible() {
    // Create a toggle button container
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'toggle-container';
    
    // Create the toggle button
    const toggleButton = document.createElement('button');
    toggleButton.className = 'toggle-analytics-button';
    toggleButton.innerHTML = 'Show Analytics <span>▼</span>';
    toggleButton.setAttribute('aria-expanded', 'false');
    toggleContainer.appendChild(toggleButton);
    
    // Find the analytics container
    const analyticsContainer = document.getElementById('analytics-charts');
    
    // If we can't find the element, return early
    if (!analyticsContainer) {
        console.warn('Could not find analytics container');
        return;
    }
    
    // Initially hide the analytics section
    analyticsContainer.style.display = 'none';
    
    // Insert toggle button before the analytics section
    if (analyticsContainer.parentNode) {
        analyticsContainer.parentNode.insertBefore(toggleContainer, analyticsContainer);
    }
    
    // Function to toggle the analytics visibility
    toggleButton.addEventListener('click', function() {
        const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
        
        if (isExpanded) {
            // Collapse the analytics
            analyticsContainer.style.display = 'none';
            toggleButton.innerHTML = 'Show Analytics <span>▼</span>';
            toggleButton.setAttribute('aria-expanded', 'false');
        } else {
            // Expand the analytics
            analyticsContainer.style.display = 'block';
            toggleButton.innerHTML = 'Hide Analytics <span>▲</span>';
            toggleButton.setAttribute('aria-expanded', 'true');
            // Scroll to analytics
            analyticsContainer.scrollIntoView({ behavior: 'smooth' });
        }
    });
}

// Function to add CSS styles for the analytics section
function addAnalyticsStyles() {
    // Check if styles are already added
    if (document.getElementById('analytics-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'analytics-styles';
    style.textContent = `
        .analytics-charts-container {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid rgba(0, 255, 255, 0.3);
        }
        
        .analytics-title {
            text-align: center;
            color: #00ffff;
            font-family: 'Orbitron', sans-serif;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-bottom: 30px;
            font-size: 28px;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.7);
        }
        
        .chart-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 25px;
            margin-bottom: 40px;
        }
        
        @media (max-width: 1200px) {
            .chart-grid {
                grid-template-columns: 1fr;
            }
        }
        
        .chart-box {
            background: rgba(0, 0, 0, 0.7);
            border: 1px solid #00ffff;
            box-shadow: 0 0 5px #00ffff;
            padding: 15px;
            border-radius: 4px;
            height: 350px;
            position: relative;
            overflow: hidden;
        }
        
        .chart-box::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, 
                transparent 0%, 
                rgba(0, 255, 255, 0.5) 50%, 
                transparent 100%);
            animation: scanline 5s linear infinite;
        }
        
        @keyframes scanline {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        .chart-box h4 {
            color: #00ffff;
            text-align: center;
            margin-top: 0;
            margin-bottom: 15px;
            font-family: 'Orbitron', sans-serif;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 14px;
        }
        
        /* Compact Analytics Styles */
        .compact-analytics-container {
            background: rgba(0, 0, 0, 0.7);
            border: 1px solid #ff00ff;
            box-shadow: 0 0 10px #ff00ff, inset 0 0 5px #ff00ff;
            padding: 20px;
            margin-top: 30px;
            margin-bottom: 40px;
            position: relative;
            overflow: hidden;
        }
        
        .compact-analytics-container::before {
            content: "";
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(45deg, transparent 40%, rgba(255, 0, 255, 0.1) 50%, transparent 60%);
            transform: rotate(45deg);
            animation: scanline 8s linear infinite;
            pointer-events: none;
        }
        
        .compact-analytics-title {
            color: #ff00ff;
            font-family: 'Orbitron', sans-serif;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 0;
            margin-bottom: 20px;
            font-size: 18px;
            text-align: center;
            text-shadow: 0 0 5px rgba(255, 0, 255, 0.7);
        }
        
        .compact-analytics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        
        .wide-section {
            grid-column: 1 / span 2;
        }
        
        .compact-analytics-section {
            padding: 15px;
            background: rgba(17, 17, 17, 0.7);
            border: 1px solid rgba(0, 255, 255, 0.3);
        }
        
        .compact-analytics-section h4 {
            color: #00ffff;
            font-family: 'Orbitron', sans-serif;
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 14px;
            letter-spacing: 1px;
        }
        
        .analytics-value {
            font-size: 24px;
            color: #ff00ff;
            font-weight: bold;
            text-align: center;
            font-family: 'Orbitron', sans-serif;
            text-shadow: 0 0 5px rgba(255, 0, 255, 0.7);
        }
        
        .analytics-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        
        .analytics-tag {
            background: rgba(0, 0, 0, 0.6);
            color: #00ffff;
            padding: 5px 10px;
            border: 1px solid rgba(0, 255, 255, 0.5);
            border-radius: 4px;
            font-size: 12px;
            font-family: 'Rajdhani', sans-serif;
            white-space: nowrap;
        }
        
        @media (max-width: 768px) {
            .compact-analytics-grid {
                grid-template-columns: 1fr;
            }
            
            .wide-section {
                grid-column: 1;
            }
        }
    `;
    document.head.appendChild(style);
} 