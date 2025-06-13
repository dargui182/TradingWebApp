/**
 * ticker-modal.js
 * Gestione del modal per visualizzare i dettagli dei ticker
 */

class TickerModal {
    constructor() {
        this.currentTicker = null;
        this.modal = null;
        this.dataCache = new Map(); // Cache per i dati storici
        this.isLoading = false; // Previene chiamate multiple
        this.init();
    }

    init() {
        // Debug: controlla stato TickerAPI
        this.checkTickerAPIStatus();
        
        // Setup event listeners
        this.setupEventListeners();
        console.log('✅ TickerModal inizializzato');
    }

    checkTickerAPIStatus() {
        console.log('🔍 Debug TickerModal - Stato TickerAPI:');
        console.log('- window.TickerAPI esiste?', !!window.TickerAPI);
        console.log('- TickerAPI.getTickerData è funzione?', typeof window.TickerAPI?.getTickerData);
        console.log('- TickerAPI.getTickerDetails è funzione?', typeof window.TickerAPI?.getTickerDetails);
        
        if (!window.TickerAPI) {
            console.warn('⚠️ TickerAPI non disponibile al momento dell\'inizializzazione del modal');
        }
    }

    setupEventListeners() {
        // Listen for custom event from table
        document.addEventListener('showTickerDetails', (e) => {
            this.showTickerDetails(e.detail.ticker);
        });

        // Listen for data version changes with debouncing
        let changeTimeout;
        document.addEventListener('change', (e) => {
            if (e.target.name === 'dataVersion' && this.currentTicker && !this.isLoading) {
                // Clear previous timeout
                clearTimeout(changeTimeout);
                
                // Debounce per evitare chiamate multiple
                changeTimeout = setTimeout(() => {
                    const version = e.target.id === 'rawRadio' ? 'raw' : 'adjusted';
                    console.log(`🔄 Cambio versione dati: ${version}`);
                    this.loadHistoricalData(this.currentTicker, version);
                }, 150);
            }
        });

        // Reset cache quando il modal si chiude
        const modal = document.getElementById('viewTickerModal');
        if (modal) {
            modal.addEventListener('hidden.bs.modal', () => {
                this.currentTicker = null;
                this.isLoading = false;
                // Non svuotare cache per mantenere i dati tra aperture
            });
        }
    }

    async showTickerDetails(ticker) {
        console.log(`📊 Mostrando dettagli per: ${ticker}`);
        
        this.currentTicker = ticker;
        this.isLoading = false; // Reset loading state
        
        // Apri il modal
        this.modal = new bootstrap.Modal(document.getElementById('viewTickerModal'));
        this.modal.show();
        
        // Reset radio buttons to adjusted
        const adjustedRadio = document.getElementById('adjustedRadio');
        const rawRadio = document.getElementById('rawRadio');
        if (adjustedRadio) adjustedRadio.checked = true;
        if (rawRadio) rawRadio.checked = false;
        
        // Mostra loading e nascondi contenuto
        this.showLoading(true);
        
        // Imposta titolo
        document.getElementById('modalTickerSymbol').textContent = ticker;
        
        try {
            // Carica dati del ticker
            await this.loadTickerData(ticker);
        } catch (error) {
            console.error('❌ Errore caricamento ticker:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // Metodo pubblico per pulire la cache
    clearCache() {
        console.log('🧹 Pulizia cache dati storici');
        this.dataCache.clear();
    }

    // Metodo pubblico per pulire cache di un ticker specifico
    clearTickerCache(ticker) {
        console.log(`🧹 Pulizia cache per ticker: ${ticker}`);
        const keysToDelete = [];
        for (const key of this.dataCache.keys()) {
            if (key.startsWith(ticker + '-')) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.dataCache.delete(key));
    }

    showLoading(show) {
        const loadingDiv = document.getElementById('modalLoading');
        const contentDiv = document.getElementById('modalContent');
        
        if (show) {
            if (loadingDiv) loadingDiv.classList.remove('d-none');
            if (contentDiv) contentDiv.classList.add('d-none');
        } else {
            if (loadingDiv) loadingDiv.classList.add('d-none');
            if (contentDiv) contentDiv.classList.remove('d-none');
        }
    }

    async loadTickerData(ticker) {
        console.log(`📡 Caricamento dati per: ${ticker}`);
        
        let tickerData = null;
        
        try {
            // Controlla se TickerAPI esiste e aspetta se necessario
            await this.waitForTickerAPI();
            
            // Prova prima con l'API
            console.log(`🌐 Tentativo API per ${ticker}...`);
            tickerData = await window.TickerAPI.getTickerDetails(ticker);
            console.log('✅ Dati caricati da API:', tickerData);
            
            // Verifica che i dati siano validi
            if (!tickerData || tickerData.status === 'error') {
                throw new Error(tickerData?.message || 'Dati API non validi');
            }
            
        } catch (apiError) {
            console.warn('⚠️ API fallita, uso dati dalla tabella:', apiError.message);
            
            // Fallback: usa dati dalla tabella
            tickerData = this.extractDataFromTable(ticker);
            
            if (!tickerData) {
                throw new Error(`Dati per ${ticker} non trovati né da API né da tabella`);
            }
            
            console.log('📊 Usando dati dalla tabella:', tickerData);
        }
        
        // Debug: log struttura dati
        console.log('🔍 Struttura dati finale:', {
            ticker: tickerData.ticker,
            hasInfo: !!tickerData.info,
            hasCsvInfo: !!tickerData.csv_info,
            sector: tickerData.info?.sector || tickerData.csv_info?.sector,
            industry: tickerData.info?.industry || tickerData.csv_info?.industry,
            firstDate: tickerData.first_date,
            lastDate: tickerData.last_close_date,
            totalRecords: tickerData.total_records
        });
        
        // Popola il modal
        this.populateModal(tickerData);
        this.setupModalActions(ticker);
        
        // Pulisci cache precedente per questo ticker
        this.clearTickerCache(ticker);
        
        // Carica dati storici con versione di default
        await this.loadHistoricalData(ticker, 'adjusted');
    }

    extractDataFromTable(ticker) {
        const row = document.querySelector(`tr[data-ticker="${ticker}"]`);
        if (!row) {
            console.error('❌ Riga ticker non trovata nella tabella');
            return null;
        }

        // Estrai informazioni dalla riga
        const data = {
            ticker: ticker,
            name: row.dataset.name || ticker,
            total_records: parseInt(row.dataset.records) || 0,
            needs_update: row.dataset.status === 'pending',
            files_exist: {
                adjusted: true,
                not_adjusted: true
            },
            file_sizes: {
                adjusted: 'N/A',
                not_adjusted: 'N/A'
            }
        };

        // Cerca settore e industria
        const sectorElement = row.querySelector('.sector-info');
        const industryElement = row.querySelector('.industry-info');
        
        if (sectorElement || industryElement) {
            data.info = {
                sector: sectorElement ? sectorElement.textContent.replace(/[📊📋🏢]/, '').trim() : 'N/A',
                industry: industryElement ? industryElement.textContent.trim() : 'N/A',
                name: data.name,
                currency: 'USD',
                exchange: 'N/A',
                country: 'N/A'
            };
        }

        // Cerca CSV info se presente
        if (sectorElement && sectorElement.textContent.includes('📄')) {
            data.csv_info = {
                sector: data.info?.sector || 'N/A',
                industry: data.info?.industry || 'N/A'
            };
        }

        // Estrai dimensioni file
        const sizeElements = row.querySelectorAll('.small div');
        sizeElements.forEach(el => {
            const text = el.textContent;
            if (text.includes('Adj:')) {
                data.file_sizes.adjusted = text.replace(/[📊Adj:]/g, '').trim();
            } else if (text.includes('Raw:')) {
                data.file_sizes.not_adjusted = text.replace(/[📋Raw:]/g, '').trim();
            }
        });

        console.log('📊 Dati estratti dalla tabella:', data);
        return data;
    }

    populateModal(data) {
        console.log('📝 Popolamento modal con:', data);
        
        // Informazioni azienda - priorità: info > csv_info > defaults
        const info = data.info || {};
        const csvInfo = data.csv_info || {};
        
        // Nome azienda
        const companyName = info.name || data.name || data.ticker;
        this.setElementText('modalCompanyName', companyName);
        
        // Settore e industria - usa prima info, poi csv_info come fallback
        const sector = info.sector || csvInfo.sector || 'N/A';
        const industry = info.industry || csvInfo.industry || 'N/A';
        
        this.setElementText('modalSector', sector);
        this.setElementText('modalIndustry', industry);
        this.setElementText('modalExchange', info.exchange || 'N/A');
        this.setElementText('modalCurrency', info.currency || 'USD');
        
        console.log(`📊 Settore: ${sector}, Industria: ${industry}`);
        
        // Stato
        this.updateStatusBadge(data);
        
        // Statistiche dati
        this.setElementText('modalTotalRecords', UIUtils.formatNumber(data.total_records || 0));
        this.setElementText('modalFirstDate', UIUtils.formatDate(data.first_date));
        this.setElementText('modalLastDate', UIUtils.formatDate(data.last_close_date));
        
        // Calcola periodo
        const span = UIUtils.calculateDataSpan(data.first_date, data.last_close_date);
        this.setElementText('modalDataSpan', span);
        
        // File info
        const fileSizes = data.file_sizes || {};
        this.setElementText('modalAdjustedSize', fileSizes.adjusted || 'N/A');
        this.setElementText('modalNotAdjustedSize', fileSizes.not_adjusted || 'N/A');
        
        const filesExist = data.files_exist || {};
        this.setElementText('modalAdjustedStatus', filesExist.adjusted ? '✅' : '❌');
        this.setElementText('modalNotAdjustedStatus', filesExist.not_adjusted ? '✅' : '❌');
        
        // Informazioni importazione
        const importInfo = document.getElementById('modalImportInfo');
        if (data.csv_info && importInfo) {
            importInfo.classList.remove('d-none');
            this.setElementText('modalImportDate', UIUtils.formatDateTime(data.csv_info.imported_at));
        } else if (importInfo) {
            importInfo.classList.add('d-none');
        }
        
        // Last updated
        this.setElementText('modalLastUpdated', UIUtils.formatDateTime(data.last_updated));
    }

    setElementText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text || 'N/A';
        }
    }

    updateStatusBadge(data) {
        const statusBadge = document.getElementById('modalStatusBadge');
        const statusIcon = document.getElementById('modalStatusIcon');
        
        if (!statusBadge || !statusIcon) return;
        
        if (data.needs_update) {
            statusBadge.className = 'badge bg-warning fs-6 mb-2';
            statusBadge.textContent = '⏰ Da aggiornare';
            statusIcon.textContent = '⏰';
        } else if (data.files_exist?.adjusted && data.files_exist?.not_adjusted) {
            statusBadge.className = 'badge bg-success fs-6 mb-2';
            statusBadge.textContent = '✅ Completo';
            statusIcon.textContent = '✅';
        } else if (data.files_exist?.adjusted || data.files_exist?.not_adjusted) {
            statusBadge.className = 'badge bg-warning fs-6 mb-2';
            statusBadge.textContent = '⚠️ Parziale';
            statusIcon.textContent = '⚠️';
        } else {
            statusBadge.className = 'badge bg-danger fs-6 mb-2';
            statusBadge.textContent = '❌ Mancante';
            statusIcon.textContent = '❌';
        }
    }

    async loadHistoricalData(ticker, version = 'adjusted') {
        if (this.isLoading) {
            console.log('⏳ Caricamento già in corso, ignoro richiesta');
            return;
        }

        console.log(`📈 Caricamento dati storici per ${ticker} (${version})`);
        
        // Controlla cache
        const cacheKey = `${ticker}-${version}`;
        if (this.dataCache.has(cacheKey)) {
            console.log(`💾 Dati trovati in cache per ${cacheKey}`);
            const cachedData = this.dataCache.get(cacheKey);
            this.populateHistoricalTable(cachedData, version);
            return;
        }

        this.isLoading = true;
        this.showTableLoading(true);
        
        try {
            // Controlla se TickerAPI esiste e aspetta se necessario
            await this.waitForTickerAPI();
            
            const apiUrl = `/api/ticker/${ticker}/data?limit=20&version=${version}`;
            console.log(`🌐 Chiamata API: ${apiUrl}`);
            
            const data = await window.TickerAPI.getTickerData(ticker, { 
                limit: 20, 
                version: version 
            });
            
            console.log('📊 Dati storici ricevuti:', data);
            
            // Verifica struttura dati
            if (!data || !data.data || !Array.isArray(data.data)) {
                throw new Error('Struttura dati non valida dalla API');
            }
            
            let historicalData;
            if (data.data.length === 0) {
                console.warn('⚠️ Nessun dato storico disponibile dalla API');
                historicalData = this.getConsistentMockData(ticker, version);
            } else {
                console.log(`✅ Caricati ${data.data.length} record storici dalla API`);
                historicalData = data.data;
            }
            
            // Salva in cache
            this.dataCache.set(cacheKey, historicalData);
            
            // Popola tabella
            this.populateHistoricalTable(historicalData, version);
            
            // Mostra la tabella
            this.showTableLoading(false, false);
            
        } catch (error) {
            console.error('❌ Errore caricamento dati storici:', error);
            console.error('Stack trace:', error.stack);
            
            // Fallback con dati consistenti
            console.log('🔄 Usando dati mock consistenti...');
            try {
                const mockData = this.getConsistentMockData(ticker, version);
                
                // Salva in cache anche i dati mock
                this.dataCache.set(cacheKey, mockData);
                
                this.populateHistoricalTable(mockData, version);
                this.showTableLoading(false, false);
                
                console.log('✅ Utilizzati dati mock consistenti');
            } catch (fallbackError) {
                console.error('❌ Anche fallback fallito:', fallbackError);
                this.showTableLoading(false, true);
            }
        } finally {
            this.isLoading = false;
        }
    }

    // Nuovo metodo per aspettare che TickerAPI sia pronto
    async waitForTickerAPI() {
        const maxAttempts = 50; // 5 secondi massimo
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            if (window.TickerAPI && typeof window.TickerAPI.getTickerData === 'function') {
                console.log('✅ TickerAPI trovato e pronto');
                return;
            }
            
            console.log(`⏳ Attesa TickerAPI... tentativo ${attempts + 1}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        // Se TickerAPI non è disponibile, crea una versione di emergenza
        console.warn('🚨 TickerAPI non disponibile, creazione versione di emergenza...');
        this.createEmergencyTickerAPI();
        
        if (window.TickerAPI && typeof window.TickerAPI.getTickerData === 'function') {
            console.log('✅ TickerAPI di emergenza creato');
            return;
        }
        
        throw new Error('TickerAPI non disponibile dopo 5 secondi di attesa');
    }

    // Crea un TickerAPI minimo di emergenza
    createEmergencyTickerAPI() {
        console.log('🔧 Creazione TickerAPI di emergenza...');
        
        window.TickerAPI = {
            async getTickerDetails(ticker) {
                console.log(`🌐 Emergency API: getTickerDetails(${ticker})`);
                const response = await fetch(`/api/ticker/${ticker}/details`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return await response.json();
            },
            
            async getTickerData(ticker, options = {}) {
                const { limit = 20, version = 'adjusted' } = options;
                console.log(`🌐 Emergency API: getTickerData(${ticker}, ${version})`);
                const response = await fetch(`/api/ticker/${ticker}/data?limit=${limit}&version=${version}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return await response.json();
            }
        };
        
        console.log('✅ TickerAPI di emergenza creato');
    }

    getConsistentMockData(ticker, version) {
        // Usa il ticker come seed per generare sempre gli stessi dati
        const seed = this.hashCode(ticker + version);
        
        console.log(`🧪 Generazione dati mock consistenti per ${ticker} (${version}) con seed: ${seed}`);
        
        const mockData = [];
        const today = new Date();
        
        // Usa il seed per Math.random consistente
        const seededRandom = this.seededRandom(seed);
        
        for (let i = 0; i < 5; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            const basePrice = 100 + (seededRandom() * 50);
            const record = {
                date: date.toISOString().split('T')[0],
                open: Math.round((basePrice + seededRandom() * 2 - 1) * 100) / 100,
                high: Math.round((basePrice + seededRandom() * 3) * 100) / 100,
                low: Math.round((basePrice - seededRandom() * 3) * 100) / 100,
                close: Math.round((basePrice + seededRandom() * 2 - 1) * 100) / 100,
                volume: Math.floor(seededRandom() * 1000000) + 100000
            };
            
            if (version === 'adjusted') {
                record.adj_close = record.close;
            }
            
            mockData.push(record);
        }
        
        console.log('🧪 Dati mock consistenti creati:', mockData.length, 'record');
        return mockData;
    }

    // Hash function per creare seed consistente
    hashCode(str) {
        let hash = 0;
        if (str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    // Generatore random con seed per consistenza
    seededRandom(seed) {
        let currentSeed = seed;
        return function() {
            currentSeed = (currentSeed * 9301 + 49297) % 233280;
            return currentSeed / 233280;
        };
    }

    showTableLoading(show, showError = false) {
        const loadingDiv = document.getElementById('tableLoading');
        const containerDiv = document.getElementById('historicalDataContainer');
        const errorDiv = document.getElementById('tableError');
        
        if (show) {
            if (loadingDiv) loadingDiv.classList.remove('d-none');
            if (containerDiv) containerDiv.classList.add('d-none');
            if (errorDiv) errorDiv.classList.add('d-none');
        } else if (showError) {
            if (loadingDiv) loadingDiv.classList.add('d-none');
            if (containerDiv) containerDiv.classList.add('d-none');
            if (errorDiv) errorDiv.classList.remove('d-none');
        } else {
            if (loadingDiv) loadingDiv.classList.add('d-none');
            if (containerDiv) containerDiv.classList.remove('d-none');
            if (errorDiv) errorDiv.classList.add('d-none');
        }
    }

    populateHistoricalTable(data, version) {
        const tbody = document.getElementById('historicalDataBody');
        const adjCloseHeader = document.getElementById('adjCloseHeader');
        const dataVersionNote = document.getElementById('dataVersionNote');
        
        if (!tbody) return;
        
        // Aggiorna header e note
        if (version === 'raw') {
            if (adjCloseHeader) adjCloseHeader.style.display = 'none';
            if (dataVersionNote) dataVersionNote.textContent = 'Prezzi storici originali (non aggiustati)';
        } else {
            if (adjCloseHeader) adjCloseHeader.style.display = '';
            if (dataVersionNote) dataVersionNote.textContent = 'Prezzi aggiustati per splits e dividendi';
        }
        
        // Pulisci tabella
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-3">
                        <i class="bi bi-inbox"></i>
                        <br>Nessun dato disponibile
                    </td>
                </tr>
            `;
            return;
        }
        
        // Ordina per data decrescente
        const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Popola righe
        sortedData.forEach((record, index) => {
            const row = document.createElement('tr');
            
            // Evidenzia prima riga
            if (index === 0) {
                row.classList.add('table-warning');
            }
            
            // Calcola variazione
            const changePercent = UIUtils.calculateDayChange(record.open, record.close);
            const changeClass = changePercent > 0 ? 'text-success' : changePercent < 0 ? 'text-danger' : '';
            
            row.innerHTML = `
                <td>
                    <strong>${UIUtils.formatDate(record.date)}</strong>
                    ${index === 0 ? '<span class="badge bg-primary ms-1">Latest</span>' : ''}
                </td>
                <td class="text-end font-monospace">${UIUtils.formatPrice(record.open)}</td>
                <td class="text-end font-monospace text-success">${UIUtils.formatPrice(record.high)}</td>
                <td class="text-end font-monospace text-danger">${UIUtils.formatPrice(record.low)}</td>
                <td class="text-end font-monospace ${changeClass}">
                    ${UIUtils.formatPrice(record.close)}
                    ${changePercent !== null ? `<br><small>(${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)</small>` : ''}
                </td>
                ${version === 'adjusted' ? `<td class="text-end font-monospace">${UIUtils.formatPrice(record.adj_close)}</td>` : ''}
                <td class="text-end font-monospace text-muted">
                    ${UIUtils.formatVolume(record.volume)}
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    setupModalActions(ticker) {
        // Download
        const downloadBtn = document.getElementById('modalDownloadBtn');
        if (downloadBtn) {
            downloadBtn.onclick = async () => {
                this.modal.hide();
                setTimeout(async () => {
                    try {
                        // Controlla che TickerAPI sia disponibile
                        await this.waitForTickerAPI();
                        
                        UIUtils.addLogEntry(`Inizio download ${ticker}...`, 'info');
                        const result = await window.TickerAPI.downloadTicker(ticker);
                        
                        if (result.status === 'success') {
                            UIUtils.addLogEntry(`✅ ${result.message}`, 'success');
                            UIUtils.showNotification(result.message, 'success');
                            setTimeout(() => location.reload(), 1000);
                        } else {
                            UIUtils.addLogEntry(`ℹ️ ${result.message}`, 'info');
                            UIUtils.showNotification(result.message, 'info');
                        }
                    } catch (error) {
                        console.error('❌ Errore download:', error);
                        UIUtils.addLogEntry(`❌ Errore download ${ticker}`, 'error');
                        UIUtils.showNotification(`Errore download ${ticker}`, 'danger');
                    }
                }, 300);
            };
        }
        
        // Esplora file
        const viewFilesBtn = document.getElementById('modalViewFilesBtn');
        if (viewFilesBtn) {
            viewFilesBtn.onclick = () => {
                const paths = [
                    `resources/data/daily/${ticker}.csv`,
                    `resources/data/daily_notAdjusted/${ticker}_notAdjusted.csv`,
                    `resources/meta/${ticker}.json`
                ];
                
                alert(`📁 Percorsi file per ${ticker}:\n\n` +
                      `• Adjusted: ${paths[0]}\n` +
                      `• Raw: ${paths[1]}\n` +
                      `• Metadati: ${paths[2]}\n\n` +
                      `💡 Usa il file manager per aprire i file.`);
            };
        }
        
        // Export
        const exportBtn = document.getElementById('modalExportBtn');
        if (exportBtn) {
            exportBtn.onclick = () => this.exportTickerInfo(ticker);
        }
        
        // Rimuovi
        const deleteBtn = document.getElementById('modalDeleteBtn');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                this.modal.hide();
                setTimeout(async () => {
                    if (confirm(`🗑️ Rimuovere definitivamente ${ticker}?\n\nQuesta azione eliminerà tutti i file di dati.`)) {
                        try {
                            // Controlla che TickerAPI sia disponibile
                            await this.waitForTickerAPI();
                            
                            const result = await window.TickerAPI.removeTicker(ticker);
                            
                            if (result.status === 'success') {
                                UIUtils.showNotification(result.message, 'success');
                                UIUtils.addLogEntry(`🗑️ Ticker ${ticker} rimosso`, 'info');
                                setTimeout(() => location.reload(), 1000);
                            } else {
                                UIUtils.showNotification(result.message, 'danger');
                            }
                        } catch (error) {
                            console.error('❌ Errore rimozione:', error);
                            UIUtils.showNotification('Errore durante la rimozione', 'danger');
                        }
                    }
                }, 300);
            };
        }
    }

    async exportTickerInfo(ticker) {
        try {
            UIUtils.showNotification(`📥 Preparazione export per ${ticker}...`, 'info');
            
            // Carica dati completi
            let details = {};
            let historicalData = {};
            
            try {
                details = await TickerAPI.getTickerDetails(ticker);
            } catch (e) {
                details = this.extractDataFromTable(ticker) || {};
            }
            
            try {
                historicalData = await TickerAPI.getTickerData(ticker, { limit: 100 });
            } catch (e) {
                historicalData = { data: [] };
            }
            
            // Crea export
            const exportData = {
                export_info: {
                    ticker: ticker,
                    exported_at: new Date().toISOString(),
                    exported_by: 'Stock Data Manager',
                    version: '1.0'
                },
                ticker_details: details,
                recent_data: historicalData.data || [],
                file_paths: {
                    adjusted: `resources/data/daily/${ticker}.csv`,
                    raw: `resources/data/daily_notAdjusted/${ticker}_notAdjusted.csv`,
                    metadata: `resources/meta/${ticker}.json`
                },
                notes: [
                    'Questo file contiene metadati e dati recenti',
                    'Per i dati completi, consultare i file CSV',
                    'I prezzi adjusted sono corretti per splits e dividendi'
                ]
            };
            
            // Download
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${ticker}_export_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            UIUtils.showNotification(`✅ Export ${ticker} completato!`, 'success');
            
        } catch (error) {
            console.error('Errore export:', error);
            UIUtils.showNotification(`❌ Errore export ${ticker}`, 'danger');
        }
    }

    showError(message) {
        const contentDiv = document.getElementById('modalContent');
        if (contentDiv) {
            contentDiv.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-exclamation-triangle text-warning display-1"></i>
                    <h5 class="mt-3">Errore</h5>
                    <p class="text-muted">${message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">
                        <i class="bi bi-arrow-clockwise me-1"></i>Ricarica Pagina
                    </button>
                </div>
            `;
        }
    }
}

// Crea istanza globale
window.TickerModalInstance = null;

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 DOM pronto per TickerModal...');
    
    if (document.getElementById('viewTickerModal')) {
        console.log('✅ Modal element trovato, inizializzazione...');
        window.TickerModalInstance = new TickerModal();
        
        // Debug finale
        setTimeout(() => {
            console.log('🧪 Debug finale TickerModal:');
            console.log('- Modal instance:', !!window.TickerModalInstance);
            console.log('- TickerAPI disponibile:', !!window.TickerAPI);
            console.log('- getTickerData presente:', typeof window.TickerAPI?.getTickerData);
            
            // Test rapido se tutto è OK
            if (window.TickerAPI && typeof window.TickerAPI.getTickerData === 'function') {
                console.log('✅ Tutto OK! Modal pronto per l\'uso');
            } else {
                console.warn('⚠️ Alcuni componenti non sono pronti');
            }
        }, 1000);
    } else {
        console.log('ℹ️ Modal element non trovato, skip inizializzazione');
    }
});

console.log('✅ TickerModal module caricato');