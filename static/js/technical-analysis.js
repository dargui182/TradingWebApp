/**
 * technical-analysis.js
 * JavaScript per la gestione dell'analisi tecnica con supporti/resistenze e zone Skorupinski
 * VERSIONE COMPLETA E CORRETTA
 */

class TechnicalAnalysisManager {
    constructor() {
        this.currentDataSource = 'adjusted';
        this.chart = null;
        this.init();
    }

    init() {
        console.log('🔧 Inizializzazione Technical Analysis Manager...');
        this.setupEventListeners();
        this.loadInitialData();
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

    async loadInitialData() {
        try {
            console.log('🔄 Caricamento dati iniziali...');
            
            // Carica il summary (gestisce i suoi errori internamente)
            await this.refreshSummary();
            
            // Inizializza dropdown ticker (gestisce i suoi errori internamente)
            await this.initializeTickerDropdown();
            
            this.showLog('✅ Inizializzazione completata', 'success');
            
        } catch (error) {
            console.error('❌ Errore caricamento dati iniziali:', error);
            this.showLog(`❌ Errore inizializzazione: ${error.message}`, 'error');
            
            // Continua comunque - gli errori specifici sono gestiti dai singoli metodi
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



    // Nuovo metodo per pulire i dati prezzo
    cleanPriceData(priceData) {
        return priceData.map(item => ({
            date: item.date,
            open: this.sanitizeNumber(item.open),
            high: this.sanitizeNumber(item.high), 
            low: this.sanitizeNumber(item.low),
            close: this.sanitizeNumber(item.close),
            volume: this.sanitizeNumber(item.volume, 0)
        })).filter(item => item.close !== null); // Rimuovi record senza prezzo di chiusura
    }

    // Nuovo metodo per pulire dati S&R
    cleanSRData(srData) {
        return srData.map(level => ({
            ...level,
            level: this.sanitizeNumber(level.level),
            strength: this.sanitizeNumber(level.strength, 1)
        })).filter(level => level.level !== null);
    }

    // Nuovo metodo per sanitizzare numeri
    sanitizeNumber(value, defaultValue = null) {
        if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
            return defaultValue;
        }
        return Number(value);
    }

    // Nuovo metodo per mostrare errori nel canvas
    showChartError(ticker, errorMessage) {
        const ctx = document.getElementById('technicalChart');
        if (!ctx) return;

        // Distruggi grafico esistente
        this.destroyExistingChart();

        // Mostra messaggio di errore
        const canvas = ctx;
        const context = canvas.getContext('2d');
        
        // Pulisci canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Stile testo errore
        context.font = '16px Arial';
        context.fillStyle = '#dc3545';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Testo principale
        context.fillText(`Errore caricamento grafico ${ticker}`, canvas.width / 2, canvas.height / 2 - 20);
        
        // Dettagli errore (più piccoli)
        context.font = '12px Arial';
        context.fillStyle = '#6c757d';
        const maxLength = 60;
        const shortError = errorMessage.length > maxLength ? 
            errorMessage.substring(0, maxLength) + '...' : errorMessage;
        context.fillText(shortError, canvas.width / 2, canvas.height / 2 + 10);
        
        // Suggerimento
        context.fillText('Controlla la console per dettagli', canvas.width / 2, canvas.height / 2 + 30);
    }

    loadTickerChart(ticker) {
        // Alias per compatibilità
        return this.loadChart(ticker);
    }

    renderChart(ticker, data, showSR, showZones) {
        // Verifica che Chart.js sia disponibile
        if (typeof Chart === 'undefined') {
            console.error('❌ Chart.js non disponibile');
            this.showLog('❌ Chart.js non caricato', 'error');
            return;
        }

        const ctx = document.getElementById('technicalChart');
        if (!ctx) {
            console.error('❌ Canvas technicalChart non trovato');
            return;
        }

        console.log('🎨 Inizio renderChart per', ticker);

        // Distruggi grafico esistente
        this.destroyExistingChart();

        // Usa setTimeout per assicurarsi che la distruzione sia completa
        setTimeout(() => {
            this.createChart(ticker, data, showSR, showZones);
        }, 200);
    }

// 2. Modifica la funzione createChart per leggere correttamente lo stato delle checkbox
// Sostituisci la funzione esistente con questa versione migliorata:

async createChart(ticker) {
    try {
        console.log(`📈 Creazione grafico per ${ticker}...`);
        
        // Mostra loading
        this.showLoading(true);
        
        // IMPORTANTE: Leggi lo stato attuale delle checkbox
        const showSRCheckbox = document.getElementById('showSRLevels');
        const showZonesCheckbox = document.getElementById('showZones');
        
        const showSR = showSRCheckbox ? showSRCheckbox.checked : true;
        const showZones = showZonesCheckbox ? showZonesCheckbox.checked : true;
        
        console.log(`🔧 Stato checkbox - S&R: ${showSR}, Zone: ${showZones}`);
        
        // Fetch dei dati
        const response = await fetch(`/api/technical-analysis/chart-data/${ticker}?days=100`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.price_data || data.price_data.length === 0) {
            throw new Error('Nessun dato prezzo disponibile');
        }
        
        // IMPORTANTE: Pulisci il container del grafico prima di creare il nuovo grafico
        const chartContainer = document.getElementById('technicalChart');
        if (chartContainer) {
            // Rimuovi completamente il contenuto esistente
            chartContainer.innerHTML = '';
        }
        
        // Prepara i dati per Plotly
        const traces = [];
        const annotations = [];
        
        // Dati del prezzo (candlestick)
        const dates = data.price_data.map(item => item.date);
        const opens = data.price_data.map(item => parseFloat(item.open));
        const highs = data.price_data.map(item => parseFloat(item.high));
        const lows = data.price_data.map(item => parseFloat(item.low));
        const closes = data.price_data.map(item => parseFloat(item.close));
        
        // Trace principale candlestick
        traces.push({
            x: dates,
            open: opens,
            high: highs,
            low: lows,
            close: closes,
            type: 'candlestick',
            name: ticker,
            increasing: { line: { color: '#26a69a' } },
            decreasing: { line: { color: '#ef5350' } }
        });
        
        // Aggiungi supporti e resistenze SOLO se la checkbox è selezionata
        if (showSR && data.support_resistance && data.support_resistance.length > 0) {
            console.log(`✅ Aggiunta di ${data.support_resistance.length} livelli S&R`);
            
            data.support_resistance.forEach((level, index) => {
                const levelValue = parseFloat(level.level || level.price);
                const isSupport = level.type === 'Support';
                const color = isSupport ? '#28a745' : '#dc3545';
                
                // Linea orizzontale per il livello
                traces.push({
                    x: dates,
                    y: new Array(dates.length).fill(levelValue),
                    mode: 'lines',
                    line: {
                        color: color,
                        width: 2,
                        dash: 'dash'
                    },
                    name: `${level.type} ${levelValue.toFixed(2)}`,
                    showlegend: true,
                    hoverinfo: 'name'
                });
            });
        } else if (!showSR) {
            console.log('⚪ Supporti/Resistenze nascosti (checkbox deselezionata)');
        }
        
        // Aggiungi zone Skorupinski SOLO se la checkbox è selezionata
        if (showZones && data.skorupinski_zones) {
            console.log('✅ Aggiunta zone Skorupinski');
            
            const zones = data.skorupinski_zones;
            const shapes = [];
            
            // Zone di domanda (verdi)
            if (zones.demand_zones && zones.demand_zones.length > 0) {
                zones.demand_zones.forEach((zone, index) => {
                    shapes.push({
                        type: 'rect',
                        x0: dates[0],
                        x1: dates[dates.length - 1],
                        y0: parseFloat(zone.zone_bottom),
                        y1: parseFloat(zone.zone_top),
                        fillcolor: 'rgba(40, 167, 69, 0.2)',
                        line: {
                            color: 'rgba(40, 167, 69, 0.8)',
                            width: 1
                        },
                        layer: 'below'
                    });
                });
            }
            
            // Zone di offerta (rosse)
            if (zones.supply_zones && zones.supply_zones.length > 0) {
                zones.supply_zones.forEach((zone, index) => {
                    shapes.push({
                        type: 'rect',
                        x0: dates[0],
                        x1: dates[dates.length - 1],
                        y0: parseFloat(zone.zone_bottom),
                        y1: parseFloat(zone.zone_top),
                        fillcolor: 'rgba(220, 53, 69, 0.2)',
                        line: {
                            color: 'rgba(220, 53, 69, 0.8)',
                            width: 1
                        },
                        layer: 'below'
                    });
                });
            }
            
            // Aggiungi le shapes al layout
            if (shapes.length > 0) {
                data.shapes = shapes;
            }
        } else if (!showZones) {
            console.log('⚪ Zone Skorupinski nascoste (checkbox deselezionata)');
        }
        
        // Layout del grafico
        const layout = {
            title: {
                text: `${ticker} - Analisi Tecnica`,
                font: { size: 16 }
            },
            xaxis: {
                title: 'Data',
                type: 'date',
                rangeslider: { visible: false }
            },
            yaxis: {
                title: 'Prezzo ($)',
                autorange: true
            },
            plot_bgcolor: 'white',
            paper_bgcolor: 'white',
            margin: { t: 50, b: 50, l: 60, r: 60 },
            showlegend: true,
            legend: {
                orientation: 'h',
                y: -0.2
            },
            shapes: data.shapes || [] // Aggiungi le zone come shapes
        };
        
        // Configurazione
        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
            displaylogo: false
        };
        
        // Crea il grafico
        await Plotly.newPlot('technicalChart', traces, layout, config);
        
        console.log('✅ Grafico creato con successo');
        
        // Aggiorna info del grafico
        this.updateChartInfo(ticker, data);
        
    } catch (error) {
        console.error('❌ Errore creazione grafico:', error);
        this.showError('Errore nella creazione del grafico: ' + error.message);
    } finally {
        this.showLoading(false);
    }
}

// Sostituzione del metodo loadChart per leggere stato checkbox
async loadChart(ticker) {
    this.showChartLoading(true);
    
    try {
        console.log(`📊 Caricamento grafico Plotly per ${ticker}...`);
        
        // IMPORTANTE: Leggi lo stato delle checkbox PRIMA di fare la chiamata API
        const showSRCheckbox = document.getElementById('showSRLevels');
        const showZonesCheckbox = document.getElementById('showZones');
        
        const showSR = showSRCheckbox ? showSRCheckbox.checked : true;
        const showZones = showZonesCheckbox ? showZonesCheckbox.checked : true;
        
        console.log(`🔧 Stato checkbox - S&R: ${showSR}, Zone: ${showZones}`);
        
        // Chiama l'API Plotly (che include sempre tutto)
        const response = await fetch(`/api/technical-analysis/chart-plotly/${ticker}?days=100&include_analysis=true`);
        
        if (!response.ok) {
            throw new Error(`Errore API: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // IMPORTANTE: Filtra i dati in base allo stato delle checkbox
        const filteredData = this.filterChartDataByCheckboxes(data, showSR, showZones);
        
        // Usa Plotly con dati filtrati
        await this.renderPlotlyChart(filteredData);
        
        // Ottieni anche i dati completi per info dettagliate
        const fullDataResponse = await fetch(`/api/technical-analysis/chart/${ticker}?days=100&include_analysis=true`);
        const fullData = fullDataResponse.ok ? await fullDataResponse.json() : null;
        
        // Aggiorna info grafico con dati completi
        this.updateChartInfo(filteredData.data_info || data.data_info, fullData);
        
        this.showLog(`✅ Grafico Plotly ${ticker} caricato (S&R: ${showSR}, Zone: ${showZones})`, 'success');
        
    } catch (error) {
        console.error('❌ Errore caricamento grafico Plotly:', error);
        this.showLog(`❌ Errore grafico: ${error.message}`, 'error');
        this.showPlotlyError(ticker, error.message);
    } finally {
        this.showChartLoading(false);
    }
}

// NUOVO METODO: Filtra i dati del grafico in base alle checkbox
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
            
            // Filtra supporti e resistenze (controllo più robusto)
            if (trace.name) {
                const traceName = trace.name.toLowerCase();
                if (traceName.includes('support') || traceName.includes('resistance') || 
                    traceName.includes('supporto') || traceName.includes('resistenza') ||
                    traceName.includes('livello') || traceName.includes('level')) {
                    console.log(`${showSR ? '✅ Mantieni' : '❌ Rimuovi'} S&R trace: ${trace.name}`);
                    return showSR;
                }
                
                // Filtra zone Skorupinski nei traces (se presenti)
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
        
        // Filtra le shapes (zone Skorupinski) nel layout
        let filteredShapes = [];
        if (figure.layout.shapes) {
            filteredShapes = figure.layout.shapes.filter(shape => {
                // Le zone Skorupinski sono shapes rettangolari con colori specifici
                if (shape.type === 'rect' && 
                    (shape.fillcolor?.includes('rgba(40, 167, 69') || // Zone verdi (demand)
                     shape.fillcolor?.includes('rgba(220, 53, 69'))) { // Zone rosse (supply)
                    console.log(`${showZones ? '✅ Mantieni' : '❌ Rimuovi'} zona Skorupinski`);
                    return showZones;
                }
                // Mantieni altre shapes
                return true;
            });
        }

        // Filtra le annotations (etichette di testo)
        let filteredAnnotations = [];
        if (figure.layout.annotations) {
            filteredAnnotations = figure.layout.annotations.filter(annotation => {
                const annotationText = annotation.text || '';
                
                // Filtra etichette supporti/resistenze
                if (annotationText.includes('Support') || annotationText.includes('Resistance') || 
                    annotationText.includes('Supporto') || annotationText.includes('Resistenza')) {
                    console.log(`${showSR ? '✅ Mantieni' : '❌ Rimuovi'} etichetta S&R: ${annotationText}`);
                    return showSR;
                }
                
                // Filtra etichette zone Skorupinski  
                if (annotationText.includes('Demand') || annotationText.includes('Supply') ||
                    annotationText.includes('Domanda') || annotationText.includes('Offerta') ||
                    annotationText.includes('Zone')) {
                    console.log(`${showZones ? '✅ Mantieni' : '❌ Rimuovi'} etichetta zona: ${annotationText}`);
                    return showZones;
                }
                
                // Mantieni altre annotations
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
        
        // Restituisci i dati modificati
        return {
            ...data,
            chart_json: JSON.stringify(filteredFigure)
        };
        
    } catch (error) {
        console.error('❌ Errore filtraggio dati:', error);
        // In caso di errore, restituisci i dati originali
        return data;
    }
}

// Metodo aggiornato per refreshChart che considera le checkbox
refreshChart() {
    const tickerSelect = document.getElementById('chartTickerSelect'); // Nota: usa chartTickerSelect, non tickerSelect
    if (tickerSelect && tickerSelect.value) {
        console.log('🔄 Refresh forzato del grafico...');
        this.loadChart(tickerSelect.value);
    } else {
        console.log('⚠️ Nessun ticker selezionato per il refresh');
    }
}

// METODO ALTERNATIVO: Se vuoi passare i parametri direttamente all'API
// Sostituisci loadChart con questa versione se preferisci che l'API gestisca il filtraggio
async loadChartWithAPIFiltering(ticker) {
    this.showChartLoading(true);
    
    try {
        console.log(`📊 Caricamento grafico Plotly per ${ticker}...`);
        
        // Leggi stato checkbox
        const showSRCheckbox = document.getElementById('showSRLevels');
        const showZonesCheckbox = document.getElementById('showZones');
        
        const showSR = showSRCheckbox ? showSRCheckbox.checked : true;
        const showZones = showZonesCheckbox ? showZonesCheckbox.checked : true;
        
        console.log(`🔧 Stato checkbox - S&R: ${showSR}, Zone: ${showZones}`);
        
        // Chiama l'API con parametri per filtraggio
        const params = new URLSearchParams({
            days: 100,
            include_analysis: true,
            show_support_resistance: showSR,
            show_zones: showZones
        });
        
        const response = await fetch(`/api/technical-analysis/chart-plotly/${ticker}?${params}`);
        
        if (!response.ok) {
            throw new Error(`Errore API: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Renderizza direttamente (l'API ha già filtrato)
        await this.renderPlotlyChart(data);
        
        this.showLog(`✅ Grafico Plotly ${ticker} caricato con filtraggio API`, 'success');
        
    } catch (error) {
        console.error('❌ Errore caricamento grafico:', error);
        // Fallback al metodo con filtraggio client
        console.log('🔄 Tentativo fallback con filtraggio client...');
        await this.loadChart(ticker);
    } finally {
        this.showChartLoading(false);
    }
}









  
    addSkorupinkiZones(datasets, zonesData, labelsLength) {
        try {
            // Zone di domanda (support)
            if (zonesData.demand_zones && Array.isArray(zonesData.demand_zones)) {
                zonesData.demand_zones.forEach((zone, index) => {
                    datasets.push({
                        label: `Zona Domanda ${zone.zone_bottom.toFixed(2)}-${zone.zone_top.toFixed(2)}`,
                        data: new Array(labelsLength).fill(zone.zone_bottom),
                        borderColor: 'rgba(40, 167, 69, 0.8)',
                        backgroundColor: 'rgba(40, 167, 69, 0.2)',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        fill: false,
                        order: 3
                    });

                    datasets.push({
                        label: `Zona Domanda ${zone.zone_top.toFixed(2)}`,
                        data: new Array(labelsLength).fill(zone.zone_top),
                        borderColor: 'rgba(40, 167, 69, 0.8)',
                        backgroundColor: 'rgba(40, 167, 69, 0.2)',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        fill: false,
                        order: 3
                    });
                });
            }

            // Zone di offerta (resistance)
            if (zonesData.supply_zones && Array.isArray(zonesData.supply_zones)) {
                zonesData.supply_zones.forEach((zone, index) => {
                    datasets.push({
                        label: `Zona Offerta ${zone.zone_bottom.toFixed(2)}`,
                        data: new Array(labelsLength).fill(zone.zone_bottom),
                        borderColor: 'rgba(220, 53, 69, 0.8)',
                        backgroundColor: 'rgba(220, 53, 69, 0.2)',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        fill: false,
                        order: 3
                    });

                    datasets.push({
                        label: `Zona Offerta ${zone.zone_top.toFixed(2)}`,
                        data: new Array(labelsLength).fill(zone.zone_top),
                        borderColor: 'rgba(220, 53, 69, 0.8)',
                        backgroundColor: 'rgba(220, 53, 69, 0.2)',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        fill: false,
                        order: 3
                    });
                });
            }

            console.log('📦 Zone Skorupinski aggiunte');
        } catch (error) {
            console.error('❌ Errore aggiunta zone:', error);
        }
    }

    createMinimalChart(ticker, data) {
        const ctx = document.getElementById('technicalChart');
        if (!ctx) return;

        try {
            const labels = data.price_data.map((item, index) => `Giorno ${index + 1}`);
            const priceData = data.price_data.map(item => item.close);

            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: `${ticker} - Prezzo`,
                        data: priceData,
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        borderWidth: 2,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `${ticker} - Grafico Semplificato`
                        }
                    }
                }
            });

            console.log('✅ Grafico minimale creato');
            this.showLog('ℹ️ Utilizzando grafico semplificato', 'info');

        } catch (error) {
            console.error('❌ Errore fatale:', error);
            this.showLog(`❌ Impossibile creare grafico: ${error.message}`, 'error');
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

    
 
    

    async loadZonesTable() {
        try {
            console.log('📊 Caricamento tabella zone Skorupinski...');
            
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
            this.populateZonesTable(data.zones || []);
            
        } catch (error) {
            console.error('❌ Errore caricamento tabella zone:', error);
            
            if (error.message.includes('500') || error.message.includes('INTERNAL SERVER ERROR')) {
                this.showZonesFallback();
            } else {
                this.showError('Errore nel caricamento delle zone Skorupinski: ' + error.message);
            }
        }
    }

    async loadLevelsTable() {
        try {
            console.log('📏 Caricamento tabella supporti/resistenze...');
            
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
            this.populateLevelsTable(data.levels || []);
            
        } catch (error) {
            console.error('❌ Errore caricamento tabella livelli:', error);
            
            if (error.message.includes('500') || error.message.includes('INTERNAL SERVER ERROR')) {
                this.showLevelsFallback();
            } else {
                this.showError('Errore nel caricamento dei livelli di supporto/resistenza: ' + error.message);
            }
        }
    }

    showZonesFallback() {
        const tbody = document.getElementById('zonesTableBody');
        if (!tbody) return;

        console.log('📊 Mostrando fallback per zone Skorupinski...');
        
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-4">
                    <div class="alert alert-warning mb-0">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        <strong>Endpoint API non implementato</strong><br>
                        <small class="text-muted">
                            L'endpoint <code>/api/technical-analysis/zones</code> non è disponibile nel backend.<br>
                            Aggiungi gli endpoint Flask per visualizzare le zone Skorupinski.
                        </small>
                    </div>
                </td>
            </tr>
        `;
        
        this.showLog('⚠️ Endpoint zones non implementato - mostrato fallback', 'warning');
    }

    showLevelsFallback() {
        const tbody = document.getElementById('levelsTableBody');
        if (!tbody) return;

        console.log('📏 Mostrando fallback per supporti/resistenze...');
        
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="alert alert-warning mb-0">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        <strong>Endpoint API non implementato</strong><br>
                        <small class="text-muted">
                            L'endpoint <code>/api/technical-analysis/levels</code> non è disponibile nel backend.<br>
                            Aggiungi gli endpoint Flask per visualizzare i livelli S&R.
                        </small>
                    </div>
                </td>
            </tr>
        `;
        
        this.showLog('⚠️ Endpoint levels non implementato - mostrato fallback', 'warning');
    }

    populateZonesTable(zones) {
        const tbody = document.getElementById('zonesTableBody');
        if (!tbody) {
            console.error('❌ Elemento zonesTableBody non trovato');
            return;
        }

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
            <tr class="${zone.type === 'Supply' ? 'table-danger' : 'table-success'} ${zone.virgin_zone ? 'fw-bold' : ''}">
                <td>
                    <span class="badge ${zone.type === 'Supply' ? 'bg-danger' : 'bg-success'}">
                        ${zone.ticker}
                    </span>
                </td>
                <td class="small">${this.formatDate(zone.date)}</td>
                <td>
                    <span class="badge ${this.getPatternBadgeClass(zone.pattern)}">
                        ${zone.pattern}
                    </span>
                </td>
                <td>
                    <i class="bi ${zone.type === 'Supply' ? 'bi-arrow-down text-danger' : 'bi-arrow-up text-success'}"></i>
                    ${zone.type}
                </td>
                <td class="font-monospace small">
                    ${zone.zone_bottom.toFixed(4)} - ${zone.zone_top.toFixed(4)}
                </td>
                <td class="font-monospace">${zone.zone_center.toFixed(4)}</td>
                <td>
                    <span class="badge ${zone.zone_thickness_pct < 1 ? 'bg-success' : zone.zone_thickness_pct < 2 ? 'bg-warning' : 'bg-danger'}">
                        ${zone.zone_thickness_pct.toFixed(2)}%
                    </span>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="progress flex-grow-1 me-2" style="height: 8px;">
                            <div class="progress-bar ${this.getStrengthBarClass(zone.strength_score)}" 
                                 style="width: ${Math.min(zone.strength_score * 20, 100)}%"></div>
                        </div>
                        <small class="text-muted">${zone.strength_score.toFixed(1)}</small>
                    </div>
                </td>
                <td class="font-monospace small">
                    <span class="${zone.distance_from_current > 0 ? 'text-success' : 'text-danger'}">
                        ${zone.distance_from_current > 0 ? '+' : ''}${zone.distance_from_current.toFixed(2)}%
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary btn-sm" onclick="window.taManager.viewZoneDetails('${zone.zone_id}')">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-info btn-sm" onclick="window.taManager.showZoneOnChart('${zone.ticker}', '${zone.zone_id}')">
                            <i class="bi bi-graph-up"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        console.log(`✅ Popolate ${zones.length} zone Skorupinski`);
    }

    populateLevelsTable(levels) {
        const tbody = document.getElementById('levelsTableBody');
        if (!tbody) {
            console.error('❌ Elemento levelsTableBody non trovato');
            return;
        }

        if (levels.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                        <i class="bi bi-info-circle me-2"></i>Nessun livello di supporto/resistenza trovato
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = levels.map(level => `
            <tr class="${level.type === 'Resistance' ? 'table-warning' : 'table-info'}">
                <td>
                    <span class="badge ${level.type === 'Resistance' ? 'bg-warning text-dark' : 'bg-info'}">
                        ${level.ticker}
                    </span>
                </td>
                <td class="small">${this.formatDate(level.date)}</td>
                <td>
                    <i class="bi ${level.type === 'Resistance' ? 'bi-arrow-up text-warning' : 'bi-arrow-down text-info'}"></i>
                    ${level.type}
                </td>
                <td class="font-monospace">${level.level.toFixed(4)}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="progress flex-grow-1 me-2" style="height: 8px;">
                            <div class="progress-bar ${this.getStrengthBarClass(level.strength)}" 
                                 style="width: ${Math.min(level.strength * 20, 100)}%"></div>
                        </div>
                        <small class="text-muted">${level.strength.toFixed(1)}</small>
                    </div>
                </td>
                <td class="small">${level.touches || 0} volte</td>
                <td class="font-monospace small">
                    <span class="${level.distance_pct > 0 ? 'text-success' : 'text-danger'}">
                        ${level.distance_pct > 0 ? '+' : ''}${level.distance_pct.toFixed(2)}%
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary btn-sm" onclick="window.taManager.viewLevelDetails('${level.id}')">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-info btn-sm" onclick="window.taManager.showLevelOnChart('${level.ticker}', ${level.level})">
                            <i class="bi bi-graph-up"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        console.log(`✅ Popolati ${levels.length} livelli S/R`);
    }

    // Metodi helper per formattazione
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

    getStrengthBarClass(strength) {
        if (strength >= 4) return 'bg-success';
        if (strength >= 3) return 'bg-warning';
        return 'bg-danger';
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

    // Metodi per azioni sui dettagli (da implementare)
    viewZoneDetails(zoneId) {
        console.log(`🔍 Visualizza dettagli zona: ${zoneId}`);
        // TODO: Implementare modal dettagli zona
    }

    showZoneOnChart(ticker, zoneId) {
        console.log(`📊 Mostra zona ${zoneId} per ${ticker} su grafico`);
        // TODO: Evidenziare zona specifica sul grafico
    }

    viewLevelDetails(levelId) {
        console.log(`🔍 Visualizza dettagli livello: ${levelId}`);
        // TODO: Implementare modal dettagli livello
    }

    showLevelOnChart(ticker, level) {
        console.log(`📊 Mostra livello ${level} per ${ticker} su grafico`);
        // TODO: Evidenziare livello specifico sul grafico
    }

    onTabChanged(target) {
        console.log(`🔄 Cambio tab: ${target}`);
        
        switch (target) {
            case '#chart':
                // Tab grafico attivato
                break;
            case '#zones':
                this.loadZonesTable();
                break;
            case '#levels':
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

        // Pulisci placeholder se esiste
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

        // Mantieni solo 50 voci
        while (logDiv.children.length > 50) {
            logDiv.removeChild(logDiv.firstChild);
        }
    }



// Nuovo metodo per renderizzare con Plotly
async renderPlotlyChart(data) {
    const chartDiv = document.getElementById('technicalChart');
    
    if (!chartDiv) {
        throw new Error('Elemento technicalChart non trovato');
    }
    
    // Verifica che Plotly sia disponibile
    if (typeof Plotly === 'undefined') {
        throw new Error('Plotly.js non disponibile');
    }
    
    try {
        // Converti il JSON del grafico
        const figure = JSON.parse(data.chart_json);
        
        // Renderizza con Plotly
        await Plotly.newPlot(chartDiv, figure.data, figure.layout, data.chart_config);
        
        console.log('✅ Grafico Plotly renderizzato con successo');
        
    } catch (error) {
        console.error('❌ Errore rendering Plotly:', error);
        throw error;
    }
}

// Metodo per mostrare errori Plotly
showPlotlyError(ticker, errorMessage) {
    const chartDiv = document.getElementById('technicalChart');
    if (!chartDiv) return;
    
    // Pulisci il div
    chartDiv.innerHTML = '';
    
    // Crea messaggio di errore
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger text-center';
    errorDiv.innerHTML = `
        <h5><i class="bi bi-exclamation-triangle"></i> Errore Grafico ${ticker}</h5>
        <p class="mb-0">${errorMessage}</p>
        <small class="text-muted">Controlla la console per maggiori dettagli</small>
    `;
    
    chartDiv.appendChild(errorDiv);
}

// Metodo per distruggere grafico Plotly (invece di Chart.js)
destroyExistingChart() {
    const chartDiv = document.getElementById('technicalChart');
    if (chartDiv && typeof Plotly !== 'undefined') {
        try {
            Plotly.purge(chartDiv);
            console.log('✅ Grafico Plotly distrutto');
        } catch (error) {
            console.warn('⚠️ Errore distruzione Plotly:', error);
        }
    }
}

// Aggiorna le info del grafico - versione dettagliata
updateChartInfo(dataInfo, fullData = null) {
    // Cerca sia l'elemento singolo che i tre elementi separati
    const chartInfoDiv = document.getElementById('chartInfo');
    const priceInfo = document.getElementById('priceInfo');
    const srInfo = document.getElementById('srInfo');
    const zonesInfo = document.getElementById('zonesInfo');

    // Se ci sono gli elementi separati (versione dettagliata)
    if (priceInfo && srInfo && zonesInfo) {
        this.updateDetailedChartInfo(dataInfo, fullData, priceInfo, srInfo, zonesInfo);
    } 
    // Altrimenti usa l'elemento singolo (versione compatta)
    else if (chartInfoDiv) {
        this.updateCompactChartInfo(dataInfo, chartInfoDiv);
    }
}

// Versione dettagliata con tre sezioni separate
updateDetailedChartInfo(dataInfo, fullData, priceInfo, srInfo, zonesInfo) {
    // ===== PRICE INFO =====
    if (priceInfo) {
        let priceContent = `
            <div>📊 Ticker: <strong>${dataInfo.ticker}</strong></div>
            <div>📅 Giorni: <strong>${dataInfo.days || 'N/A'}</strong></div>
            <div>📈 Record: <strong>${dataInfo.data_points}</strong></div>
        `;

        // Se abbiamo i dati completi, aggiungi ultimo prezzo e tipo
        if (fullData && fullData.price_data && fullData.price_data.length > 0) {
            const lastPrice = fullData.price_data[fullData.price_data.length - 1];
            const dataType = fullData.data_type || 'N/A';
            priceContent += `
                <div>💰 Ultimo: <strong>${lastPrice.close?.toFixed(2) || 'N/A'}</strong></div>
                <div>🔄 Tipo: <strong>${dataType}</strong></div>
            `;
        }

        priceContent += `
            <div>📅 Periodo: <small>${dataInfo.first_date} → ${dataInfo.last_date}</small></div>
            <div>📊 Volume: <strong>${dataInfo.has_volume ? '✅ Sì' : '❌ No'}</strong></div>
        `;

        priceInfo.innerHTML = priceContent;
    }

    // ===== SUPPORT & RESISTANCE INFO =====
    if (srInfo) {
        let srContent = '';
        
        if (fullData && fullData.support_resistance) {
            const srData = fullData.support_resistance;
            const supports = srData.filter(s => s.type === 'Support').length;
            const resistances = srData.filter(s => s.type === 'Resistance').length;
            
            srContent = `
                <div>🟢 Supporti: <strong>${supports}</strong></div>
                <div>🔴 Resistenze: <strong>${resistances}</strong></div>
                <div>📏 Totale: <strong>${srData.length}</strong></div>
            `;

            // Aggiungi info sui livelli più significativi
            if (srData.length > 0) {
                const avgStrength = (srData.reduce((sum, level) => sum + (level.strength || 1), 0) / srData.length).toFixed(1);
                srContent += `<div>💪 Forza Media: <strong>${avgStrength}</strong></div>`;
            }
        } else {
            // Fallback con dati summary
            srContent = `
                <div>📏 Livelli S&R: <strong>${dataInfo.sr_levels}</strong></div>
                <div>🔍 Dettagli: <em>Caricamento...</em></div>
            `;
        }

        srInfo.innerHTML = srContent;
    }

    // ===== ZONES INFO =====
    if (zonesInfo) {
        let zonesContent = '';

        if (fullData && fullData.skorupinski_zones) {
            const zonesData = Array.isArray(fullData.skorupinski_zones) 
                ? fullData.skorupinski_zones 
                : [];
            const supply = zonesData.filter(z => z.type === 'Supply').length;
            const demand = zonesData.filter(z => z.type === 'Demand').length;
            
            zonesContent = `
                <div>🔴 Supply: <strong>${supply}</strong></div>
                <div>🟢 Demand: <strong>${demand}</strong></div>
                <div>🎯 Totale: <strong>${zonesData.length}</strong></div>
            `;

            // Aggiungi statistiche aggiuntive se disponibili
            if (zonesData.length > 0) {
                const avgVolume = zonesData.filter(z => z.volume).length;
                if (avgVolume > 0) {
                    zonesContent += `<div>📊 Con Volume: <strong>${avgVolume}</strong></div>`;
                }
            }
        } else {
            // Fallback con dati summary
            const totalZones = dataInfo.demand_zones + dataInfo.supply_zones;
            zonesContent = `
                <div>🔴 Supply: <strong>${dataInfo.supply_zones}</strong></div>
                <div>🟢 Demand: <strong>${dataInfo.demand_zones}</strong></div>
                <div>🎯 Totale: <strong>${totalZones}</strong></div>
            `;
        }

        zonesInfo.innerHTML = zonesContent;
    }
}

// Versione compatta con un solo elemento
updateCompactChartInfo(dataInfo, chartInfoDiv) {
    const totalZones = dataInfo.demand_zones + dataInfo.supply_zones;
    
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
                <strong>${dataInfo.sr_levels}</strong>
            </div>
            <div class="col-md-3">
                <small class="text-muted">🎯 Zone:</small><br>
                <strong>${totalZones}</strong>
                <small>(${dataInfo.demand_zones}D/${dataInfo.supply_zones}S)</small>
            </div>
        </div>
        <div class="row g-2 mt-2">
            <div class="col-md-4">
                <small class="text-muted">📅 Primo:</small>
                <span class="ms-1">${dataInfo.first_date}</span>
            </div>
            <div class="col-md-4">
                <small class="text-muted">📅 Ultimo:</small>
                <span class="ms-1">${dataInfo.last_date}</span>
            </div>
            <div class="col-md-4">
                <small class="text-muted">📊 Volume:</small>
                <span class="ms-1">${dataInfo.has_volume ? '✅ Sì' : '❌ No'}</span>
            </div>
        </div>
    `;
}


}

    // ===== INIZIALIZZAZIONE COMPLETA =====
document.addEventListener('DOMContentLoaded', function() {
        console.log('🔄 DOM loaded - Inizializzazione Technical Analysis...');
      
        const loadChartBtn = document.getElementById('loadChartBtn');
        if (loadChartBtn) {
            loadChartBtn.addEventListener('click', function() {
                console.log('🔄 Bottone aggiorna cliccato');
                if (window.taManager) {
                    window.taManager.refreshChart();
                }
            });
        }

// Event listener per checkbox Supporti/Resistenze - VERSIONE MIGLIORATA
const showSRCheckbox = document.getElementById('showSRLevels');
if (showSRCheckbox) {
    showSRCheckbox.addEventListener('change', function() {
        console.log(`📊 Checkbox S&R cambiata: ${this.checked}`);
        
        // Ottieni ticker corrente
        const currentTicker = document.getElementById('chartTickerSelect')?.value;
        
        if (currentTicker && window.taManager) {
            console.log(`🔄 Aggiornamento grafico per ${currentTicker}...`);
            window.taManager.loadChart(currentTicker);
        } else {
            console.log('⚠️ Nessun ticker selezionato - aggiornamento saltato');
        }
    });
}

// Event listener per checkbox Zone Skorupinski - VERSIONE MIGLIORATA  
const showZonesCheckbox = document.getElementById('showZones');
if (showZonesCheckbox) {
    showZonesCheckbox.addEventListener('change', function() {
        console.log(`🎯 Checkbox Zone cambiata: ${this.checked}`);
        
        // Ottieni ticker corrente
        const currentTicker = document.getElementById('chartTickerSelect')?.value;
        
        if (currentTicker && window.taManager) {
            console.log(`🔄 Aggiornamento grafico per ${currentTicker}...`);
            window.taManager.loadChart(currentTicker);
        } else {
            console.log('⚠️ Nessun ticker selezionato - aggiornamento saltato');
        }
    });
}

// DEBUG: Aggiungi questa funzione per verificare il filtraggio
window.debugCheckboxState = function() {
    const showSR = document.getElementById('showSRLevels')?.checked;
    const showZones = document.getElementById('showZones')?.checked;
    const currentTicker = document.getElementById('chartTickerSelect')?.value;
    
    console.log('🔍 DEBUG Stato Checkbox:');
    console.log(`- Supporti/Resistenze: ${showSR}`);
    console.log(`- Zone Skorupinski: ${showZones}`);  
    console.log(`- Ticker corrente: ${currentTicker}`);
    
    if (currentTicker && window.taManager) {
        console.log('🔄 Forzando refresh...');
        window.taManager.loadChart(currentTicker);
    }
};

// DEBUG: Funzione per ispezionare il contenuto del grafico Plotly
window.debugPlotlyContent = function() {
    const chartDiv = document.getElementById('technicalChart');
    if (chartDiv && chartDiv.data && chartDiv.layout) {
        console.log('🔍 DEBUG Contenuto Plotly:');
        console.log('📊 Traces:', chartDiv.data.map(trace => ({
            name: trace.name,
            type: trace.type,
            visible: trace.visible
        })));
        console.log('🔳 Shapes:', chartDiv.layout.shapes?.length || 0);
        console.log('📝 Annotations:', chartDiv.layout.annotations?.map(ann => ann.text) || []);
        console.log('🏷️ Legend entries:', chartDiv.data.filter(trace => trace.showlegend !== false).length);
    } else {
        console.log('❌ Nessun grafico Plotly trovato');
    }
};

console.log('✅ Fix checkbox Plotly installato - usa debugCheckboxState() per test');
console.log('🔍 Usa debugPlotlyContent() per ispezionare il contenuto del grafico');





console.log('✅ Fix checkbox Plotly installato - usa debugCheckboxState() per test');

    // Controlla se siamo nella pagina di analisi tecnica
    if (document.getElementById('analysisNavTabs')) {
        console.log('✅ Pagina Technical Analysis rilevata');
        
        // Crea istanza manager UNICA con nomi consistenti
        window.taManager = new TechnicalAnalysisManager();
        window.TechnicalAnalysisInstance = window.taManager; // Alias per compatibilità
        
        // Carica dati iniziali se siamo nella tab overview
        const overviewTab = document.getElementById('overview-tab');
        if (overviewTab && overviewTab.classList.contains('active')) {
            console.log('📊 Tab overview attiva - caricamento dati...');
            window.taManager.loadOverviewData();
        }
        
        console.log('✅ Technical Analysis Manager inizializzato');
    } else {
        console.log('ℹ️ Pagina Technical Analysis non rilevata - inizializzazione saltata');
    }

    // ===== EVENT LISTENERS MANUALI PER SICUREZZA =====
    
    // Refresh zones button
    const refreshZonesBtn = document.getElementById('refreshZonesBtn');
    if (refreshZonesBtn) {
        refreshZonesBtn.addEventListener('click', () => {
            console.log('🔄 Refresh zones triggered');
            if (window.taManager && typeof window.taManager.loadZonesTable === 'function') {
                window.taManager.loadZonesTable();
            } else {
                console.error('❌ taManager.loadZonesTable non disponibile');
            }
        });
        console.log('✅ Event listener refreshZonesBtn configurato');
    }

    // Refresh levels button  
    const refreshLevelsBtn = document.getElementById('refreshLevelsBtn');
    if (refreshLevelsBtn) {
        refreshLevelsBtn.addEventListener('click', () => {
            console.log('🔄 Refresh levels triggered');
            if (window.taManager && typeof window.taManager.loadLevelsTable === 'function') {
                window.taManager.loadLevelsTable();
            } else {
                console.error('❌ taManager.loadLevelsTable non disponibile');
            }
        });
        console.log('✅ Event listener refreshLevelsBtn configurato');
    }

    // Auto-load quando si cambia tab
    const zonesTab = document.getElementById('zones-tab');
    if (zonesTab) {
        zonesTab.addEventListener('shown.bs.tab', () => {
            console.log('📊 Tab zones attivato');
            if (window.taManager && typeof window.taManager.loadZonesTable === 'function') {
                window.taManager.loadZonesTable();
            } else {
                console.error('❌ taManager.loadZonesTable non disponibile');
            }
        });
        console.log('✅ Event listener zones-tab configurato');
    }

    const levelsTab = document.getElementById('levels-tab');
    if (levelsTab) {
        levelsTab.addEventListener('shown.bs.tab', () => {
            console.log('📏 Tab levels attivato');
            if (window.taManager && typeof window.taManager.loadLevelsTable === 'function') {
                window.taManager.loadLevelsTable();
            } else {
                console.error('❌ taManager.loadLevelsTable non disponibile');
            }
        });
        console.log('✅ Event listener levels-tab configurato');
    }

    // Chart tab
    const chartTab = document.getElementById('chart-tab');
    if (chartTab) {
        chartTab.addEventListener('shown.bs.tab', () => {
            console.log('📈 Tab chart attivato');
            const tickerSelect = document.getElementById('chartTickerSelect');
            if (tickerSelect && tickerSelect.value && window.taManager) {
                window.taManager.loadChart(tickerSelect.value);
            }
        });
        console.log('✅ Event listener chart-tab configurato');
    }

    console.log('✅ Tutti gli event listeners per technical analysis configurati');
});



// ===== DEBUG HELPER =====
// Aggiungi funzione di debug per verificare lo stato
window.debugTechnicalAnalysis = function() {
    console.log('🔍 DEBUG Technical Analysis:');
    console.log('- taManager disponibile:', !!window.taManager);
    console.log('- TechnicalAnalysisInstance disponibile:', !!window.TechnicalAnalysisInstance);
    console.log('- Metodi taManager:', window.taManager ? Object.getOwnPropertyNames(Object.getPrototypeOf(window.taManager)) : 'N/A');
    console.log('- Elementi DOM trovati:');
    console.log('  - analysisNavTabs:', !!document.getElementById('analysisNavTabs'));
    console.log('  - overview-tab:', !!document.getElementById('overview-tab'));
    console.log('  - zones-tab:', !!document.getElementById('zones-tab'));
    console.log('  - levels-tab:', !!document.getElementById('levels-tab'));
    console.log('  - refreshZonesBtn:', !!document.getElementById('refreshZonesBtn'));
    console.log('  - refreshLevelsBtn:', !!document.getElementById('refreshLevelsBtn'));
    console.log('  - zonesTableBody:', !!document.getElementById('zonesTableBody'));
    console.log('  - levelsTableBody:', !!document.getElementById('levelsTableBody'));
};

console.log('✅ Technical Analysis module caricato - usa debugTechnicalAnalysis() per verificare lo stato');