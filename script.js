document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let currentPage = 1;
    const itemsPerPage = 50;
    let filteredIncidents = [];
    let rootCauseData = {};
    let sortedProjects = [];
    let currentProjectIndex = -1;
    
    // Load root cause data
    fetch('rootcause_data.json')
        .then(response => response.json())
        .then(data => {
            rootCauseData = data;
            updateTable();
            prepareSortedProjects();
        })
        .catch(error => console.error('Error loading root cause data:', error));
        
    // Function to prepare sorted projects list for navigation
    function prepareSortedProjects() {
        // Get all projects that have root cause data
        sortedProjects = Object.keys(rootCauseData)
            .filter(projectName => {
                const incident = incidents.find(inc => inc.name === projectName);
                return incident && rootCauseData[projectName];
            })
            .sort((a, b) => {
                const dateA = incidents.find(inc => inc.name === a)?.date || '';
                const dateB = incidents.find(inc => inc.name === b)?.date || '';
                return dateB.localeCompare(dateA); // Sort by date, newest first
            });
    }
    
    // Get container element
    const container = document.getElementById('table-container');
    
    // Create statistics container
    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-container';

    // Total incidents count
    const totalIncidents = document.createElement('div');
    totalIncidents.className = 'stat-box';
    totalIncidents.innerHTML = `
        <h3>Total Incidents</h3>
        <p>${incidents.length}</p>
    `;
    statsContainer.appendChild(totalIncidents);
    
    // Total loss amount
    const totalLoss = document.createElement('div');
    totalLoss.className = 'stat-box';
    totalLoss.innerHTML = `
        <h3>Total Loss</h3>
        <p>$0</p>
    `;
    statsContainer.appendChild(totalLoss);
    
    container.appendChild(statsContainer);
    
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
            ${[...new Set(incidents.map(i => i.date.substring(0, 4)))]
                .sort().reverse()
                .map(year => `<option value="${year}">${year}</option>`)
                .join('')}
        </select>
    `;

    // Create attack type filter
    const typeFilter = document.createElement('div');
    typeFilter.className = 'filter-group';
    typeFilter.innerHTML = `
        <label>Attack Type</label>
        <select id="type-filter">
            <option value="">All Types</option>
            ${[...new Set(incidents.map(i => i.type))]
                .filter(type => type)
                .sort()
                .map(type => `<option value="${type}">${type}</option>`)
                .join('')}
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
    container.appendChild(filtersRow);
    
    // Create second row for search
    const searchRow = document.createElement('div');
    searchRow.className = 'search-row';
    searchRow.appendChild(searchBox);
    container.appendChild(searchRow);

    // Create table container
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';

    // Create table
    const table = document.createElement('table');
    table.className = 'incidents-table';
    tableContainer.appendChild(table);
    container.appendChild(tableContainer);

    // Create pagination container
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container';
    container.appendChild(paginationContainer);

    // Main function to update the table with filtered data and pagination
    function updateTable() {
        // Clear the table
        while (table.firstChild) {
            table.removeChild(table.firstChild);
        }

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

        // Get filter values
        const selectedYear = document.getElementById('year-filter').value;
        const selectedType = document.getElementById('type-filter').value;
        const sortBy = document.getElementById('sort-filter').value;
        const searchQuery = document.getElementById('search-box').value.toLowerCase();

        // Filter incidents based on selected criteria
        filteredIncidents = incidents.filter(incident => {
            const matchesYear = !selectedYear || incident.date.startsWith(selectedYear);
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
                // Sort by whether the incident has root cause data (those with root cause come first)
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
        updateStats(filteredIncidents);
    }

    // Function to update pagination controls
    function updatePagination(totalPages) {
        // Clear pagination container
        const paginationContainer = document.querySelector('.pagination-container');
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
    function updateStats(filteredData) {
        // Update total incidents count
        totalIncidents.querySelector('p').textContent = filteredData.length;
        
        // Calculate total loss in USD
        let totalUsdLoss = 0;
        filteredData.forEach(incident => {
            if (incident.Lost && !isNaN(incident.Lost) && incident.lossType === 'USD') {
                totalUsdLoss += parseFloat(incident.Lost);
            } else if (incident.Lost && !isNaN(incident.Lost) && incident.lossType === 'ETH' || incident.lossType === 'WETH')  {
                // Approximate conversion (in a real app, you'd use current rates)
                totalUsdLoss += parseFloat(incident.Lost) * 2500; // Approximate ETH value
            } else if (incident.Lost && !isNaN(incident.Lost) && incident.lossType === 'BNB' || incident.lossType === 'WBNB')  {
                // Approximate conversion
                totalUsdLoss += parseFloat(incident.Lost) * 500; // Approximate BNB value
            } else if (incident.Lost && !isNaN(incident.Lost) && incident.lossType === 'BTC' || incident.lossType === 'WBTC') {
                // Approximate conversion for BTC/WBTC
                totalUsdLoss += parseFloat(incident.Lost) * 60000; // Approximate BTC value
            }
            // Add other conversions as needed
        });
        
        // Format total loss with commas and fixed to 2 decimal places
        const formattedLoss = '$' + totalUsdLoss.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        
        // Update total loss display
        totalLoss.querySelector('p').textContent = formattedLoss;
        
        // Update root cause count if sorting by root cause
        const sortBy = document.getElementById('sort-filter').value;
        const rootCauseCountElement = document.getElementById('root-cause-count');
        
        if (sortBy === 'root_cause_first') {
            // Count incidents with root cause data
            const rootCauseCount = filteredData.filter(incident => 
                rootCauseData[incident.name] 
            ).length;
            
            rootCauseCountElement.textContent = `(${rootCauseCount} root cause reports available)`;
            rootCauseCountElement.style.display = 'inline';
        } else {
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
    
    // Function to convert date to YYYY-MM-DD format for rootCauseData comparison
    function formatDateForComparison(dateStr) {
        if (!dateStr) return '';
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        
        return `${year}-${month}-${day}`;
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
        
        // 如果連結已經是完整的 URL，則直接使用
        if (pocLink.startsWith('http')) {
            return `<a href="${pocLink}" target="_blank">View POC</a>`;
        }
        
        // 否則加上 GitHub 前綴
        return `<a href="${githubPrefix}${pocLink}" target="_blank">View POC</a>`;
    }

    // Add event listeners to filters
    document.getElementById('year-filter').addEventListener('change', () => {
        currentPage = 1;
        updateTable();
    });
    document.getElementById('type-filter').addEventListener('change', () => {
        currentPage = 1;
        updateTable();
    });
    document.getElementById('sort-filter').addEventListener('change', () => {
        updateTable();
    });
    document.getElementById('search-box').addEventListener('input', () => {
        currentPage = 1;
        updateTable();
    });

    // Initialize table display
    updateTable();
    
    // Set up modal functionality
    const modal = document.getElementById('rootCauseModal');
    const closeBtn = document.querySelector('.close');
    
    // Close the modal when the user clicks on the close button
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // Navigation buttons functionality
    document.querySelector('.prev-button').addEventListener('click', () => {
        if (currentProjectIndex > 0) {
            showRootCauseModal(sortedProjects[currentProjectIndex - 1]);
        }
    });
    
    document.querySelector('.next-button').addEventListener('click', () => {
        if (currentProjectIndex < sortedProjects.length - 1) {
            showRootCauseModal(sortedProjects[currentProjectIndex + 1]);
        }
    });
    
    // Close the modal when the user clicks anywhere outside of the modal content
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
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
        
        // Log for debugging
        console.log(`Project: ${projectName}`);
        console.log(`Incident date: ${incident.date}`);
        console.log(`Root cause date: ${projectData.date}`);
        console.log(`Formatted incident date: ${formatDateForComparison(incident.date)}`);
        
        // Populate modal with project data
        document.getElementById('modalTitle').textContent = 'Root Cause Analysis';
        document.getElementById('modalProjectName').textContent = projectName;
        document.getElementById('modalType').textContent = `Attack Type: ${projectData.type || 'Unknown'}`;
        document.getElementById('modalDate').textContent = `Date: ${projectData.date || incident.date || 'Unknown'}`;
        document.getElementById('modalLoss').textContent = `Loss: ${projectData.Lost || incident.Lost || 'Unknown'}`;
        
        // Root cause analysis
        const rootCauseElement = document.getElementById('modalRootCause');
        // Use innerHTML to render markdown content
        rootCauseElement.innerHTML = projectData.rootCause ? marked.parse(projectData.rootCause) : 'No root cause analysis available.';
        
        // Images (if any)
        const imagesContainer = document.getElementById('modalImages');
        imagesContainer.innerHTML = '';
        const imagesSection = document.getElementById('modalImagesSection');
        
        if (projectData.images && projectData.images.length > 0) {
            projectData.images.forEach(imageUrl => {
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = `${projectName} incident image`;
                imagesContainer.appendChild(img);
            });
            imagesSection.style.display = 'block';
        } else {
            imagesContainer.innerHTML = '<p>No images available.</p>';
            imagesSection.style.display = 'none';
        }
        
        // Display the modal
        modal.style.display = 'block';
    }
});