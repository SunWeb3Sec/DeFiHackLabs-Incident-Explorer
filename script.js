// Import analysis functions and data loader
import { 
    loadAndProcessData, 
    analysisResults, 
    combinedData as incidents, 
    rootCauseData,
    renderCharts,
    makeAnalyticsCollapsible
} from './analysis.js';

document.addEventListener('DOMContentLoaded', async function() {
    // Global variables
    let currentPage = 1;
    const itemsPerPage = 50;
    let filteredIncidents = [];
    let sortedProjects = [];
    let currentProjectIndex = -1;
    
    // Get the table container element
    const tableContainerElement = document.getElementById('table-container');
    if (!tableContainerElement) {
        console.error('Table container element (#table-container) not found!');
        document.body.innerHTML = '<div class="error-message">Table container not found. Please check your HTML.</div>';
        return;
    }
    
    // Clear container to prevent duplication issues
    tableContainerElement.innerHTML = '';
    
    try {
        // 1. Load data first
        await loadAndProcessData();
        console.log("Data loaded, proceeding with UI setup.");
        
        // 2. Create UI components in the correct order
        createUI();
        
    } catch (error) {
        console.error('Failed to initialize incident explorer:', error);
        tableContainerElement.innerHTML = '<p class="error-message">Failed to load incident data: ' + error.message + '</p>';
    }
    
    // Main function to create the UI components
    function createUI() {
        // Get the main data arrays from the imported module
        const totalIncidentCount = incidents.length; // Get the total count

        // Create statistics container
        const statsContainer = document.createElement('div');
        statsContainer.className = 'stats-container';

        // Total incidents count
        const totalIncidentsBox = document.createElement('div');
        totalIncidentsBox.className = 'stat-box';
        totalIncidentsBox.id = 'total-incidents-stat'; 
        totalIncidentsBox.innerHTML = `
            <h3>Total Incidents</h3>
            <p>${totalIncidentCount}</p>
        `;
        statsContainer.appendChild(totalIncidentsBox);
        
        // Total loss amount
        const totalLossBox = document.createElement('div');
        totalLossBox.className = 'stat-box';
        totalLossBox.id = 'total-loss-stat'; 
        totalLossBox.innerHTML = `
            <h3>Total Loss (USD)</h3>
            <p>${formatCurrency(analysisResults.totalLoss)}</p>
        `;
        statsContainer.appendChild(totalLossBox);
        
        tableContainerElement.appendChild(statsContainer);
        
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
        
        // Add CSS styles
        addStyles();
        
        // Setup modal functionality
        setupModalListeners();
    }
    
    // Helper function to format currency
    function formatCurrency(value) {
        if (typeof value !== 'number') return 'Unknown';
        
        return '$' + value.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }
    
    // Function to set up the modal listeners
    function setupModalListeners() {
        const modal = document.getElementById('rootCauseModal');
        if (!modal) {
            console.warn('Root cause modal not found in the document');
            return;
        }
        
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        // Navigation buttons functionality
        const prevButton = modal.querySelector('.prev-button');
        if (prevButton) {
            prevButton.addEventListener('click', () => {
                if (currentProjectIndex > 0) {
                    showRootCauseModal(sortedProjects[currentProjectIndex - 1]);
                }
            });
        }
        
        const nextButton = modal.querySelector('.next-button');
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                if (currentProjectIndex < sortedProjects.length - 1) {
                    showRootCauseModal(sortedProjects[currentProjectIndex + 1]);
                }
            });
        }
        
        // Close the modal when the user clicks anywhere outside of the modal content
        window.addEventListener('click', (event) => {
            if (modal && event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // Function to set up the analytics section
    function setupAnalytics() {
        // Create analytics container
        const chartsContainer = document.createElement('div');
        chartsContainer.id = 'analytics-charts';
        chartsContainer.className = 'analytics-charts-container';
        tableContainerElement.appendChild(chartsContainer);
        
        // Render charts using function from analytics.js
        renderCharts(incidents);
        
        // Make analytics section collapsible
        makeAnalyticsCollapsible();
    }
    
    // Function to set up filters after data is loaded
    function setupFilters() {
        // Create filters container
        const filtersContainer = document.createElement('div');
        filtersContainer.className = 'filters-container';
    
        // Create year filter
        const yearFilter = document.createElement('div');
        yearFilter.className = 'filter-group';
        yearFilter.innerHTML = `
            <label>Year</label>
            <select id="year-filter">
                <option value="">All Years</option>
                ${analysisResults.countByYear ? Object.keys(analysisResults.countByYear)
                    .sort((a, b) => b - a) // Sort years in descending order
                    .map(year => `<option value="${year}">${year}</option>`)
                    .join('') : ''}
            </select>
        `;
    
        // Create attack type filter
        const typeFilter = document.createElement('div');
        typeFilter.className = 'filter-group';
        typeFilter.innerHTML = `
            <label>Attack Type</label>
            <select id="type-filter">
                <option value="">All Types</option>
                ${analysisResults.countByType ? Object.keys(analysisResults.countByType)
                    .map(type => `<option value="${type}">${type}</option>`)
                    .join('') : ''}
            </select>
        `;
    
        // Create sort filter
        const sortFilter = document.createElement('div');
        sortFilter.className = 'filter-group';
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
    
        // Create search box
        const searchBox = document.createElement('input');
        searchBox.id = 'search-box';
        searchBox.type = 'text';
        searchBox.placeholder = 'Search by project name...';
        searchBox.className = 'search-box';
    
        // Create first row for filters
        const filtersRow = document.createElement('div');
        filtersRow.className = 'filters-row';
        
        // Add all filters to container
        filtersContainer.appendChild(yearFilter);
        filtersContainer.appendChild(typeFilter);
        filtersContainer.appendChild(sortFilter);
        filtersRow.appendChild(filtersContainer);
        tableContainerElement.appendChild(filtersRow);
        
        // Create second row for search
        const searchRow = document.createElement('div');
        searchRow.className = 'search-row';
        searchRow.appendChild(searchBox);
        tableContainerElement.appendChild(searchRow);
    
        // Create table container
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-container';
    
        // Create table
        const table = document.createElement('table');
        table.className = 'incidents-table';
        tableWrapper.appendChild(table);
        tableContainerElement.appendChild(tableWrapper);
    
        // Create pagination container
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';
        tableContainerElement.appendChild(paginationContainer);
        
        // Add event listeners to filters after they're created
        document.getElementById('year-filter')?.addEventListener('change', () => {
            currentPage = 1;
            updateTable();
        });
        
        document.getElementById('type-filter')?.addEventListener('change', () => {
            currentPage = 1;
            updateTable();
        });
        
        document.getElementById('sort-filter')?.addEventListener('change', () => {
            updateTable();
        });
        
        document.getElementById('search-box')?.addEventListener('input', () => {
            currentPage = 1;
            updateTable();
        });
    }

    // Main function to update the table with filtered data and pagination
    function updateTable() {
        // Get the table element
        const table = document.querySelector('.incidents-table');
        if (!table) {
            console.error('Table element not found');
            return;
        }
        
        // Clear the table
        table.innerHTML = '';

        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Date', 'Project', 'Attack Type', 'Loss Amount', 'Root Cause', 'POC'].forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create table body
        const tbody = document.createElement('tbody');

        // Get filter values safely
        const yearFilter = document.getElementById('year-filter');
        const typeFilter = document.getElementById('type-filter');
        const sortFilter = document.getElementById('sort-filter');
        const searchBox = document.getElementById('search-box');
        
        const selectedYear = yearFilter?.value || '';
        const selectedType = typeFilter?.value || '';
        const sortBy = sortFilter?.value || 'date';
        const searchQuery = searchBox?.value.toLowerCase() || '';

        // Filter incidents based on selected criteria
        filteredIncidents = incidents.filter(incident => {
            if (!incident.dateObj) return false;
            
            const incidentYear = incident.dateObj.getUTCFullYear().toString();
            const matchesYear = !selectedYear || incidentYear === selectedYear;
            const matchesType = !selectedType || incident.type === selectedType;
            const matchesSearch = !searchQuery || 
                                incident.name.toLowerCase().includes(searchQuery) || 
                                (incident.type && incident.type.toLowerCase().includes(searchQuery));
            return matchesYear && matchesType && matchesSearch;
        });

        // Sort incidents based on selected criteria
        switch(sortBy) {
            case 'loss_high':
                filteredIncidents.sort((a, b) => (b.Lost || 0) - (a.Lost || 0));
                break;
            case 'loss_low':
                filteredIncidents.sort((a, b) => (a.Lost || 0) - (b.Lost || 0));
                break;
            case 'root_cause_first':
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

        // Calculate pagination boundaries
        const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage);
        if (currentPage > totalPages && totalPages > 0) {
            currentPage = 1;
        }
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, filteredIncidents.length);
        const currentIncidents = filteredIncidents.slice(startIndex, endIndex);

        // Add data rows
        currentIncidents.forEach(incident => {
            const row = document.createElement('tr');
            
            // Date column
            const dateCell = document.createElement('td');
            dateCell.textContent = formatDate(incident.date);
            row.appendChild(dateCell);
            
            // Project column
            const projectCell = document.createElement('td');
            projectCell.textContent = incident.name;
            row.appendChild(projectCell);
            
            // Attack type column
            const typeCell = document.createElement('td');
            typeCell.textContent = incident.type || '-';
            row.appendChild(typeCell);
            
            // Loss amount column
            const lossCell = document.createElement('td');
            lossCell.textContent = formatLoss(incident.Lost, incident.lossType);
            row.appendChild(lossCell);
            
            // Root Cause column
            const rootCauseCell = document.createElement('td');
            // Check if root cause data exists for this project
            if (rootCauseData[incident.name]) {
                const rootCauseButton = document.createElement('button');
                rootCauseButton.textContent = 'View Analysis';
                rootCauseButton.className = 'view-root-cause';
                rootCauseButton.addEventListener('click', () => {
                    showRootCauseModal(incident.name);
                });
                rootCauseCell.appendChild(rootCauseButton);
            } else {
                rootCauseCell.textContent = '-';
            }
            row.appendChild(rootCauseCell);
            
            // POC link column
            const pocCell = document.createElement('td');
            if (incident.Contract) {
                const pocLink = document.createElement('a');
                pocLink.href = `https://github.com/SunWeb3Sec/DeFiHackLabs/tree/main/${incident.Contract}`;
                pocLink.textContent = 'View POC';
                pocLink.className = 'view-poc';
                pocLink.target = '_blank';
                pocCell.appendChild(pocLink);
            } else {
                pocCell.textContent = '-';
            }
            row.appendChild(pocCell);
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        
        // Update pagination controls
        updatePagination(totalPages);
        
        // Update statistics
        updateStats(filteredIncidents.length); // Pass the count of filtered incidents
    }

    // Function to update pagination controls
    function updatePagination(totalPages) {
        // Clear pagination container
        const paginationContainer = document.querySelector('.pagination-container');
        if (!paginationContainer) {
            console.error('Pagination container not found');
            return;
        }
        
        paginationContainer.innerHTML = '';
        
        if (totalPages <= 1) {
            return;
        }
        
        // Create page info display
        const pageInfo = document.createElement('div');
        pageInfo.className = 'page-info';
        pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${filteredIncidents.length} incidents)`;
        paginationContainer.appendChild(pageInfo);
        
        // Create pagination buttons
        const pageButtons = document.createElement('div');
        pageButtons.className = 'page-buttons';
        
        // Previous page button
        const prevButton = document.createElement('button');
        prevButton.textContent = '< Previous';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                updateTable();
            }
        });
        pageButtons.appendChild(prevButton);
        
        // Next page button
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next >';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                updateTable();
            }
        });
        pageButtons.appendChild(nextButton);
        
        paginationContainer.appendChild(pageButtons);
    }

    // Function to update statistics
    function updateStats(filteredCount) { // Receive the count as an argument
        // Update total incidents count (for the filtered view)
        const totalIncidentsElement = document.getElementById('total-incidents-stat');
        if (totalIncidentsElement) {
             totalIncidentsElement.querySelector('p').textContent = filteredCount;
        } else {
            console.warn('Could not find total incidents stat element');
        }
        
        // Note: Total Loss display usually shows the overall total, not filtered total.
        
        // Update root cause count if sorting by root cause
        const sortBy = document.getElementById('sort-filter')?.value;
        const rootCauseCountElement = document.getElementById('root-cause-count');
        
        if (rootCauseCountElement && sortBy === 'root_cause_first') {
            // Count incidents with root cause data
            const rootCauseCount = filteredIncidents.filter(incident => 
                rootCauseData && rootCauseData[incident.name] 
            ).length;
            
            rootCauseCountElement.textContent = `(${rootCauseCount} root cause reports available)`;
            rootCauseCountElement.style.display = 'inline';
        } else if (rootCauseCountElement) {
            rootCauseCountElement.style.display = 'none';
        }
    }

    // Function to format date for display
    function formatDate(dateStr) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        
        // Convert month to English month name
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = months[parseInt(month, 10) - 1];
        
        return `${monthName} ${parseInt(day, 10)}, ${year}`;
    }
    
    // Function to format loss amount
    function formatLoss(loss, lossType = 'USD') {
        if (!loss && loss !== 0) return 'Unknown';
        
        // Format number
        let formattedLoss;
        if (loss >= 1000000) {
            formattedLoss = (loss / 1000000).toFixed(2) + 'M';
        } else if (loss >= 1000) {
            formattedLoss = (loss / 1000).toFixed(2) + 'K';
        } else {
            formattedLoss = loss.toFixed(2);
        }
        
        // Add currency symbol
        if (lossType === 'USD') {
            return '$' + formattedLoss;
        } else if (lossType) {
            return formattedLoss + ' ' + lossType;
        } else {
            return '$' + formattedLoss;
        }
    }
    
    // Function to format POC link
    function formatPocLink(pocLink) {
        if (!pocLink) return '-';
        
        // Use full GitHub repository path
        const githubPrefix = 'https://github.com/SunWeb3Sec/DeFiHackLabs/tree/main/';
        
        // If link is already a complete URL, use it directly
        if (pocLink.startsWith('http')) {
            return `<a href="${pocLink}" target="_blank">View POC</a>`;
        }
        
        // Otherwise add GitHub prefix
        return `<a href="${githubPrefix}${pocLink}" target="_blank">View POC</a>`;
    }

    // Function to show the root cause modal with the project's data
    function showRootCauseModal(projectName) {
        const projectData = rootCauseData[projectName];
        
        // Update current project index for navigation
        currentProjectIndex = sortedProjects.indexOf(projectName);
        
        if (!projectData) {
            console.error(`No root cause data found for ${projectName}`);
            return;
        }
        
        // Find the incident in the incidents array
        const incident = incidents.find(inc => inc.name === projectName);
        if (!incident) {
            console.error(`No incident data found for ${projectName}`);
            return;
        }
        
        // Get modal elements
        const modal = document.getElementById('rootCauseModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalProjectName = document.getElementById('modalProjectName');
        const modalType = document.getElementById('modalType');
        const modalDate = document.getElementById('modalDate');
        const modalLoss = document.getElementById('modalLoss');
        const modalRootCause = document.getElementById('modalRootCause');
        const modalImagesSection = document.getElementById('modalImagesSection');
        const modalImages = document.getElementById('modalImages');
        
        if (!modal || !modalTitle || !modalProjectName || !modalType || 
            !modalDate || !modalLoss || !modalRootCause || 
            !modalImagesSection || !modalImages) {
            console.error('One or more modal elements not found');
            return;
        }
        
        // Populate modal with project data
        modalTitle.textContent = 'Root Cause Analysis';
        modalProjectName.textContent = projectName;
        modalType.textContent = `Attack Type: ${projectData.type || incident.type || 'Unknown'}`;
        modalDate.textContent = `Date: ${formatDate(incident.date) || 'Unknown'}`;
        modalLoss.textContent = `Loss: ${formatLoss(projectData.Lost || incident.Lost, incident.lossType)}`;
        
        // Root cause analysis
        // Use innerHTML to render markdown content
        modalRootCause.innerHTML = projectData.rootCause ? marked.parse(projectData.rootCause) : 'No root cause analysis available.';
        
        // Images (if any)
        modalImages.innerHTML = '';
        
        if (projectData.images && projectData.images.length > 0) {
            projectData.images.forEach(imageUrl => {
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = `${projectName} incident image`;
                modalImages.appendChild(img);
            });
            modalImagesSection.style.display = 'block';
        } else {
            modalImages.innerHTML = '<p>No images available.</p>';
            modalImagesSection.style.display = 'none';
        }
        
        // Display the modal
        modal.style.display = 'block';
    }

    // Function to prepare sorted projects list for navigation
    function prepareSortedProjects(incidentsData, rootCauseLookup) {
        if (!incidentsData || !rootCauseLookup) {
            console.warn('Missing data for prepareSortedProjects');
            sortedProjects = [];
            return;
        }

        sortedProjects = incidentsData
            .filter(incident => rootCauseLookup[incident.name]) // Only include those with root cause data
            .map(incident => incident.name) // Get project names
            .sort((a, b) => {
                // Find corresponding incidents to sort by date
                const dateA = incidentsData.find(inc => inc.name === a)?.date || '';
                const dateB = incidentsData.find(inc => inc.name === b)?.date || '';
                return dateB.localeCompare(dateA); // Sort by date, newest first
            });
         console.log("Sorted projects for navigation:", sortedProjects.length);
    }

    // Function to make the incidents table collapsible
    function makeTableCollapsible() {
        // Create a toggle button container
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'toggle-container';
        
        // Create the toggle button
        const toggleButton = document.createElement('button');
        toggleButton.className = 'toggle-table-button';
        toggleButton.innerHTML = 'Hide Incidents Table <span>▲</span>';
        toggleButton.setAttribute('aria-expanded', 'true');
        toggleContainer.appendChild(toggleButton);
        
        // Find the table container
        const tableContainer = document.querySelector('.table-container');
        const paginationContainer = document.querySelector('.pagination-container');
        const analyticsChartContainer = document.getElementById('analytics-charts');
        
        // If we can't find the elements, return early
        if (!tableContainer || !analyticsChartContainer) {
            console.warn('Could not find table or analytics container');
            return;
        }
        
        // Insert toggle button before the table
        if (tableContainer.parentNode) {
            tableContainer.parentNode.insertBefore(toggleContainer, tableContainer);
        }
        
        // Function to toggle the table visibility
        toggleButton.addEventListener('click', function() {
            const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
            
            if (isExpanded) {
                // Collapse the table
                tableContainer.style.display = 'none';
                if (paginationContainer) paginationContainer.style.display = 'none';
                toggleButton.innerHTML = 'Show Incidents Table <span>▼</span>';
                toggleButton.setAttribute('aria-expanded', 'false');
                // Scroll to analytics
                analyticsChartContainer.scrollIntoView({ behavior: 'smooth' });
            } else {
                // Expand the table
                tableContainer.style.display = 'block';
                if (paginationContainer) paginationContainer.style.display = 'block';
                toggleButton.innerHTML = 'Hide Incidents Table <span>▲</span>';
                toggleButton.setAttribute('aria-expanded', 'true');
            }
        });
    }
    
    // Function to add CSS styles for the toggle buttons and UI
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .toggle-container {
                display: flex;
                justify-content: center;
                margin: 20px 0;
            }
            
            .toggle-table-button,
            .toggle-analytics-button {
                background: rgba(0, 0, 0, 0.7);
                color: #00ffff;
                border: 1px solid #00ffff;
                padding: 10px 20px;
                font-size: 14px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                box-shadow: 0 0 5px #00ffff;
                border-radius: 4px;
                font-family: 'Orbitron', sans-serif;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .toggle-table-button:hover,
            .toggle-analytics-button:hover {
                background: rgba(0, 0, 0, 0.9);
                box-shadow: 0 0 10px #00ffff, 0 0 20px rgba(0, 255, 255, 0.4);
            }
            
            .toggle-table-button span,
            .toggle-analytics-button span {
                margin-left: 8px;
                font-size: 12px;
            }
        `;
        document.head.appendChild(style);
    }
});