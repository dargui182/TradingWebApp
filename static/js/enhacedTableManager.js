/**
 * Classe per gestire tabelle potenziate con ordinamento, filtri e paginazione
 * VERSIONE CORRETTA - Fix conflitti variabili e timing
 */
class EnhancedTableManager {
    constructor(tableId, options = {}) {
        this.tableId = tableId;
        this.data = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.pageSize = parseInt(options.pageSize) || 25; // QUESTO È IL NUMERO
        this.sortColumn = options.defaultSort || null;
        this.sortDirection = 'asc';
        this.filters = {};
        
        // Elementi DOM - FIX NOMI CORRETTI
        this.table = document.getElementById(tableId);
        this.tbody = document.getElementById(tableId + 'Body');
        this.pagination = document.getElementById(tableId.replace('Table', 'Pagination'));
        this.tableInfo = document.getElementById(tableId.replace('Table', 'TableInfo'));
        this.pageSizeSelect = document.getElementById(tableId.replace('Table', 'PageSize')); // FIX: Rinominato
        
        console.log(`🔧 EnhancedTableManager inizializzato per ${tableId}`);
        console.log(`📊 Elementi trovati:`, {
            table: !!this.table,
            tbody: !!this.tbody,
            pagination: !!this.pagination,
            tableInfo: !!this.tableInfo,
            pageSizeSelect: !!this.pageSizeSelect
        });
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        console.log(`🎧 Inizializzazione event listeners per ${this.tableId}...`);
        
        // Event listeners per ordinamento colonne
        if (this.table) {
            this.table.addEventListener('click', (e) => {
                if (e.target.closest('.sortable')) {
                    const column = e.target.closest('.sortable').dataset.column;
                    console.log(`📊 Click ordinamento colonna: ${column}`);
                    this.sortByColumn(column);
                }
            });
            console.log('✅ Event listener ordinamento configurato');
        }
        
        // Event listener per cambio dimensione pagina - FIX NOME VARIABILE
        if (this.pageSizeSelect) {
            this.pageSizeSelect.addEventListener('change', (e) => {
                console.log(`📄 Cambio page size: ${e.target.value}`);
                this.pageSize = parseInt(e.target.value); // FIX: Usa this.pageSize (numero)
                this.currentPage = 1;
                this.renderTable();
            });
            console.log('✅ Event listener page size configurato');
        }
        
        // Inizializza filtri specifici per tabella
        this.initializeFilters();
    }
    
    initializeFilters() {
        const tableType = this.tableId.includes('zones') ? 'zones' : 'levels';
        console.log(`🔍 Inizializzazione filtri per tipo: ${tableType}`);
        
        // Filtro ticker (sempre presente)
        const tickerFilter = document.getElementById(`${tableType}TickerFilter`);
        if (tickerFilter) {
            tickerFilter.addEventListener('input', () => {
                console.log(`🔍 Filtro ticker cambiato: ${tickerFilter.value}`);
                this.applyFilters();
            });
            console.log('✅ Filtro ticker configurato');
        } else {
            console.warn(`⚠️ Elemento ${tableType}TickerFilter non trovato`);
        }
        
        // Filtro tipo (sempre presente)
        const typeFilter = document.getElementById(`${tableType}TypeFilter`);
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                console.log(`📊 Filtro tipo cambiato: ${typeFilter.value}`);
                this.applyFilters();
            });
            console.log('✅ Filtro tipo configurato');
        } else {
            console.warn(`⚠️ Elemento ${tableType}TypeFilter non trovato`);
        }
        
        // Filtri specifici per zone
        if (tableType === 'zones') {
            const patternFilter = document.getElementById('zonesPatternFilter');
            if (patternFilter) {
                patternFilter.addEventListener('change', () => {
                    console.log(`🎯 Filtro pattern cambiato: ${patternFilter.value}`);
                    this.applyFilters();
                });
                console.log('✅ Filtro pattern zone configurato');
            }
        }
        
        // Filtri specifici per livelli
        if (tableType === 'levels') {
            const strengthFilter = document.getElementById('levelsStrengthFilter');
            const strengthValue = document.getElementById('strengthValue');
            if (strengthFilter && strengthValue) {
                strengthFilter.addEventListener('input', (e) => {
                    strengthValue.textContent = e.target.value;
                    console.log(`💪 Filtro forza cambiato: ${e.target.value}`);
                    this.applyFilters();
                });
                console.log('✅ Filtro forza livelli configurato');
            }
        }
        
        // Pulsante reset filtri
        const clearFilters = document.getElementById(`clear${tableType.charAt(0).toUpperCase() + tableType.slice(1)}Filters`);
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                console.log(`🧹 Reset filtri ${tableType}`);
                this.clearFilters();
            });
            console.log('✅ Pulsante reset filtri configurato');
        } else {
            console.warn(`⚠️ Pulsante reset filtri non trovato: clear${tableType.charAt(0).toUpperCase() + tableType.slice(1)}Filters`);
        }
    }
    
    setData(data) {
        console.log(`📊 Caricamento dati in ${this.tableId}:`, data?.length || 0, 'record');
        this.data = data || [];
        this.applyFilters();
    }
    
    sortByColumn(column) {
        console.log(`📊 Ordinamento per colonna: ${column}, direzione attuale: ${this.sortDirection}`);
        
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        console.log(`📊 Nuova direzione ordinamento: ${this.sortDirection}`);
        this.updateSortIcons();
        this.applyFilters();
    }
    
    updateSortIcons() {
        if (!this.table) return;
        
        // Rimuovi classi di ordinamento da tutte le colonne
        this.table.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });
        
        // Aggiungi classe alla colonna corrente
        if (this.sortColumn) {
            const activeHeader = this.table.querySelector(`[data-column="${this.sortColumn}"]`);
            if (activeHeader) {
                activeHeader.classList.add(`sort-${this.sortDirection}`);
                console.log(`🎯 Icona ordinamento aggiornata per ${this.sortColumn}: ${this.sortDirection}`);
            }
        }
    }
    
    applyFilters() {
        const tableType = this.tableId.includes('zones') ? 'zones' : 'levels';
        let filtered = [...this.data];
        
        console.log(`🔍 Applicazione filtri ${tableType} su ${this.data.length} record...`);
        
        // Filtro ticker
        const tickerFilter = document.getElementById(`${tableType}TickerFilter`);
        if (tickerFilter && tickerFilter.value.trim()) {
            const searchTerm = tickerFilter.value.trim().toLowerCase();
            const originalLength = filtered.length;
            filtered = filtered.filter(item => 
                item.ticker && item.ticker.toLowerCase().includes(searchTerm)
            );
            console.log(`🎯 Filtro ticker "${searchTerm}": ${originalLength} → ${filtered.length}`);
        }
        
        // Filtro tipo
        const typeFilter = document.getElementById(`${tableType}TypeFilter`);
        if (typeFilter && typeFilter.value) {
            const originalLength = filtered.length;
            filtered = filtered.filter(item => item.type === typeFilter.value);
            console.log(`📊 Filtro tipo "${typeFilter.value}": ${originalLength} → ${filtered.length}`);
        }
        
        // Filtri specifici per zone
        if (tableType === 'zones') {
            const patternFilter = document.getElementById('zonesPatternFilter');
            if (patternFilter && patternFilter.value) {
                const originalLength = filtered.length;
                filtered = filtered.filter(item => item.pattern === patternFilter.value);
                console.log(`🎯 Filtro pattern "${patternFilter.value}": ${originalLength} → ${filtered.length}`);
            }
        }
        
        // Filtri specifici per livelli
        if (tableType === 'levels') {
            const strengthFilter = document.getElementById('levelsStrengthFilter');
            if (strengthFilter) {
                const minStrength = parseFloat(strengthFilter.value);
                const originalLength = filtered.length;
                filtered = filtered.filter(item => 
                    (item.strength || 0) >= minStrength
                );
                console.log(`💪 Filtro forza min ${minStrength}: ${originalLength} → ${filtered.length}`);
            }
        }
        
        // Applica ordinamento
        if (this.sortColumn) {
            console.log(`📊 Ordinamento per ${this.sortColumn} (${this.sortDirection})`);
            filtered.sort((a, b) => {
                let aVal = a[this.sortColumn];
                let bVal = b[this.sortColumn];
                
                // Gestione valori nulli/undefined
                if (aVal == null) aVal = '';
                if (bVal == null) bVal = '';
                
                // Converti date per il confronto
                if (this.sortColumn === 'date') {
                    aVal = new Date(aVal);
                    bVal = new Date(bVal);
                }
                
                // Converti numeri per il confronto
                if (typeof aVal === 'string' && !isNaN(aVal)) {
                    aVal = parseFloat(aVal);
                    bVal = parseFloat(bVal);
                }
                
                if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }
        
        this.filteredData = filtered;
        this.currentPage = 1;
        console.log(`✅ Filtri applicati: ${filtered.length} record rimanenti`);
        this.renderTable();
    }
    
    clearFilters() {
        const tableType = this.tableId.includes('zones') ? 'zones' : 'levels';
        console.log(`🧹 Pulizia filtri ${tableType}...`);
        
        // Reset filtro ticker
        const tickerFilter = document.getElementById(`${tableType}TickerFilter`);
        if (tickerFilter) tickerFilter.value = '';
        
        // Reset filtro tipo
        const typeFilter = document.getElementById(`${tableType}TypeFilter`);
        if (typeFilter) typeFilter.value = '';
        
        // Reset filtri specifici
        if (tableType === 'zones') {
            const patternFilter = document.getElementById('zonesPatternFilter');
            if (patternFilter) patternFilter.value = '';
        }
        
        if (tableType === 'levels') {
            const strengthFilter = document.getElementById('levelsStrengthFilter');
            const strengthValue = document.getElementById('strengthValue');
            if (strengthFilter) {
                strengthFilter.value = '0';
                if (strengthValue) strengthValue.textContent = '0';
            }
        }
        
        this.applyFilters();
    }
    
    renderTable() {
        if (!this.tbody) {
            console.error(`❌ tbody non trovato per ${this.tableId}`);
            return;
        }
        
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageData = this.filteredData.slice(start, end);
        
        console.log(`📊 Rendering ${this.tableId}: pagina ${this.currentPage}, record ${start}-${end} di ${this.filteredData.length}`);
        
        // Determina tipo di tabella e renderizza di conseguenza
        if (this.tableId.includes('zones')) {
            this.renderZonesTable(pageData);
        } else {
            this.renderLevelsTable(pageData);
        }
        
        this.updateTableInfo();
        this.renderPagination();
    }
    
    renderZonesTable(zones) {
        if (zones.length === 0) {
            this.tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center text-muted py-4">
                        <div class="empty-state">
                            <i class="bi bi-info-circle"></i>
                            <p class="mb-0">Nessuna zona trovata con i filtri applicati</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        this.tbody.innerHTML = zones.map(zone => `
            <tr class="${zone.type === 'Supply' ? 'table-danger' : 'table-success'} fade-in">
                <td><span class="badge ${zone.type === 'Supply' ? 'bg-danger' : 'bg-success'}">${zone.ticker}</span></td>
                <td class="small">${this.formatDate(zone.date)}</td>
                <td><span class="badge ${this.getPatternBadgeClass(zone.pattern)}">${zone.pattern}</span></td>
                <td><i class="bi ${zone.type === 'Supply' ? 'bi-arrow-down text-danger' : 'bi-arrow-up text-success'}"></i> ${zone.type}</td>
                <td class="font-monospace small">${zone.zone_bottom?.toFixed(4) || 'N/A'} - ${zone.zone_top?.toFixed(4) || 'N/A'}</td>
                <td class="font-monospace">${zone.zone_center?.toFixed(4) || 'N/A'}</td>
                <td><span class="badge bg-secondary">${zone.zone_thickness_pct?.toFixed(2) || 'N/A'}%</span></td>
                <td><small class="text-muted">${zone.strength_score?.toFixed(1) || 'N/A'}</small></td>
                <td class="font-monospace small"><span class="text-muted">${zone.distance_from_current?.toFixed(2) || 'N/A'}%</span></td>
                <td><button class="btn btn-outline-primary btn-sm" onclick="window.taManager?.loadChart('${zone.ticker}')"><i class="bi bi-eye"></i></button></td>
            </tr>
        `).join('');
        
        console.log(`✅ Renderizzate ${zones.length} zone Skorupinski`);
    }
    
    renderLevelsTable(levels) {
        if (levels.length === 0) {
            this.tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center text-muted py-4">
                        <div class="empty-state">
                            <i class="bi bi-info-circle"></i>
                            <p class="mb-0">Nessun livello trovato con i filtri applicati</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        this.tbody.innerHTML = levels.map(level => `
            <tr class="${level.type === 'Resistance' ? 'table-warning' : 'table-info'} fade-in">
                <td><span class="badge ${level.type === 'Resistance' ? 'bg-warning text-dark' : 'bg-info'}">${level.ticker}</span></td>
                <td class="small">${this.formatDate(level.date)}</td>
                <td><i class="bi ${level.type === 'Resistance' ? 'bi-arrow-up text-warning' : 'bi-arrow-down text-info'}"></i> ${level.type}</td>
                <td class="font-monospace">${level.level?.toFixed(4) || 'N/A'}</td>
                <td><small class="text-muted">${level.strength?.toFixed(1) || 'N/A'}</small></td>
                <td class="small">${level.touches || 0} volte</td>
                <td class="small">${level.days_from_end || 'N/A'} giorni</td>
                <td class="font-monospace small">${level.avg_range?.toFixed(4) || 'N/A'}</td>
                <td><button class="btn btn-outline-primary btn-sm" onclick="window.taManager?.loadChart('${level.ticker}')"><i class="bi bi-eye"></i></button></td>
            </tr>
        `).join('');
        
        console.log(`✅ Renderizzati ${levels.length} livelli S/R`);
    }
    
    updateTableInfo() {
        if (!this.tableInfo) return;
        
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.filteredData.length);
        const total = this.filteredData.length;
        const originalTotal = this.data.length;
        
        let infoText = `Mostrando ${start}-${end} di ${total}`;
        if (total !== originalTotal) {
            infoText += ` (filtrati da ${originalTotal} totali)`;
        }
        infoText += ` ${this.tableId.includes('zones') ? 'zone' : 'livelli'}`;
        
        this.tableInfo.textContent = infoText;
    }
    
    renderPagination() {
        if (!this.pagination) return;
        
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        
        if (totalPages <= 1) {
            this.pagination.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // Pulsante Previous
        paginationHTML += `
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${this.currentPage - 1}">
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>
        `;
        
        // Numeri pagina
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        
        if (startPage > 1) {
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
            if (startPage > 2) {
                paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <li class="page-item ${i === this.currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            paginationHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
        }
        
        // Pulsante Next
        paginationHTML += `
            <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${this.currentPage + 1}">
                    <i class="bi bi-chevron-right"></i>
                </a>
            </li>
        `;
        
        this.pagination.innerHTML = paginationHTML;
        
        // Event listeners per paginazione
        this.pagination.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.target.closest('a[data-page]')) {
                const page = parseInt(e.target.closest('a[data-page]').dataset.page);
                if (page >= 1 && page <= totalPages && page !== this.currentPage) {
                    console.log(`📄 Cambio pagina: ${this.currentPage} → ${page}`);
                    this.currentPage = page;
                    this.renderTable();
                }
            }
        });
    }
    
    // Utility methods
    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('it-IT', { 
                day: '2-digit', 
                month: '2-digit', 
                year: '2-digit' 
            });
        } catch {
            return dateStr;
        }
    }
    
    getPatternBadgeClass(pattern) {
        const classes = {
            'RBD': 'bg-danger',
            'DBD': 'bg-dark',
            'DBR': 'bg-success', 
            'RBR': 'bg-primary'
        };
        return classes[pattern] || 'bg-secondary';
    }

// Metodi helper per tooltip descrittivi
getDetailedStrengthDescription(strength) {
    if (!strength && strength !== 0) return 'Forza non calcolata';
    
    if (strength >= 9) return `Eccellente (${strength?.toFixed(1)}/10) - Zona molto affidabile con impulso forte`;
    if (strength >= 8) return `Molto forte (${strength?.toFixed(1)}/10) - Zona affidabile con buon volume`;
    if (strength >= 6) return `Forte (${strength?.toFixed(1)}/10) - Zona discreta con impulso discreto`;
    if (strength >= 4) return `Media (${strength?.toFixed(1)}/10) - Zona normale, da confermare`;
    if (strength >= 2) return `Debole (${strength?.toFixed(1)}/10) - Zona poco affidabile`;
    return `Molto debole (${strength?.toFixed(1)}/10) - Zona da ignorare`;
}

getDetailedDistanceDescription(distance) {
    if (!distance && distance !== 0) return 'Distanza non calcolata';
    
    const absDistance = Math.abs(distance);
    const direction = distance > 0 ? 'sopra' : 'sotto';
    const directionIcon = distance > 0 ? '⬆️' : '⬇️';
    
    if (absDistance < 0.5) return `${directionIcon} Molto vicina (${distance?.toFixed(1)}% ${direction}) - Attenzione immediata`;
    if (absDistance < 1) return `${directionIcon} Vicinissima (${distance?.toFixed(1)}% ${direction}) - Altamente rilevante`;
    if (absDistance < 2) return `${directionIcon} Vicina (${distance?.toFixed(1)}% ${direction}) - Molto rilevante`;
    if (absDistance < 5) return `${directionIcon} A distanza media (${distance?.toFixed(1)}% ${direction}) - Rilevante`;
    if (absDistance < 10) return `${directionIcon} Distante (${distance?.toFixed(1)}% ${direction}) - Poco rilevante`;
    return `${directionIcon} Molto distante (${distance?.toFixed(1)}% ${direction}) - Non rilevante`;
}

getDetailedPatternDescription(pattern) {
    const descriptions = {
        'RBD': {
            name: 'Rise-Base-Drop',
            description: 'Salita → Consolidamento → Discesa',
            type: 'Supply Zone (vendita)',
            strategy: 'Aspetta re-test della zona per vendite',
            reliability: 'Alta se impulso down è forte'
        },
        'DBD': {
            name: 'Drop-Base-Drop',
            description: 'Discesa → Consolidamento → Discesa',
            type: 'Supply Zone (vendita)',
            strategy: 'Conferma debolezza, vendite aggressive',
            reliability: 'Media, verifica volume'
        },
        'DBR': {
            name: 'Drop-Base-Rise',
            description: 'Discesa → Consolidamento → Salita',
            type: 'Demand Zone (acquisto)',
            strategy: 'Aspetta re-test della zona per acquisti',
            reliability: 'Alta se impulso up è forte'
        },
        'RBR': {
            name: 'Rise-Base-Rise',
            description: 'Salita → Consolidamento → Salita',
            type: 'Demand Zone (acquisto)',
            strategy: 'Conferma forza, acquisti aggressivi',
            reliability: 'Media, verifica volume'
        }
    };
    
    const info = descriptions[pattern];
    if (!info) return `Pattern ${pattern} non riconosciuto`;
    
    return `${info.name}: ${info.description}
Tipo: ${info.type}
Strategia: ${info.strategy}
Affidabilità: ${info.reliability}`;
}

getDetailedTouchesDescription(touches) {
    if (!touches) return 'Nessun test registrato';
    
    if (touches >= 6) return `Molto testato (${touches} tocchi) - Livello estremamente affidabile, probabilmente forte reazione`;
    if (touches >= 4) return `Ben testato (${touches} tocchi) - Livello molto affidabile, aspettati reazione`;
    if (touches >= 3) return `Testato (${touches} tocchi) - Livello affidabile, buona probabilità di reazione`;
    if (touches >= 2) return `Poco testato (${touches} tocchi) - Livello da confermare, cautela`;
    return `Non testato (${touches} tocco) - Livello debole, alta probabilità di rottura`;
}

getDetailedAgeDescription(days) {
    if (!days && days !== 0) return 'Età non disponibile';
    
    if (days <= 3) return `Freschissimo (${days} giorni) - Massima rilevanza, alta probabilità reazione`;
    if (days <= 7) return `Molto recente (${days} giorni) - Alta rilevanza, buona probabilità reazione`;
    if (days <= 21) return `Recente (${days} giorni) - Buona rilevanza, discreta probabilità reazione`;
    if (days <= 60) return `Medio termine (${days} giorni) - Media rilevanza, verifica con altri fattori`;
    if (days <= 120) return `Datato (${days} giorni) - Bassa rilevanza, probabilmente superato`;
    return `Molto vecchio (${days} giorni) - Rilevanza minima, probabilmente irrilevante`;
}

// Genera tooltip avanzato per zone
generateZoneTooltip(zone) {
    const strengthDesc = this.getDetailedStrengthDescription(zone.strength_score);
    const distanceDesc = this.getDetailedDistanceDescription(zone.distance_from_current);
    const patternDesc = this.getDetailedPatternDescription(zone.pattern);
    
    return `🎯 ${zone.ticker} - ${zone.type} Zone
📅 Formata: ${this.formatDate(zone.date)}
${patternDesc}

💪 Forza: ${strengthDesc}

📍 Posizione: ${distanceDesc}

🎯 Centro zona: ${zone.zone_center?.toFixed(4)}
📏 Range: ${zone.zone_bottom?.toFixed(4)} - ${zone.zone_top?.toFixed(4)}
📐 Spessore: ${zone.zone_thickness_pct?.toFixed(2)}%

💡 Più spessa è la zona, meno precisa è la reazione`;
}

// Genera tooltip avanzato per livelli S/R
generateLevelTooltip(level) {
    const strengthDesc = this.getDetailedStrengthDescription(level.strength);
    const touchesDesc = this.getDetailedTouchesDescription(level.touches);
    const ageDesc = this.getDetailedAgeDescription(level.days_from_end);
    
    const typeDesc = level.type === 'Resistance' ? 
        'Resistenza: Area dove venditori sono attivi (pressione ribassista)' :
        'Supporto: Area dove compratori sono attivi (pressione rialzista)';
    
    return `📏 ${level.ticker} - ${level.type}
📅 Formata: ${this.formatDate(level.date)}
${typeDesc}

💰 Livello esatto: ${level.level?.toFixed(4)}

💪 Forza: ${strengthDesc}

👆 Test: ${touchesDesc}

📅 Età: ${ageDesc}

📊 Range medio: ${level.avg_range?.toFixed(4)}

💡 Più tocchi = maggiore probabilità di reazione`;
}






}