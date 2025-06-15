/**
 * technical-analysis.js
 * JavaScript per la gestione dell'analisi tecnica con supporti/resistenze e zone Skorupinski
 * VERSIONE FINALE CON LEGGENDA INTERATTIVA
 */

class TechnicalAnalysisManager {
    constructor() {
        this.currentDataSource = 'adjusted';
        this.chart = null;
        // Inizializza gestori tabelle potenziate
        this.zonesTableManager = null;
        this.levelsTableManager = null;
        
        this.init();
    }

    init() {
        console.log('🔧 Inizializzazione Technical Analysis Manager...');
        this.setupEventListeners();
        this.loadInitialData();
        // Inizializza dopo che il DOM è pronto
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeEnhancedTables();
        });
        console.log('✅ Technical Analysis Manager inizializzato');
    }

    setupEventListeners() {
        // Main action buttons
        document.getElementById('runAnalysisBtn')?.addEventListener('click', () => {
            this.runAnalysis('both');
        });

        document.getElementById('runFullAnalysisBtn')?.addEventListener('click', () => {
            this.runAnalysis('both');
        });

        document.getElementById('runSROnlyBtn')?.addEventListener('click', () => {
            this.runAnalysis('sr');
        });

        document.getElementById('runSkorupinkiOnlyBtn')?.addEventListener('click', () => {
            this.runAnalysis('skorupinski');
        });

        // Data source dropdown
        document.querySelectorAll('[data-source]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const source = e.target.dataset.source;
                this.setDataSource(source);
            });
        });

        // Chart controls
        document.getElementById('chartTickerSelect')?.addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadChart(e.target.value);
            }
        });

        // Listener per dropdown giorni
        const daysSelect = document.getElementById('daysSelect') || document.getElementById('chartDaysSelect');
        if (daysSelect) {
            daysSelect.addEventListener('change', (e) => {
                console.log(`📅 Giorni cambiati: ${e.target.value}`);
                const currentTicker = document.getElementById('chartTickerSelect')?.value;
                if (currentTicker) {
                    this.loadChart(currentTicker);
                }
            });
        }

        document.getElementById('loadChartBtn')?.addEventListener('click', () => {
            const ticker = document.getElementById('chartTickerSelect')?.value;
            if (ticker) {
                this.loadChart(ticker);
            }
        });

        // Refresh buttons
        document.getElementById('refreshSummaryBtn')?.addEventListener('click', () => {
            this.refreshSummary();
        });

        document.getElementById('refreshZonesBtn')?.addEventListener('click', () => {
            this.loadZonesTable();
        });

        document.getElementById('refreshLevelsBtn')?.addEventListener('click', () => {
            this.loadLevelsTable();
        });

        // Export button
        document.getElementById('exportAnalysisBtn')?.addEventListener('click', () => {
            this.exportAnalysisResults();
        });

        // Tab change events
        document.querySelectorAll('#analysisNavTabs button').forEach(button => {
            button.addEventListener('shown.bs.tab', (e) => {
                const target = e.target.getAttribute('data-bs-target');
                this.onTabChanged(target);
            });
        });

        console.log('✅ Event listeners configurati');
    }

    initializeEnhancedTables() {
        console.log('🔧 Inizializzazione Enhanced Tables...');
        
        // Verifica che la classe EnhancedTableManager sia disponibile
        if (typeof EnhancedTableManager === 'undefined') {
            console.error('❌ EnhancedTableManager non disponibile! Assicurati che enhacedTableManager.js sia caricato.');
            return;
        }
        
        // Inizializza solo se gli elementi esistono
        const zonesTable = document.getElementById('zonesTable');
        if (zonesTable) {
            console.log('✅ Inizializzazione tabella zone...');
            this.zonesTableManager = new EnhancedTableManager('zonesTable', {
                pageSize: 25,
                defaultSort: 'strength_score'
            });
            console.log('✅ ZonesTableManager creato');
        } else {
            console.warn('⚠️ Elemento zonesTable non trovato');
        }
        
        const levelsTable = document.getElementById('levelsTable');
        if (levelsTable) {
            console.log('✅ Inizializzazione tabella livelli...');
            this.levelsTableManager = new EnhancedTableManager('levelsTable', {
                pageSize: 25,
                defaultSort: 'strength'
            });
            console.log('✅ LevelsTableManager creato');
        } else {
            console.warn('⚠️ Elemento levelsTable non trovato');
        }
    }

    // Funzione per creare la leggenda interattiva delle zone
    createZoneLegend(zoneLegendData) {
        let legendContainer = document.getElementById('zone-legend-container');
        
        if (!legendContainer) {
            // Crea il container se non esiste
            const container = document.createElement('div');
            container.id = 'zone-legend-container';
            container.className = 'zone-legend-panel';
            container.style.cssText = `
                position: fixed;
                top: 100px;
                right: 20px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border: 1px solid #ddd;
                border-radius: 12px;
                padding: 15px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                max-height: 400px;
                overflow-y: auto;
                z-index: 1000;
                min-width: 200px;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(container);
            legendContainer = container;
        }
        
        if (!zoneLegendData || zoneLegendData.length === 0) {
            legendContainer.style.display = 'none';
            return;
        }
        
        legendContainer.style.display = 'block';
        
        // Separa zone per tipo
        const demandZones = zoneLegendData.filter(z => z.type === 'Demand');
        const supplyZones = zoneLegendData.filter(z => z.type === 'Supply');
        
        legendContainer.innerHTML = `
            <div class="legend-header">
                <h6>🎯 Zone Skorupinski</h6>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.toggleAllZones()">
                    Toggle All
                </button>
            </div>
            
            ${demandZones.length > 0 ? `
            <div class="legend-section">
                <h6 class="text-success">🟢 Zone Demand</h6>
                ${demandZones.map(zone => `
                    <div class="legend-item" data-zone-id="${zone.id}">
                        <label class="form-check-label d-flex align-items-center">
                            <input type="checkbox" 
                                class="form-check-input me-2 zone-checkbox" 
                                data-zone-id="${zone.id}"
                                ${zone.visible ? 'checked' : ''}>
                            <span class="zone-price">$${zone.center.toFixed(2)}</span>
                            ${zone.strength ? `<small class="ms-2 text-muted">(${zone.strength.toFixed(1)})</small>` : ''}
                        </label>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${supplyZones.length > 0 ? `
            <div class="legend-section">
                <h6 class="text-danger">🔴 Zone Supply</h6>
                ${supplyZones.map(zone => `
                    <div class="legend-item" data-zone-id="${zone.id}">
                        <label class="form-check-label d-flex align-items-center">
                            <input type="checkbox" 
                                class="form-check-input me-2 zone-checkbox" 
                                data-zone-id="${zone.id}"
                                ${zone.visible ? 'checked' : ''}>
                            <span class="zone-price">$${zone.center.toFixed(2)}</span>
                            ${zone.strength ? `<small class="ms-2 text-muted">(${zone.strength.toFixed(1)})</small>` : ''}
                        </label>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        `;
    
        // Aggiungi event listeners per le checkbox
        const checkboxes = legendContainer.querySelectorAll('.zone-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const zoneId = this.getAttribute('data-zone-id');
                const isVisible = this.checked;
                window.toggleZoneVisibility(zoneId, isVisible);
            });
        });
        
        console.log(`🎯 Leggenda creata con ${zoneLegendData.length} zone`);
    }

    // Funzione per mostrare/nascondere una singola zona
    toggleZoneVisibility(zoneId, isVisible) {
        const chartDiv = document.getElementById('technicalChart');
        if (!chartDiv || !chartDiv.data || !chartDiv.layout) {
            console.warn('Grafico non trovato per toggle zona');
            return;
        }
        
        try {
            // Trova le shapes (rettangoli delle zone) corrispondenti al zone_id
            const updatedShapes = chartDiv.layout.shapes.map(shape => {
                if (shape.name && shape.name.includes(zoneId.replace('_', '_zone_'))) {
                    return {
                        ...shape,
                        visible: isVisible
                    };
                }
                return shape;
            });
            
            // Trova le annotations (etichette) corrispondenti
            const updatedAnnotations = chartDiv.layout.annotations.map(annotation => {
                if (annotation.text && (
                    (zoneId.includes('demand') && annotation.text.includes('Demand')) ||
                    (zoneId.includes('supply') && annotation.text.includes('Supply'))
                )) {
                    return {
                        ...annotation,
                        visible: isVisible
                    };
                }
                return annotation;
            });
            
            // Aggiorna il layout del grafico
            Plotly.relayout(chartDiv, {
                shapes: updatedShapes,
                annotations: updatedAnnotations
            });
            
            console.log(`🎯 Zona ${zoneId} ${isVisible ? 'mostrata' : 'nascosta'}`);
            
        } catch (error) {
            console.error('Errore toggle zona:', error);
        }
    }

    async loadInitialData() {
        try {
            console.log('🔄 Caricamento dati iniziali...');
            
            // Carica il summary (gestisce i suoi errori internamente)
            await this.refreshSummary();
            
            // Inizializza dropdown ticker (gestisce i suoi errori internamente)
            await this.initializeTickerDropdown();
            
            // Inizializza dropdown giorni
            this.initializeDaysDropdown();
            
            this.showLog('✅ Inizializzazione completata', 'success');
            
        } catch (error) {
            console.error('❌ Errore caricamento dati iniziali:', error);
            this.showLog(`❌ Errore inizializzazione: ${error.message}`, 'error');
        }
    }

    async loadOverviewData() {
        try {
            console.log('📊 Caricamento dati overview...');
            
            // Carica il summary per le card statistiche
            await this.refreshSummary();
            
            // Aggiorna le informazioni della fonte dati
            this.updateDataSourceUI(this.currentDataSource);
            
            this.showLog('✅ Dati overview caricati', 'success');
            
        } catch (error) {
            console.error('❌ Errore caricamento overview:', error);
            this.showLog(`❌ Errore overview: ${error.message}`, 'error');
        }
    }

    async initializeTickerDropdown() {
        try {
            const tickerSelect = document.getElementById('chartTickerSelect');
            if (!tickerSelect) {
                console.log('ℹ️ Elemento chartTickerSelect non trovato - skip inizializzazione dropdown');
                return;
            }

            console.log('🔄 Inizializzazione dropdown ticker...');
            
            const response = await fetch('/api/tickers');
            if (response.ok) {
                const data = await response.json();
                console.log('📊 Risposta /api/tickers:', data);
                
                // Estrai l'array tickers dalla risposta
                const tickers = data.tickers || data || [];
                
                // Verifica che sia un array
                if (!Array.isArray(tickers)) {
                    console.error('❌ Risposta tickers non è un array:', typeof tickers, tickers);
                    return;
                }
                
                // Pulisci dropdown esistente
                tickerSelect.innerHTML = '<option value="">Seleziona ticker...</option>';
                
                // Aggiungi opzioni
                tickers.forEach(ticker => {
                    const option = document.createElement('option');
                    option.value = ticker;
                    option.textContent = ticker;
                    tickerSelect.appendChild(option);
                });
                
                console.log(`✅ Dropdown ticker inizializzato con ${tickers.length} opzioni`);
            } else {
                console.error(`❌ Errore HTTP ${response.status} nel recuperare tickers`);
            }
        } catch (error) {
            console.error('❌ Errore inizializzazione dropdown ticker:', error);
            
            // Fallback: crea dropdown vuoto ma funzionale
            const tickerSelect = document.getElementById('chartTickerSelect');
            if (tickerSelect) {
                tickerSelect.innerHTML = '<option value="">Nessun ticker disponibile</option>';
            }
        }
    }

    initializeDaysDropdown() {
        const daysSelect = document.getElementById('daysSelect') || document.getElementById('chartDaysSelect');
        
        if (!daysSelect) {
            console.warn('⚠️ Dropdown giorni non trovato');
            return;
        }
        
        // Opzioni disponibili
        const daysOptions = [
            { value: '100 giorni', text: '100 giorni', selected: true },
            { value: '6 mesi', text: '6 mesi (180 giorni)' },
            { value: '1 anno', text: '1 anno (365 giorni)' },
            { value: '2 anni', text: '2 anni (730 giorni)' },
            { value: '3 anni', text: '3 anni (1095 giorni)' },
            { value: '5 anni', text: '5 anni (1825 giorni)' },
            { value: '10 anni', text: '10 anni (3650 giorni)' }
        ];
        
        // Pulisci dropdown esistente
        daysSelect.innerHTML = '';
        
        // Aggiungi opzioni
        daysOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            if (option.selected) {
                optionElement.selected = true;
            }
            daysSelect.appendChild(optionElement);
        });
        
        console.log(`✅ Dropdown giorni inizializzato con ${daysOptions.length} opzioni`);
    }

    convertDaysSelection(selection) {
        const selectionLower = selection.toLowerCase();
        
        // Mappa le selezioni ai giorni effettivi
        const daysMap = {
            '100 giorni': 100,
            '6 mesi': 180,
            '1 anno': 365,
            '2 anni': 730,
            '3 anni': 1095,
            '5 anni': 1825,
            '10 anni': 3650
        };
        
        // Cerca corrispondenza esatta
        for (const [key, days] of Object.entries(daysMap)) {
            if (selectionLower.includes(key.toLowerCase()) || selectionLower === key.toLowerCase()) {
                console.log(`📅 Selezione "${selection}" convertita in ${days} giorni`);
                return days;
            }
        }
        
        // Cerca pattern numerici (es. "365", "100 giorni", ecc.)
        const numberMatch = selection.match(/(\d+)/);
        if (numberMatch) {
            const number = parseInt(numberMatch[1]);
            console.log(`📅 Estratto numero ${number} da "${selection}"`);
            return number;
        }
        
        // Fallback
        console.warn(`⚠️ Selezione giorni non riconosciuta: "${selection}", usando 100 giorni`);
        return 100;
    }

    async setDataSource(source) {
        try {
            this.showLog(`🔄 Cambio fonte dati: ${source.toUpperCase()}...`, 'info');

            const response = await fetch('/api/technical-analysis/set-data-source', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    use_adjusted: source === 'adjusted'
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.currentDataSource = source;
                this.updateDataSourceUI(source);
                this.showLog(`✅ ${result.message}`, 'success');
                
                // Ricarica il grafico se presente
                const currentTicker = document.getElementById('chartTickerSelect')?.value;
                if (currentTicker) {
                    this.loadChart(currentTicker);
                }
            } else {
                throw new Error(result.message || 'Errore sconosciuto');
            }

        } catch (error) {
            console.error('❌ Errore cambio fonte dati:', error);
            this.showLog(`❌ Errore cambio fonte dati: ${error.message}`, 'error');
        }
    }

    updateDataSourceUI(source) {
        const sourceElement = document.getElementById('currentDataSource');
        const descriptionElement = document.getElementById('dataSourceDescription');

        if (sourceElement) {
            if (source === 'adjusted') {
                sourceElement.textContent = 'ADJUSTED';
                if (descriptionElement) {
                    descriptionElement.textContent = 'Prezzi aggiustati per splits e dividendi (raccomandato per analisi tecnica)';
                }
            } else {
                sourceElement.textContent = 'NOT ADJUSTED';
                if (descriptionElement) {
                    descriptionElement.textContent = 'Prezzi originali senza aggiustamenti';
                }
            }
        }
    }

    async runAnalysis(type = 'both') {
        try {
            const btn = document.getElementById('runAnalysisBtn');
            const originalText = btn?.innerHTML;
            
            if (btn) {
                btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Elaborazione...';
                btn.disabled = true;
            }

            this.showLog(`🚀 Avvio analisi tecnica (${type})...`, 'info');

            const response = await fetch('/api/technical-analysis/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    analysis_type: type,
                    use_adjusted: this.currentDataSource === 'adjusted'
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showLog(`✅ ${result.message}`, 'success');
                
                // Mostra risultati dettagliati
                if (result.results) {
                    this.logAnalysisResults(result.results);
                }

                // Aggiorna summary
                await this.refreshSummary();

                // Ricarica tabelle se visibili
                this.loadZonesTable();
                this.loadLevelsTable();

            } else {
                throw new Error(result.message || 'Errore sconosciuto');
            }

        } catch (error) {
            console.error('❌ Errore analisi:', error);
            this.showLog(`❌ Errore analisi: ${error.message}`, 'error');
        } finally {
            const btn = document.getElementById('runAnalysisBtn');
            if (btn) {
                btn.innerHTML = '<i class="bi bi-play-circle me-1"></i>Esegui Analisi';
                btn.disabled = false;
            }
        }
    }

    logAnalysisResults(results) {
        if (results.support_resistance) {
            const srResults = results.support_resistance;
            const successful = Object.values(srResults).filter(v => v === true).length;
            const total = Object.keys(srResults).length;
            this.showLog(`📏 Supporti/Resistenze: ${successful}/${total} ticker elaborati`, 'success');
        }

        if (results.skorupinski_zones) {
            const szResults = results.skorupinski_zones;
            const successful = Object.values(szResults).filter(v => v === true).length;
            const total = Object.keys(szResults).length;
            this.showLog(`🎯 Zone Skorupinski: ${successful}/${total} ticker elaborati`, 'success');
        }
    }

    async refreshSummary() {
        try {
            console.log('🔄 Caricamento summary...');
            
            const response = await fetch('/api/technical-analysis/summary');
            
            if (!response.ok) {
                if (response.status === 500) {
                    console.warn('⚠️ Endpoint /api/technical-analysis/summary non implementato (500)');
                    this.setFallbackSummaryValues();
                    this.showLog('⚠️ Endpoint summary non implementato - usando valori fallback', 'warning');
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const summary = await response.json();
            console.log('📊 Summary ricevuto:', summary);

            // Aggiorna le card statistiche con controlli di esistenza
            const totalAnalyzedElement = document.getElementById('totalAnalyzedTickers');
            if (totalAnalyzedElement) {
                const srAnalyzed = summary.support_resistance?.analyzed || 0;
                const szAnalyzed = summary.skorupinski_zones?.analyzed || 0;
                const totalAnalyzed = srAnalyzed + szAnalyzed;
                totalAnalyzedElement.textContent = totalAnalyzed;
                console.log(`📊 Total analyzed: ${totalAnalyzed} (SR: ${srAnalyzed}, SZ: ${szAnalyzed})`);
            }
            
            const totalSRElement = document.getElementById('totalSRLevels');
            if (totalSRElement) {
                const totalSR = summary.support_resistance?.total_levels || 0;
                totalSRElement.textContent = totalSR;
                console.log(`📏 Total S/R levels: ${totalSR}`);
            }
            
            const totalSupplyElement = document.getElementById('totalSupplyZones');
            if (totalSupplyElement) {
                const totalSupply = summary.skorupinski_zones?.supply_zones || 0;
                totalSupplyElement.textContent = totalSupply;
                console.log(`🔴 Total supply zones: ${totalSupply}`);
            }
            
            const totalDemandElement = document.getElementById('totalDemandZones');
            if (totalDemandElement) {
                const totalDemand = summary.skorupinski_zones?.demand_zones || 0;
                totalDemandElement.textContent = totalDemand;
                console.log(`🟢 Total demand zones: ${totalDemand}`);
            }

            console.log('✅ Summary aggiornato con successo');

        } catch (error) {
            console.error('❌ Errore refresh summary:', error);
            
            if (error.message.includes('500') || error.message.includes('INTERNAL SERVER ERROR')) {
                this.setFallbackSummaryValues();
                this.showLog('⚠️ Endpoint summary non implementato - usando valori fallback', 'warning');
            } else {
                this.showLog(`❌ Errore aggiornamento statistiche: ${error.message}`, 'error');
                this.setFallbackSummaryValues();
            }
        }
    }

    setFallbackSummaryValues() {
        // Imposta valori di fallback informativi
        const elements = [
            'totalAnalyzedTickers',
            'totalSRLevels', 
            'totalSupplyZones',
            'totalDemandZones'
        ];

        elements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = 'N/A';
                element.title = 'Endpoint API non implementato - aggiungi gli endpoint Flask al backend';
                element.style.color = '#6c757d';
            }
        });

        console.log('📊 Valori summary impostati su fallback (endpoint mancanti)');
    }

    // METODO PRINCIPALE AGGIORNATO per loadChart con leggenda
    async loadChart(ticker) {
        this.showChartLoading(true);
        
        try {
            console.log(`📊 Caricamento grafico Plotly per ${ticker}...`);
            
            // Leggi lo stato delle checkbox E i giorni dal dropdown
            const showSRCheckbox = document.getElementById('showSRLevels');
            const showZonesCheckbox = document.getElementById('showZones');
            const daysSelect = document.getElementById('daysSelect') || document.getElementById('chartDaysSelect');
            
            const showSR = showSRCheckbox ? showSRCheckbox.checked : true;
            const showZones = showZonesCheckbox ? showZonesCheckbox.checked : true;
            
            // Converti la selezione giorni in numero effettivo
            const selectedDays = this.convertDaysSelection(daysSelect?.value || '100 giorni');
            
            console.log(`🔧 Stato: S&R: ${showSR}, Zone: ${showZones}, Giorni: ${selectedDays}`);
            
            // Chiama l'API con i giorni corretti
            const response = await fetch(`/api/technical-analysis/chart-plotly/${ticker}?days=${selectedDays}&include_analysis=true`);
            
            if (!response.ok) {
                throw new Error(`Errore API: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Filtra i dati in base allo stato delle checkbox
            const filteredData = this.filterChartDataByCheckboxes(data, showSR, showZones);
            
            // Renderizza con Plotly
            await this.renderPlotlyChart(filteredData);
            
            // NUOVO: Crea la leggenda se ci sono dati delle zone
            if (data && data.zone_legend) {
                console.log('📊 Creazione leggenda zone:', data.zone_legend);
                this.createZoneLegend(data.zone_legend);
                
                // Aggiorna i contatori zone
                if (typeof window.updateZoneCounts === 'function') {
                    window.updateZoneCounts(data.zone_legend);
                }
            } else {
                console.log('⚠️ Nessun dato zone_legend ricevuto');
                // Nasconde la leggenda se non ci sono zone
                const legendContainer = document.getElementById('zone-legend-container');
                if (legendContainer) {
                    legendContainer.style.display = 'none';
                }
                
                // Reset contatori
                if (typeof window.updateZoneCounts === 'function') {
                    window.updateZoneCounts([]);
                }
            }
            
            // Aggiorna info grafico
            this.updateChartInfo(filteredData.data_info || data.data_info);
            
            this.showLog(`✅ Grafico ${ticker} caricato (${selectedDays} giorni, S&R: ${showSR}, Zone: ${showZones})`, 'success');
            
        } catch (error) {
            console.error('❌ Errore caricamento grafico:', error);
            this.showLog(`❌ Errore grafico: ${error.message}`, 'error');
            this.showPlotlyError(ticker, error.message);
        } finally {
            this.showChartLoading(false);
        }
    }

    // Funzione helper per estrarre dati delle zone dal grafico esistente
    extractZoneDataFromChart(chartDiv) {
        const zoneLegendData = [];
        
        if (chartDiv.layout && chartDiv.layout.shapes) {
            chartDiv.layout.shapes.forEach((shape, index) => {
                if (shape.type === 'rect' && shape.fillcolor) {
                    let type = 'Unknown';
                    let color = shape.line?.color || shape.fillcolor;
                    
                    if (shape.fillcolor.includes('rgba(40, 167, 69')) {
                        type = 'Demand';
                    } else if (shape.fillcolor.includes('rgba(220, 53, 69')) {
                        type = 'Supply';
                    }
                    
                    if (type !== 'Unknown') {
                        const center = (shape.y0 + shape.y1) / 2;
                        zoneLegendData.push({
                            id: `${type.toLowerCase()}_${index}`,
                            type: type,
                            center: center,
                            label: `${type} $${center.toFixed(2)}`,
                            visible: shape.visible !== false,
                            color: color
                        });
                    }
                }
            });
        }
        
        return zoneLegendData;
    }
    
    filterChartDataByCheckboxes(data, showSR, showZones) {
        try {
            // Parse del JSON del grafico
            const figure = JSON.parse(data.chart_json);
            
            // Filtra i traces in base alle checkbox
            const filteredTraces = figure.data.filter(trace => {
                // Mantieni sempre il trace principale (candlestick)
                if (trace.type === 'candlestick') {
                    return true;
                }
                
                // Mantieni sempre il volume se presente
                if (trace.name && trace.name.toLowerCase().includes('volume')) {
                    return true;
                }
                
                // FILTRAGGIO per supporti e resistenze
                if (trace.name) {
                    const traceName = trace.name.toLowerCase();
                    
                    if (traceName.includes('support') || traceName.includes('resistance') || 
                        traceName.includes('supporto') || traceName.includes('resistenza') ||
                        traceName.includes('livello') || traceName.includes('level') ||
                        traceName.match(/\d+\.\d+/) !== null) {
                        console.log(`${showSR ? '✅ Mantieni' : '❌ Rimuovi'} S&R trace: ${trace.name}`);
                        return showSR;
                    }
                    
                    if (traceName.includes('demand') || traceName.includes('supply') ||
                        traceName.includes('domanda') || traceName.includes('offerta') ||
                        traceName.includes('zona')) {
                        console.log(`${showZones ? '✅ Mantieni' : '❌ Rimuovi'} zona trace: ${trace.name}`);
                        return showZones;
                    }
                }
                
                // Mantieni altri traces per sicurezza
                return true;
            });
            
            // Filtra le shapes nel layout
            let filteredShapes = [];
            if (figure.layout.shapes) {
                filteredShapes = figure.layout.shapes.filter(shape => {
                    // Zone Skorupinski: shapes rettangolari con colori specifici
                    if (shape.type === 'rect' && 
                        (shape.fillcolor?.includes('rgba(40, 167, 69') || 
                         shape.fillcolor?.includes('rgba(220, 53, 69'))) {
                        console.log(`${showZones ? '✅ Mantieni' : '❌ Rimuovi'} zona Skorupinski shape`);
                        return showZones;
                    }
                    
                    // Supporti/Resistenze: linee orizzontali
                    if (shape.type === 'line') {
                        const isHorizontalLine = shape.y0 === shape.y1;
                        const srColors = ['red', 'green', 'blue', '#dc3545', '#28a745', '#007bff'];
                        const hasSRColor = shape.line?.color && 
                            srColors.some(color => shape.line.color.includes(color));
                        const isDashed = shape.line?.dash === 'dash' || 
                            shape.line?.dash === 'dashdot' ||
                            (Array.isArray(shape.line?.dash) && shape.line.dash.length > 0);
                        
                        if (isHorizontalLine && (hasSRColor || isDashed)) {
                            console.log(`${showSR ? '✅ Mantieni' : '❌ Rimuovi'} S&R shape line (${shape.y0})`);
                            return showSR;
                        }
                    }
                    
                    return true;
                });
            }

            // Filtra le annotations (etichette di testo)
            let filteredAnnotations = [];
            if (figure.layout.annotations) {
                filteredAnnotations = figure.layout.annotations.filter(annotation => {
                    const annotationText = annotation.text || '';
                    
                    if (annotationText.includes('Support') || annotationText.includes('Resistance') || 
                        annotationText.includes('Supporto') || annotationText.includes('Resistenza')) {
                        console.log(`${showSR ? '✅ Mantieni' : '❌ Rimuovi'} etichetta S&R: ${annotationText}`);
                        return showSR;
                    }
                    
                    if (annotationText.includes('Demand') || annotationText.includes('Supply') ||
                        annotationText.includes('Domanda') || annotationText.includes('Offerta') ||
                        annotationText.includes('Zone')) {
                        console.log(`${showZones ? '✅ Mantieni' : '❌ Rimuovi'} etichetta zona: ${annotationText}`);
                        return showZones;
                    }
                    
                    return true;
                });
            }
            
            // Crea il nuovo figure filtrato
            const filteredFigure = {
                data: filteredTraces,
                layout: {
                    ...figure.layout,
                    shapes: filteredShapes,
                    annotations: filteredAnnotations
                }
            };
            
            return {
                ...data,
                chart_json: JSON.stringify(filteredFigure)
            };
            
        } catch (error) {
            console.error('❌ Errore filtraggio dati:', error);
            return data;
        }
    }

    refreshChart() {
        const tickerSelect = document.getElementById('chartTickerSelect');
        if (tickerSelect && tickerSelect.value) {
            console.log('🔄 Refresh forzato del grafico...');
            this.loadChart(tickerSelect.value);
        } else {
            console.log('⚠️ Nessun ticker selezionato per il refresh');
        }
    }

    async renderPlotlyChart(data) {
        const chartDiv = document.getElementById('technicalChart');
        
        if (!chartDiv) {
            throw new Error('Elemento technicalChart non trovato');
        }
        
        if (typeof Plotly === 'undefined') {
            throw new Error('Plotly.js non disponibile');
        }
        
        try {
            const figure = JSON.parse(data.chart_json);
            await Plotly.newPlot(chartDiv, figure.data, figure.layout, data.chart_config);
            console.log('✅ Grafico Plotly renderizzato con successo');
        } catch (error) {
            console.error('❌ Errore rendering Plotly:', error);
            throw error;
        }
    }

    showChartLoading(show) {
        const loading = document.getElementById('chartLoading');
        const container = document.getElementById('chartContainer');
        const info = document.getElementById('chartInfo');

        if (show) {
            loading?.classList.remove('d-none');
            container?.classList.add('d-none');
            info?.classList.add('d-none');
        } else {
            loading?.classList.add('d-none');
            container?.classList.remove('d-none');
            info?.classList.remove('d-none');
        }
    }

    showPlotlyError(ticker, errorMessage) {
        const chartDiv = document.getElementById('technicalChart');
        if (!chartDiv) return;
        
        chartDiv.innerHTML = '';
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger text-center';
        errorDiv.innerHTML = `
            <h5><i class="bi bi-exclamation-triangle"></i> Errore Grafico ${ticker}</h5>
            <p class="mb-0">${errorMessage}</p>
            <small class="text-muted">Controlla la console per maggiori dettagli</small>
        `;
        
        chartDiv.appendChild(errorDiv);
    }

    updateChartInfo(dataInfo, fullData = null) {
        const chartInfoDiv = document.getElementById('chartInfo');
        if (chartInfoDiv) {
            const totalZones = (dataInfo.demand_zones || 0) + (dataInfo.supply_zones || 0);
            
            chartInfoDiv.innerHTML = `
                <div class="row g-2">
                    <div class="col-md-3">
                        <small class="text-muted">📊 Ticker:</small><br>
                        <strong>${dataInfo.ticker}</strong>
                    </div>
                    <div class="col-md-3">
                        <small class="text-muted">📈 Punti dati:</small><br>
                        <strong>${dataInfo.data_points}</strong>
                    </div>
                    <div class="col-md-3">
                        <small class="text-muted">📏 Livelli S&R:</small><br>
                        <strong>${dataInfo.sr_levels || 0}</strong>
                    </div>
                    <div class="col-md-3">
                        <small class="text-muted">🎯 Zone:</small><br>
                        <strong>${totalZones}</strong>
                        <small>(${dataInfo.demand_zones || 0}D/${dataInfo.supply_zones || 0}S)</small>
                    </div>
                </div>
                <div class="row g-2 mt-2">
                    <div class="col-md-4">
                        <small class="text-muted">📅 Primo:</small>
                        <span class="ms-1">${dataInfo.first_date || 'N/A'}</span>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted">📅 Ultimo:</small>
                        <span class="ms-1">${dataInfo.last_date || 'N/A'}</span>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted">📊 Volume:</small>
                        <span class="ms-1">${dataInfo.has_volume ? '✅ Sì' : '❌ No'}</span>
                    </div>
                </div>
            `;
        }
    }

    async loadZonesTable() {
        try {
            console.log('📊 Caricamento tabella zone Skorupinski...');
            
            if (!this.zonesTableManager && document.getElementById('zonesTable')) {
                console.log('🔧 Inizializzazione tardiva zonesTableManager...');
                this.initializeEnhancedTables();
            }
            
            const response = await fetch('/api/technical-analysis/zones');
            
            if (!response.ok) {
                if (response.status === 500) {
                    console.warn('⚠️ Endpoint /api/technical-analysis/zones non implementato (500)');
                    this.showZonesFallback();
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📊 Dati zone ricevuti:', data);
            
            if (this.zonesTableManager) {
                console.log('✅ Usando EnhancedTableManager per zone');
                this.zonesTableManager.setData(data.zones || []);
            } else {
                console.log('⚠️ Fallback a populateZonesTable standard');
                this.populateZonesTable(data.zones || []);
            }
            
        } catch (error) {
            console.error('❌ Errore caricamento tabella zone:', error);
            this.showError(`Errore caricamento zone: ${error.message}`);
        }
    }
    
    async loadLevelsTable() {
        try {
            console.log('📏 Caricamento tabella supporti/resistenze...');
            
            if (!this.levelsTableManager && document.getElementById('levelsTable')) {
                console.log('🔧 Inizializzazione tardiva levelsTableManager...');
                this.initializeEnhancedTables();
            }
            
            const response = await fetch('/api/technical-analysis/levels');
            
            if (!response.ok) {
                if (response.status === 500) {
                    console.warn('⚠️ Endpoint /api/technical-analysis/levels non implementato (500)');
                    this.showLevelsFallback();
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📏 Dati livelli ricevuti:', data);
            
            if (this.levelsTableManager) {
                console.log('✅ Usando EnhancedTableManager per livelli');
                this.levelsTableManager.setData(data.levels || []);
            } else {
                console.log('⚠️ Fallback a populateLevelsTable standard');
                this.populateLevelsTable(data.levels || []);
            }
            
        } catch (error) {
            console.error('❌ Errore caricamento tabella livelli:', error);
            this.showError(`Errore caricamento livelli: ${error.message}`);
        }
    }

    showZonesFallback() {
        const tbody = document.getElementById('zonesTableBody');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-4">
                    <div class="alert alert-warning mb-0">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        <strong>Endpoint API non implementato</strong><br>
                        <small class="text-muted">
                            L'endpoint <code>/api/technical-analysis/zones</code> non è disponibile nel backend.
                        </small>
                    </div>
                </td>
            </tr>
        `;
    }

    showLevelsFallback() {
        const tbody = document.getElementById('levelsTableBody');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="alert alert-warning mb-0">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        <strong>Endpoint API non implementato</strong><br>
                        <small class="text-muted">
                            L'endpoint <code>/api/technical-analysis/levels</code> non è disponibile nel backend.
                        </small>
                    </div>
                </td>
            </tr>
        `;
    }

    populateZonesTable(zones) {
        const tbody = document.getElementById('zonesTableBody');
        if (!tbody) return;

        if (zones.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center text-muted py-4">
                        <i class="bi bi-info-circle me-2"></i>Nessuna zona Skorupinski trovata
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = zones.map(zone => `
            <tr class="${zone.type === 'Supply' ? 'table-danger' : 'table-success'}">
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
    }

    populateLevelsTable(levels) {
        const tbody = document.getElementById('levelsTableBody');
        if (!tbody) return;

        if (levels.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                        <i class="bi bi-info-circle me-2"></i>Nessun livello trovato
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = levels.map(level => `
            <tr class="${level.type === 'Resistance' ? 'table-warning' : 'table-info'}">
            <td><span class="badge ${level.type === 'Resistance' ? 'bg-warning text-dark' : 'bg-info'}">${level.ticker}</span></td>
            <td class="small">${this.formatDate(level.date)}</td>
            <td><i class="bi ${level.type === 'Resistance' ? 'bi-arrow-up text-warning' : 'bi-arrow-down text-info'}"></i> ${level.type}</td>
            <td class="font-monospace">${level.level?.toFixed(4) || 'N/A'}</td>
            <td><small class="text-muted">${level.strength?.toFixed(1) || 'N/A'}</small></td>
            <td class="small">${level.touches || 0} volte</td>
            <td class="small">${level.days_from_end || 'N/A'} giorni</td>
            <td><button class="btn btn-outline-primary btn-sm" onclick="window.taManager?.loadChart('${level.ticker}')"><i class="bi bi-eye"></i></button></td>
            </tr>
        `).join('');
    }

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

    showError(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show';
        alertDiv.innerHTML = `
            <i class="bi bi-exclamation-triangle me-2"></i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        const container = document.querySelector('.container-fluid') || document.body;
        container.insertBefore(alertDiv, container.firstChild);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }

    onTabChanged(target) {
        console.log(`🔄 Cambio tab: ${target}`);
        
        switch (target) {
            case '#chart':
                break;
            case '#zones':
                if (!this.zonesTableManager && document.getElementById('zonesTable')) {
                    this.initializeEnhancedTables();
                }
                this.loadZonesTable();
                break;
            case '#levels':
                if (!this.levelsTableManager && document.getElementById('levelsTable')) {
                    this.initializeEnhancedTables();
                }
                this.loadLevelsTable();
                break;
        }
    }

    async exportAnalysisResults() {
        try {
            this.showLog('📤 Preparazione export risultati...', 'info');

            const summary = await fetch('/api/technical-analysis/summary').then(r => r.json());
            
            const exportData = {
                timestamp: new Date().toISOString(),
                data_source: this.currentDataSource,
                summary: summary,
                export_info: {
                    version: '1.0',
                    exported_by: 'Technical Analysis Manager'
                }
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `technical_analysis_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.showLog('✅ Export completato!', 'success');

        } catch (error) {
            console.error('❌ Errore export:', error);
            this.showLog(`❌ Errore export: ${error.message}`, 'error');
        }
    }

    showLog(message, type = 'info') {
        const logDiv = document.getElementById('analysisLog');
        if (!logDiv) return;

        if (logDiv.children.length === 1 && logDiv.querySelector('.text-center')) {
            logDiv.innerHTML = '';
        }

        const timestamp = new Date().toLocaleTimeString('it-IT');
        const entry = document.createElement('div');
        entry.className = `log-entry mb-2 p-2 border-start border-3 border-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'}`;
        entry.style.cssText = `
            background-color: #f8f9fa;
            border-radius: 0.25rem;
            animation: fadeInDown 0.3s ease-out;
        `;
        entry.innerHTML = `
            <div class="d-flex justify-content-between">
                <span>${message}</span>
                <small class="text-muted">${timestamp}</small>
            </div>
        `;

        logDiv.appendChild(entry);
        logDiv.scrollTop = logDiv.scrollHeight;

        while (logDiv.children.length > 50) {
            logDiv.removeChild(logDiv.firstChild);
        }
    }
}

// ===== FUNZIONI GLOBALI PER LA LEGGENDA =====

// Rendi le funzioni globali per l'accesso dai controlli HTML
window.toggleZoneVisibility = function(zoneId, isVisible) {
    if (window.taManager && typeof window.taManager.toggleZoneVisibility === 'function') {
        window.taManager.toggleZoneVisibility(zoneId, isVisible);
    }
};

window.toggleAllZones = function() {
    const checkboxes = document.querySelectorAll('#zone-legend-container .zone-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    // Se tutte sono selezionate, deseleziona tutte. Altrimenti seleziona tutte.
    const newState = !allChecked;
    
    checkboxes.forEach(checkbox => {
        if (checkbox.checked !== newState) {
            checkbox.checked = newState;
            const zoneId = checkbox.getAttribute('data-zone-id');
            window.toggleZoneVisibility(zoneId, newState);
        }
    });
};

// Funzione per aggiornare i contatori zone (definita globalmente)
window.updateZoneCounts = function(zoneLegendData) {
    if (!zoneLegendData) return;
    
    const demandCount = zoneLegendData.filter(z => z.type === 'Demand').length;
    const supplyCount = zoneLegendData.filter(z => z.type === 'Supply').length;
    const totalCount = demandCount + supplyCount;
    
    const demandCountEl = document.getElementById('demandZoneCount');
    const supplyCountEl = document.getElementById('supplyZoneCount');
    const totalCountEl = document.getElementById('totalZoneCount');
    
    if (demandCountEl) demandCountEl.textContent = demandCount;
    if (supplyCountEl) supplyCountEl.textContent = supplyCount;
    if (totalCountEl) totalCountEl.textContent = totalCount;
};

// ===== INIZIALIZZAZIONE =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 DOM loaded - Inizializzazione Technical Analysis...');
    
    if (document.getElementById('analysisNavTabs')) {
        console.log('✅ Pagina Technical Analysis rilevata');
        
        // Crea istanza manager UNICA
        window.taManager = new TechnicalAnalysisManager();
        window.TechnicalAnalysisInstance = window.taManager; // Alias per compatibilità
        
        setTimeout(() => {
            console.log('🕐 Inizializzazione delayed enhanced tables...');
            if (window.taManager) {
                window.taManager.initializeEnhancedTables();
            }
        }, 500);
        
        console.log('✅ Technical Analysis Manager inizializzato completamente');
    } else {
        console.log('ℹ️ Pagina Technical Analysis non rilevata - inizializzazione saltata');
    }
});

// ===== FUNZIONI DEBUG =====
window.debugCheckboxState = function() {
    const showSR = document.getElementById('showSRLevels')?.checked;
    const showZones = document.getElementById('showZones')?.checked;
    const currentTicker = document.getElementById('chartTickerSelect')?.value;
    const daysSelect = document.getElementById('daysSelect') || document.getElementById('chartDaysSelect');
    const currentDays = daysSelect?.value;
    
    console.log('🔍 DEBUG Stato Completo:');
    console.log(`- Supporti/Resistenze: ${showSR}`);
    console.log(`- Zone Skorupinski: ${showZones}`);  
    console.log(`- Ticker corrente: ${currentTicker}`);
    console.log(`- Giorni selezionati: ${currentDays}`);
    console.log(`- taManager disponibile: ${!!window.taManager}`);
    
    if (currentTicker && window.taManager) {
        console.log('🔄 Forzando refresh...');
        window.taManager.loadChart(currentTicker);
    }
};

console.log('✅ Technical Analysis module caricato completamente');
console.log('🧪 Funzioni debug disponibili: debugCheckboxState(), window.toggleAllZones(), window.updateZoneCounts()');
console.log('🎯 Funzioni leggenda: window.toggleZoneVisibility(), window.toggleAllZones()');