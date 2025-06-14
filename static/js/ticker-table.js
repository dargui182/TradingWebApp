/**
 * ticker-table-simple.js
 * Gestione della tabella dei ticker - versione semplificata e sincrona
 * CORRETTO: Usa sempre window.TickerAPI per evitare problemi di scope
 */

class TickerTable {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 25;
        this.sortColumn = '';
        this.sortDirection = 'asc';
        this.searchTerm = '';
        this.allRows = [];
        this.filteredRows = [];
        
        this.init();
    }

    init() {
        console.log('🔄 Inizializzazione TickerTable Simple...');
        
        // Aspetta che il DOM sia pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        console.log('⚙️ Setup TickerTable...');
        
        // Raccogli tutte le righe della tabella
        this.collectTableRows();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Inizializza display
        this.updateTableDisplay();
        
        console.log(`✅ TickerTable inizializzata con ${this.allRows.length} righe`);
    }

    collectTableRows() {
        const tbody = document.getElementById('tickersTableBody');
        if (!tbody) {
            console.warn('⚠️ Tbody non trovato');
            return;
        }

        this.allRows = Array.from(tbody.querySelectorAll('tr'));
        this.filteredRows = [...this.allRows];
        
        console.log(`📊 Raccolte ${this.allRows.length} righe dalla tabella`);
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('tickerSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', window.UIUtils.debounce((e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.filterTableRows();
                this.currentPage = 1;
                this.updateTableDisplay();
            }, 300));
        }

        // Clear search
        const clearBtn = document.getElementById('clearSearchBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearSearch());
        }

        // Reset search
        const resetBtn = document.getElementById('resetSearchBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.clearSearch());
        }

        // Page size change
        const pageSizeSelect = document.getElementById('pageSize');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.pageSize = parseInt(e.target.value);
                this.currentPage = 1;
                this.updateTableDisplay();
            });
        }

        // Column sorting
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                this.handleSort(column);
            });
        });

        // Action buttons
        this.setupActionButtons();
    }

    setupActionButtons() {
        // Download buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.download-ticker-btn')) {
                const btn = e.target.closest('.download-ticker-btn');
                const ticker = btn.dataset.ticker;
                this.downloadTicker(ticker, btn);
            }
        });

        // View buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.view-ticker-btn')) {
                const btn = e.target.closest('.view-ticker-btn');
                const ticker = btn.dataset.ticker;
                this.viewTicker(ticker);
            }
        });

        // Remove buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.remove-ticker-btn')) {
                const btn = e.target.closest('.remove-ticker-btn');
                const ticker = btn.dataset.ticker;
                this.removeTicker(ticker);
            }
        });
    }

    clearSearch() {
        const searchInput = document.getElementById('tickerSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        this.searchTerm = '';
        this.filterTableRows();
        this.currentPage = 1;
        this.updateTableDisplay();
    }

    filterTableRows() {
        if (!this.searchTerm) {
            this.filteredRows = [...this.allRows];
            return;
        }

        this.filteredRows = this.allRows.filter(row => {
            const ticker = (row.dataset.ticker || '').toLowerCase();
            const name = (row.dataset.name || '').toLowerCase();
            const sector = (row.dataset.sector || '').toLowerCase();
            const industry = (row.dataset.industry || '').toLowerCase();

            return ticker.includes(this.searchTerm) ||
                   name.includes(this.searchTerm) ||
                   sector.includes(this.searchTerm) ||
                   industry.includes(this.searchTerm);
        });

        // Update search results count
        const searchResults = document.getElementById('searchResults');
        if (searchResults) {
            searchResults.textContent = `${this.filteredRows.length} ticker trovati`;
        }
    }

    handleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        this.sortTableRows();
        this.updateSortIcons();
        this.currentPage = 1;
        this.updateTableDisplay();
    }

    sortTableRows() {
        this.filteredRows.sort((a, b) => {
            let valueA, valueB;

            switch (this.sortColumn) {
                case 'ticker':
                    valueA = (a.dataset.ticker || '').trim();
                    valueB = (b.dataset.ticker || '').trim();
                    break;
                case 'name':
                    valueA = (a.dataset.name || '').trim();
                    valueB = (b.dataset.name || '').trim();
                    break;
                case 'records':
                    valueA = parseInt(a.dataset.records) || 0;
                    valueB = parseInt(b.dataset.records) || 0;
                    break;
                case 'status':
                    const statusOrder = {
                        'missing': 1,
                        'pending': 2,
                        'partial': 3,
                        'updated': 4
                    };
                    valueA = statusOrder[a.dataset.status] || 0;
                    valueB = statusOrder[b.dataset.status] || 0;
                    break;
                default:
                    return 0;
            }

            // Confronto
            if (typeof valueA === 'string' && typeof valueB === 'string') {
                const result = valueA.localeCompare(valueB, 'en', { 
                    numeric: true, 
                    sensitivity: 'base' 
                });
                return this.sortDirection === 'asc' ? result : -result;
            }

            // Per numeri
            if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
            if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    updateSortIcons() {
        // Reset all icons
        document.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('asc', 'desc');
        });

        // Set current column icon
        if (this.sortColumn) {
            const currentHeader = document.querySelector(`[data-column="${this.sortColumn}"]`);
            if (currentHeader) {
                currentHeader.classList.add(this.sortDirection);
            }
        }
    }

    updateTableDisplay() {
        const totalRows = this.filteredRows.length;
        const totalPages = Math.ceil(totalRows / this.pageSize);

        // Show/hide no results message
        this.toggleNoResultsMessage(totalRows === 0 && this.searchTerm);

        if (totalRows === 0 && this.searchTerm) {
            return;
        }

        // Ensure current page is valid
        if (this.currentPage > totalPages && totalPages > 0) {
            this.currentPage = totalPages;
        }
        if (this.currentPage < 1) {
            this.currentPage = 1;
        }

        // Calculate showing range
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, totalRows);

        // Update info text
        this.updateInfoText(startIndex, endIndex, totalRows);

        // Show/hide rows
        this.displayCurrentPageRows(startIndex, endIndex);

        // Update pagination
        this.updatePagination(totalPages);
    }

    toggleNoResultsMessage(show) {
        const noResultsMsg = document.getElementById('noResultsMessage');
        const tableContainer = document.querySelector('.table-responsive');
        const paginationContainer = document.querySelector('.d-flex.justify-content-between.align-items-center.mt-3');

        if (show) {
            if (noResultsMsg) noResultsMsg.classList.remove('d-none');
            if (tableContainer) tableContainer.style.display = 'none';
            if (paginationContainer) paginationContainer.style.display = 'none';
        } else {
            if (noResultsMsg) noResultsMsg.classList.add('d-none');
            if (tableContainer) tableContainer.style.display = 'block';
            if (paginationContainer) paginationContainer.style.display = 'flex';
        }
    }

    updateInfoText(startIndex, endIndex, totalRows) {
        const showingFrom = document.getElementById('showingFrom');
        const showingTo = document.getElementById('showingTo');
        const totalRowsSpan = document.getElementById('totalRows');
        const filteredInfo = document.getElementById('filteredInfo');

        if (showingFrom) showingFrom.textContent = totalRows > 0 ? startIndex + 1 : 0;
        if (showingTo) showingTo.textContent = endIndex;
        if (totalRowsSpan) totalRowsSpan.textContent = totalRows;

        if (filteredInfo) {
            if (this.searchTerm && totalRows < this.allRows.length) {
                filteredInfo.textContent = ` (filtrati da ${this.allRows.length})`;
            } else {
                filteredInfo.textContent = '';
            }
        }
    }

    displayCurrentPageRows(startIndex, endIndex) {
        // Hide all rows first
        this.allRows.forEach(row => row.style.display = 'none');

        // Show current page rows in the correct order
        const tbody = document.getElementById('tickersTableBody');
        if (tbody) {
            this.filteredRows.slice(startIndex, endIndex).forEach(row => {
                row.style.display = '';
                tbody.appendChild(row); // This moves the row to the end
            });
        }
    }

    updatePagination(totalPages) {
        const paginationNav = document.getElementById('paginationNav');
        if (!paginationNav) return;

        paginationNav.innerHTML = '';

        if (totalPages <= 1) return;

        // Previous button
        this.addPaginationButton(paginationNav, '‹', this.currentPage - 1, this.currentPage === 1);

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        if (startPage > 1) {
            this.addPaginationButton(paginationNav, '1', 1);
            if (startPage > 2) {
                this.addPaginationDots(paginationNav);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            this.addPaginationButton(paginationNav, i.toString(), i, false, i === this.currentPage);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                this.addPaginationDots(paginationNav);
            }
            this.addPaginationButton(paginationNav, totalPages.toString(), totalPages);
        }

        // Next button
        this.addPaginationButton(paginationNav, '›', this.currentPage + 1, this.currentPage === totalPages);

        // Add click handlers
        paginationNav.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.target.tagName === 'A' && e.target.dataset.page) {
                const newPage = parseInt(e.target.dataset.page);
                if (newPage >= 1 && newPage <= totalPages && newPage !== this.currentPage) {
                    this.currentPage = newPage;
                    this.updateTableDisplay();
                }
            }
        });
    }

    addPaginationButton(container, text, page, disabled = false, active = false) {
        const li = document.createElement('li');
        li.className = `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;
        
        if (disabled) {
            li.innerHTML = `<span class="page-link">${text}</span>`;
        } else {
            li.innerHTML = `<a class="page-link" href="#" data-page="${page}">${text}</a>`;
        }
        
        container.appendChild(li);
    }

    addPaginationDots(container) {
        const li = document.createElement('li');
        li.className = 'page-item disabled';
        li.innerHTML = '<span class="page-link">...</span>';
        container.appendChild(li);
    }

    // Action handlers - CORRETTO: Usa sempre window.TickerAPI
    async downloadTicker(ticker, button) {
        console.log(`📥 Download ticker: ${ticker}`);
        
        // Verifica che TickerAPI sia disponibile - CORRETTO!
        if (!window.TickerAPI || typeof window.TickerAPI.downloadTicker !== 'function') {
            console.error('❌ TickerAPI non disponibile!');
            window.UIUtils.showNotification('❌ Sistema non inizializzato correttamente', 'danger');
            return;
        }
        
        window.UIUtils.setButtonLoading(button, true);
        window.UIUtils.addLogEntry(`Inizio download ${ticker}...`, 'info');

        try {
            // Usa window.TickerAPI - SEMPRE!
            const result = await window.TickerAPI.downloadTicker(ticker);
            
            if (result.status === 'success') {
                window.UIUtils.addLogEntry(`✅ ${result.message}`, 'success');
                window.UIUtils.showNotification(result.message, 'success');
                setTimeout(() => location.reload(), 1000);
            } else if (result.status === 'info') {
                window.UIUtils.addLogEntry(`ℹ️ ${result.message}`, 'info');
                window.UIUtils.showNotification(result.message, 'info');
            } else {
                window.UIUtils.addLogEntry(`❌ ${result.message}`, 'error');
                window.UIUtils.showNotification(result.message, 'danger');
            }
        } catch (error) {
            console.error(`❌ Errore download ${ticker}:`, error);
            window.UIUtils.addLogEntry(`❌ Errore download ${ticker}: ${error.message}`, 'error');
            window.UIUtils.showNotification(`❌ Errore download ${ticker}`, 'danger');
        } finally {
            window.UIUtils.setButtonLoading(button, false);
        }
    }

    viewTicker(ticker) {
        console.log(`👁️ View ticker: ${ticker}`);
        
        // Dispara evento personalizzato per il modal
        const event = new CustomEvent('showTickerDetails', { 
            detail: { ticker: ticker } 
        });
        document.dispatchEvent(event);
    }

    async removeTicker(ticker) {
        console.log(`🗑️ Remove ticker: ${ticker}`);
        
        if (!confirm(`Sei sicuro di voler rimuovere il ticker ${ticker}?\n\nVerranno eliminati anche i file di dati.`)) {
            return;
        }

        // Verifica che TickerAPI sia disponibile - CORRETTO!
        if (!window.TickerAPI || typeof window.TickerAPI.removeTicker !== 'function') {
            console.error('❌ TickerAPI non disponibile!');
            window.UIUtils.showNotification('❌ Sistema non inizializzato correttamente', 'danger');
            return;
        }

        try {
            // Usa window.TickerAPI - SEMPRE!
            const result = await window.TickerAPI.removeTicker(ticker);
            
            if (result.status === 'success') {
                window.UIUtils.showNotification(result.message, 'success');
                window.UIUtils.addLogEntry(`🗑️ Ticker ${ticker} rimosso`, 'info');
                setTimeout(() => location.reload(), 1000);
            } else {
                window.UIUtils.showNotification(result.message, 'danger');
            }
        } catch (error) {
            console.error(`❌ Errore rimozione ${ticker}:`, error);
            window.UIUtils.showNotification(`❌ Errore durante la rimozione del ticker: ${error.message}`, 'danger');
        }
    }

    // Public methods for external use
    refresh() {
        this.collectTableRows();
        this.filterTableRows();
        this.updateTableDisplay();
    }

    searchFor(term) {
        const searchInput = document.getElementById('tickerSearchInput');
        if (searchInput) {
            searchInput.value = term;
        }
        this.searchTerm = term.toLowerCase();
        this.filterTableRows();
        this.currentPage = 1;
        this.updateTableDisplay();
    }
}

// Inizializza quando il DOM è pronto - SEMPLICE!
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 DOM pronto, controllo elementi per TickerTable...');
    
    // Controlla se esiste la tabella ticker
    if (document.getElementById('tickersTable')) {
        console.log('✅ Tabella ticker trovata, inizializzazione TickerTable...');
        window.TickerTableInstance = new TickerTable();
    } else {
        console.log('ℹ️ Tabella ticker non trovata, skip inizializzazione');
    }
});

console.log('✅ TickerTable Simple module caricato');