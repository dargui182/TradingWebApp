/**
 * DataTable.js
 * Componente tabella universale con ordinamento, filtri, paginazione e azioni
 * Estende BaseComponent per funzionalità comuni
 */

class DataTable extends BaseComponent {
    constructor(containerId, options = {}) {
        super(containerId, options);
        
        // Stato interno della tabella
        this.data = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.sortField = null;
        this.sortDirection = 'asc';
        this.searchTerm = '';
        
        // Cache per performance
        this.renderedRows = new Map();
        this.lastRenderHash = null;
    }

    get defaultOptions() {
        return {
            ...super.defaultOptions,
            
            // Configurazione colonne
            columns: [],
            
            // Dati
            data: [],
            keyField: 'id',
            
            // Paginazione
            pagination: {
                enabled: true,
                pageSize: 25,
                showInfo: true,
                showSizeSelector: true,
                sizes: [10, 25, 50, 100]
            },
            
            // Ordinamento
            sorting: {
                enabled: true,
                defaultField: null,
                defaultDirection: 'asc'
            },
            
            // Filtro/Ricerca
            filtering: {
                enabled: true,
                placeholder: 'Cerca...',
                debounceMs: 300,
                fields: [] // Se vuoto, cerca in tutti i campi
            },
            
            // Azioni
            actions: {
                enabled: true,
                column: {
                    title: 'Azioni',
                    width: '120px',
                    className: 'text-center'
                },
                buttons: [] // Array di { label, icon, className, callback }
            },
            
            // Selezione
            selection: {
                enabled: false,
                multiple: true,
                showSelectAll: true
            },
            
            // Export
            export: {
                enabled: true,
                formats: ['csv', 'excel'],
                filename: 'data'
            },
            
            // UI
            ui: {
                striped: true,
                hover: true,
                bordered: false,
                small: false,
                responsive: true,
                emptyMessage: 'Nessun dato disponibile',
                loadingMessage: 'Caricamento dati...'
            },
            
            // Callbacks
            onRowClick: null,
            onSelectionChange: null,
            onSort: null,
            onFilter: null,
            onPageChange: null
        };
    }

    async beforeRender() {
        // Inizializza dati se forniti nelle opzioni
        if (this.options.data?.length > 0) {
            this.setData(this.options.data);
        }
        
        // Imposta ordinamento di default
        if (this.options.sorting.defaultField) {
            this.sortField = this.options.sorting.defaultField;
            this.sortDirection = this.options.sorting.defaultDirection;
        }
    }

    async render() {
        this.hideError();
        
        // Template principale della tabella
        this.container.innerHTML = this.getTableTemplate();
        
        // Rendering componenti
        await this.renderSearch();
        await this.renderTable();
        await this.renderPagination();
        await this.renderControls();
    }

    getTableTemplate() {
        return `
            <div class="datatable-container">
                <!-- Header con controlli -->
                <div class="datatable-header d-flex justify-content-between align-items-center mb-3">
                    <div class="datatable-search-container">
                        <!-- Search box renderizzato dinamicamente -->
                    </div>
                    <div class="datatable-controls">
                        <!-- Controlli export e altro -->
                    </div>
                </div>
                
                <!-- Tabella principale -->
                <div class="datatable-wrapper ${this.options.ui.responsive ? 'table-responsive' : ''}">
                    <table class="table datatable-table ${this.getTableClasses()}">
                        <thead class="datatable-head">
                            <!-- Header renderizzato dinamicamente -->
                        </thead>
                        <tbody class="datatable-body">
                            <!-- Rows renderizzati dinamicamente -->
                        </tbody>
                    </table>
                </div>
                
                <!-- Footer con paginazione e info -->
                <div class="datatable-footer d-flex justify-content-between align-items-center mt-3">
                    <div class="datatable-info">
                        <!-- Info risultati -->
                    </div>
                    <div class="datatable-pagination">
                        <!-- Paginazione -->
                    </div>
                </div>
                
                <!-- Area per selezioni multiple -->
                ${this.options.selection.enabled ? '<div class="datatable-selection-actions mt-2"></div>' : ''}
            </div>
        `;
    }

    getTableClasses() {
        const classes = [];
        if (this.options.ui.striped) classes.push('table-striped');
        if (this.options.ui.hover) classes.push('table-hover');
        if (this.options.ui.bordered) classes.push('table-bordered');
        if (this.options.ui.small) classes.push('table-sm');
        return classes.join(' ');
    }

    async renderSearch() {
        if (!this.options.filtering.enabled) return;
        
        const searchContainer = this.$('.datatable-search-container');
        if (!searchContainer) return;

        searchContainer.innerHTML = `
            <div class="input-group" style="width: 300px;">
                <span class="input-group-text">
                    <i class="bi bi-search"></i>
                </span>
                <input type="text" 
                       class="form-control datatable-search" 
                       placeholder="${this.options.filtering.placeholder}"
                       value="${this.searchTerm}">
                ${this.searchTerm ? `
                    <button class="btn btn-outline-secondary datatable-clear-search" type="button">
                        <i class="bi bi-x"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }

    async renderTable() {
        await this.renderHeader();
        await this.renderBody();
    }

    async renderHeader() {
        const thead = this.$('.datatable-head');
        if (!thead) return;

        let headerHTML = '<tr>';
        
        // Checkbox selezione multipla
        if (this.options.selection.enabled && this.options.selection.showSelectAll) {
            headerHTML += `
                <th style="width: 50px;" class="text-center">
                    <input type="checkbox" class="form-check-input datatable-select-all">
                </th>
            `;
        }

        // Colonne dati
        this.options.columns.forEach(column => {
            const sortable = this.options.sorting.enabled && (column.sortable !== false);
            const sorted = this.sortField === column.key;
            const sortIcon = sorted ? 
                (this.sortDirection === 'asc' ? 'bi-sort-up' : 'bi-sort-down') : 
                'bi-arrow-down-up';

            headerHTML += `
                <th ${column.width ? `style="width: ${column.width};"` : ''}
                    class="${column.className || ''} ${sortable ? 'sortable' : ''}"
                    data-field="${column.key}">
                    <div class="d-flex align-items-center justify-content-between">
                        <span>${column.title}</span>
                        ${sortable ? `<i class="bi ${sortIcon} ms-1 ${sorted ? 'text-primary' : 'text-muted'}"></i>` : ''}
                    </div>
                </th>
            `;
        });

        // Colonna azioni
        if (this.options.actions.enabled && this.options.actions.buttons.length > 0) {
            headerHTML += `
                <th style="width: ${this.options.actions.column.width || '120px'};" 
                    class="${this.options.actions.column.className || 'text-center'}">
                    ${this.options.actions.column.title}
                </th>
            `;
        }

        headerHTML += '</tr>';
        thead.innerHTML = headerHTML;
    }

    async renderBody() {
        const tbody = this.$('.datatable-body');
        if (!tbody) return;

        if (this.filteredData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${this.getTotalColumns()}" class="text-center text-muted py-4">
                        <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                        ${this.options.ui.emptyMessage}
                    </td>
                </tr>
            `;
            return;
        }

        // Calcola pagina corrente
        const startIndex = (this.currentPage - 1) * this.options.pagination.pageSize;
        const endIndex = Math.min(startIndex + this.options.pagination.pageSize, this.filteredData.length);
        const pageData = this.filteredData.slice(startIndex, endIndex);

        // Rendering righe
        let rowsHTML = '';
        pageData.forEach((row, index) => {
            rowsHTML += this.renderRow(row, startIndex + index);
        });

        tbody.innerHTML = rowsHTML;
    }

    renderRow(row, rowIndex) {
        const rowKey = this.getRowKey(row);
        const isSelected = this.isRowSelected(rowKey);
        
        let rowHTML = `<tr data-row-key="${rowKey}" data-row-index="${rowIndex}" 
                           class="${isSelected ? 'table-active' : ''} datatable-row">`;

        // Checkbox selezione
        if (this.options.selection.enabled) {
            rowHTML += `
                <td class="text-center">
                    <input type="checkbox" 
                           class="form-check-input datatable-row-select" 
                           data-row-key="${rowKey}"
                           ${isSelected ? 'checked' : ''}>
                </td>
            `;
        }

        // Celle dati
        this.options.columns.forEach(column => {
            const value = this.getCellValue(row, column);
            const formattedValue = this.formatCellValue(value, column);
            
            rowHTML += `
                <td class="${column.cellClassName || ''}" 
                    data-field="${column.key}">
                    ${formattedValue}
                </td>
            `;
        });

        // Celle azioni
        if (this.options.actions.enabled && this.options.actions.buttons.length > 0) {
            rowHTML += `<td class="${this.options.actions.column.className || 'text-center'}">`;
            rowHTML += this.renderRowActions(row, rowIndex);
            rowHTML += '</td>';
        }

        rowHTML += '</tr>';
        return rowHTML;
    }

    renderRowActions(row, rowIndex) {
        return this.options.actions.buttons.map(action => {
            const disabled = action.disabled && action.disabled(row) ? 'disabled' : '';
            const visible = action.visible !== undefined ? action.visible(row) : true;
            
            if (!visible) return '';

            return `
                <button type="button" 
                        class="btn btn-sm ${action.className || 'btn-outline-primary'} datatable-action me-1"
                        data-action="${action.key || action.label}"
                        data-row-key="${this.getRowKey(row)}"
                        data-row-index="${rowIndex}"
                        title="${action.title || action.label}"
                        ${disabled}>
                    ${action.icon ? `<i class="bi ${action.icon}"></i>` : ''}
                    ${action.showLabel !== false ? `<span class="ms-1">${action.label}</span>` : ''}
                </button>
            `;
        }).join('');
    }

    async renderPagination() {
        if (!this.options.pagination.enabled) return;

        const paginationContainer = this.$('.datatable-pagination');
        const infoContainer = this.$('.datatable-info');
        
        if (!paginationContainer || !infoContainer) return;

        const totalItems = this.filteredData.length;
        const totalPages = Math.ceil(totalItems / this.options.pagination.pageSize);
        const startItem = Math.min((this.currentPage - 1) * this.options.pagination.pageSize + 1, totalItems);
        const endItem = Math.min(this.currentPage * this.options.pagination.pageSize, totalItems);

        // Info risultati
        if (this.options.pagination.showInfo) {
            infoContainer.innerHTML = `
                <small class="text-muted">
                    Visualizzati ${startItem}-${endItem} di ${totalItems} risultati
                    ${this.searchTerm ? `(filtrati da ${this.data.length} totali)` : ''}
                </small>
            `;
        }

        // Paginazione
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '<nav><ul class="pagination pagination-sm mb-0">';
        
        // Previous
        paginationHTML += `
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                <button class="page-link datatable-page" data-page="${this.currentPage - 1}">
                    <i class="bi bi-chevron-left"></i>
                </button>
            </li>
        `;

        // Pages
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        if (startPage > 1) {
            paginationHTML += `
                <li class="page-item">
                    <button class="page-link datatable-page" data-page="1">1</button>
                </li>
            `;
            if (startPage > 2) {
                paginationHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <li class="page-item ${i === this.currentPage ? 'active' : ''}">
                    <button class="page-link datatable-page" data-page="${i}">${i}</button>
                </li>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
            paginationHTML += `
                <li class="page-item">
                    <button class="page-link datatable-page" data-page="${totalPages}">${totalPages}</button>
                </li>
            `;
        }

        // Next
        paginationHTML += `
            <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                <button class="page-link datatable-page" data-page="${this.currentPage + 1}">
                    <i class="bi bi-chevron-right"></i>
                </button>
            </li>
        `;

        paginationHTML += '</ul></nav>';
        paginationContainer.innerHTML = paginationHTML;
    }

    async renderControls() {
        const controlsContainer = this.$('.datatable-controls');
        if (!controlsContainer) return;

        let controlsHTML = '';

        // Selezione dimensione pagina
        if (this.options.pagination.enabled && this.options.pagination.showSizeSelector) {
            controlsHTML += `
                <div class="me-3">
                    <select class="form-select form-select-sm datatable-page-size" style="width: auto;">
                        ${this.options.pagination.sizes.map(size => `
                            <option value="${size}" ${size === this.options.pagination.pageSize ? 'selected' : ''}>
                                ${size} per pagina
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        }

        // Pulsanti export
        if (this.options.export.enabled && this.options.export.formats.length > 0) {
            controlsHTML += `
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle" 
                            data-bs-toggle="dropdown">
                        <i class="bi bi-download"></i> Esporta
                    </button>
                    <ul class="dropdown-menu">
                        ${this.options.export.formats.map(format => `
                            <li>
                                <button class="dropdown-item datatable-export" data-format="${format}">
                                    <i class="bi bi-file-earmark-${format === 'csv' ? 'spreadsheet' : 'excel'}"></i>
                                    Esporta ${format.toUpperCase()}
                                </button>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        controlsContainer.innerHTML = controlsHTML;
    }

    setupEventListeners() {
        // Search con debounce
        let searchTimeout;
        this.addEventListener('.datatable-search', 'input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.handleSearch(e.target.value);
            }, this.options.filtering.debounceMs);
        });

        // Clear search
        this.addEventListener('.datatable-clear-search', 'click', () => {
            this.handleSearch('');
        });

        // Ordinamento colonne
        this.addEventListener('.sortable', 'click', (e) => {
            const field = e.currentTarget.dataset.field;
            this.handleSort(field);
        });

        // Paginazione
        this.addEventListener('.datatable-page', 'click', (e) => {
            const page = parseInt(e.target.dataset.page);
            this.handlePageChange(page);
        });

        // Dimensione pagina
        this.addEventListener('.datatable-page-size', 'change', (e) => {
            this.handlePageSizeChange(parseInt(e.target.value));
        });

        // Row click
        this.addEventListener('.datatable-row', 'click', (e) => {
            if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON') return;
            this.handleRowClick(e);
        });

        // Selezione righe
        if (this.options.selection.enabled) {
            this.addEventListener('.datatable-select-all', 'change', (e) => {
                this.handleSelectAll(e.target.checked);
            });

            this.addEventListener('.datatable-row-select', 'change', (e) => {
                this.handleRowSelect(e.target.dataset.rowKey, e.target.checked);
            });
        }

        // Azioni
        this.addEventListener('.datatable-action', 'click', (e) => {
            this.handleAction(e);
        });

        // Export
        this.addEventListener('.datatable-export', 'click', (e) => {
            this.handleExport(e.target.dataset.format);
        });
    }

    // ===== GESTIONE DATI =====

    setData(data) {
        this.data = Array.isArray(data) ? data : [];
        this.applyFilters();
        if (this.isReady) {
            this.render();
        }
        this.emit('dataChanged', this.data);
    }

    getData() {
        return this.data;
    }

    getFilteredData() {
        return this.filteredData;
    }

    addRow(row) {
        this.data.push(row);
        this.applyFilters();
        this.render();
        this.emit('rowAdded', row);
    }

    updateRow(key, updatedRow) {
        const index = this.data.findIndex(row => this.getRowKey(row) === key);
        if (index !== -1) {
            this.data[index] = { ...this.data[index], ...updatedRow };
            this.applyFilters();
            this.render();
            this.emit('rowUpdated', { key, row: this.data[index] });
        }
    }

    removeRow(key) {
        const index = this.data.findIndex(row => this.getRowKey(row) === key);
        if (index !== -1) {
            const removedRow = this.data.splice(index, 1)[0];
            this.applyFilters();
            this.render();
            this.emit('rowRemoved', { key, row: removedRow });
        }
    }

    // ===== EVENT HANDLERS =====

    handleSearch(term) {
        this.searchTerm = term;
        this.currentPage = 1;
        this.applyFilters();
        this.render();
        
        if (this.options.onFilter) {
            this.options.onFilter(term, this.filteredData);
        }
        this.emit('filtered', { term, data: this.filteredData });
    }

    handleSort(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }

        this.applySort();
        this.render();

        if (this.options.onSort) {
            this.options.onSort(field, this.sortDirection, this.filteredData);
        }
        this.emit('sorted', { field, direction: this.sortDirection });
    }

    handlePageChange(page) {
        if (page < 1 || page > Math.ceil(this.filteredData.length / this.options.pagination.pageSize)) {
            return;
        }

        this.currentPage = page;
        this.renderBody();
        this.renderPagination();

        if (this.options.onPageChange) {
            this.options.onPageChange(page, this.filteredData);
        }
        this.emit('pageChanged', page);
    }

    handlePageSizeChange(size) {
        this.options.pagination.pageSize = size;
        this.currentPage = 1;
        this.render();
        this.emit('pageSizeChanged', size);
    }

    handleRowClick(e) {
        const row = this.getRowFromEvent(e);
        const rowKey = e.currentTarget.dataset.rowKey;
        
        if (this.options.onRowClick) {
            this.options.onRowClick(row, rowKey, e);
        }
        this.emit('rowClicked', { row, key: rowKey, event: e });
    }

    handleSelectAll(checked) {
        const checkboxes = this.$$('.datatable-row-select');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            this.handleRowSelect(checkbox.dataset.rowKey, checked);
        });
    }

    handleRowSelect(key, selected) {
        // Implementazione selezione...
        this.emit('selectionChanged', { key, selected });
    }

    handleAction(e) {
        e.stopPropagation();
        
        const actionKey = e.currentTarget.dataset.action;
        const rowKey = e.currentTarget.dataset.rowKey;
        const rowIndex = parseInt(e.currentTarget.dataset.rowIndex);
        const row = this.getRowByKey(rowKey);
        
        const action = this.options.actions.buttons.find(a => 
            (a.key || a.label) === actionKey
        );

        if (action && action.callback) {
            action.callback(row, rowKey, rowIndex, e);
        }

        this.emit('actionClicked', { action: actionKey, row, key: rowKey });
    }

    async handleExport(format) {
        try {
            this.showLoading('Preparazione export...');
            
            const filename = `${this.options.export.filename}_${new Date().toISOString().split('T')[0]}`;
            
            if (format === 'csv') {
                this.exportCSV(filename);
            } else if (format === 'excel') {
                this.exportExcel(filename);
            }
            
            this.hideLoading();
            this.emit('exported', { format, filename });
            
        } catch (error) {
            this.hideLoading();
            this.showError('Errore durante l\'export', error);
        }
    }

    // ===== UTILITY METHODS =====

    applyFilters() {
        let filtered = [...this.data];

        // Applica ricerca
        if (this.searchTerm) {
            const searchFields = this.options.filtering.fields.length > 0 
                ? this.options.filtering.fields 
                : this.options.columns.map(col => col.key);

            filtered = filtered.filter(row => {
                return searchFields.some(field => {
                    const value = this.getCellValue(row, { key: field });
                    return String(value).toLowerCase().includes(this.searchTerm.toLowerCase());
                });
            });
        }

        this.filteredData = filtered;
        this.applySort();
    }

    applySort() {
        if (!this.sortField) return;

        const column = this.options.columns.find(col => col.key === this.sortField);
        
        this.filteredData.sort((a, b) => {
            let aVal = this.getCellValue(a, column);
            let bVal = this.getCellValue(b, column);

            // Gestione tipi diversi
            if (column?.type === 'number') {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            } else if (column?.type === 'date') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            } else {
                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();
            }

            let result = 0;
            if (aVal < bVal) result = -1;
            else if (aVal > bVal) result = 1;

            return this.sortDirection === 'desc' ? -result : result;
        });
    }

    getCellValue(row, column) {
        if (column.accessor) {
            return column.accessor(row);
        }
        
        // Supporto per nested properties (es: "user.name")
        return column.key.split('.').reduce((obj, key) => obj?.[key], row) ?? '';
    }

    formatCellValue(value, column) {
        if (column.formatter) {
            if (typeof column.formatter === 'function') {
                return column.formatter(value);
            } else if (typeof column.formatter === 'string') {
                return this.applyBuiltInFormatter(value, column.formatter);
            }
        }
        
        return this.escapeHtml(String(value));
    }

    applyBuiltInFormatter(value, formatterType) {
        switch (formatterType) {
            case 'currency':
                return new Intl.NumberFormat('it-IT', { 
                    style: 'currency', 
                    currency: 'EUR' 
                }).format(value);
            
            case 'number':
                return new Intl.NumberFormat('it-IT').format(value);
            
            case 'percentage':
                return `${(value * 100).toFixed(2)}%`;
            
            case 'date':
                return new Date(value).toLocaleDateString('it-IT');
            
            case 'datetime':
                return new Date(value).toLocaleString('it-IT');
            
            case 'boolean':
                return value ? 
                    '<i class="bi bi-check-circle text-success"></i>' : 
                    '<i class="bi bi-x-circle text-danger"></i>';
            
            default:
                return this.escapeHtml(String(value));
        }
    }

    getRowKey(row) {
        return row[this.options.keyField] || JSON.stringify(row);
    }

    getRowByKey(key) {
        return this.data.find(row => this.getRowKey(row) === key);
    }

    getRowFromEvent(e) {
        const rowKey = e.currentTarget.dataset.rowKey;
        return this.getRowByKey(rowKey);
    }

    getTotalColumns() {
        let total = this.options.columns.length;
        if (this.options.selection.enabled) total++;
        if (this.options.actions.enabled && this.options.actions.buttons.length > 0) total++;
        return total;
    }

    isRowSelected(key) {
        // Implementazione selezione righe
        return false;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    exportCSV(filename) {
        const headers = this.options.columns.map(col => col.title);
        const rows = this.filteredData.map(row => 
            this.options.columns.map(col => this.getCellValue(row, col))
        );
        
        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        
        this.downloadFile(csvContent, `${filename}.csv`, 'text/csv');
    }

    exportExcel(filename) {
        // Implementazione export Excel con libreria SheetJS se disponibile
        console.log('Export Excel non implementato - richiede libreria SheetJS');
    }

    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ===== API PUBBLICA =====

    refresh() {
        return super.refresh();
    }

    getSelectedRows() {
        // Implementazione selezione
        return [];
    }

    clearSelection() {
        // Implementazione pulizia selezione
    }

    exportData(format = 'csv') {
        this.handleExport(format);
    }

    search(term) {
        this.handleSearch(term);
    }

    sort(field, direction = 'asc') {
        this.sortField = field;
        this.sortDirection = direction;
        this.applySort();
        this.render();
    }

    goToPage(page) {
        this.handlePageChange(page);
    }

    setPageSize(size) {
        this.handlePageSizeChange(size);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataTable;
} else {
    window.DataTable = DataTable;
}