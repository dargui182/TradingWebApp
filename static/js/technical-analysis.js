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



    createChart(ticker, data, showSR, showZones) {
        const ctx = document.getElementById('technicalChart');
        if (!ctx) return;

        try {
            console.log('📊 Creazione nuovo grafico per', ticker);

            // Verifica validità dati
            if (!data.price_data || data.price_data.length === 0) {
                throw new Error('Dati prezzo mancanti o vuoti');
            }

            // Prepara dati con validazione
            const labels = data.price_data.map((item, index) => {
                try {
                    const date = new Date(item.date);
                    if (isNaN(date.getTime())) {
                        return `Giorno ${index + 1}`;
                    }
                    return date.toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: '2-digit'
                    });
                } catch {
                    return `Giorno ${index + 1}`;
                }
            });

            const priceData = data.price_data.map(item => {
                const price = this.sanitizeNumber(item.close);
                return price !== null ? price : 0;
            });

            // Verifica che abbiamo dati validi
            const validPrices = priceData.filter(p => p > 0);
            if (validPrices.length === 0) {
                throw new Error('Nessun prezzo valido trovato');
            }

            console.log('📊 Dati preparati:', {
                labels: labels.length,
                prices: priceData.length,
                validPrices: validPrices.length,
                firstLabel: labels[0],
                lastLabel: labels[labels.length - 1],
                priceRange: `${Math.min(...validPrices).toFixed(2)} - ${Math.max(...validPrices).toFixed(2)}`
            });

            // Dataset base
            const datasets = [{
                label: `${ticker} - Prezzo`,
                data: priceData,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                pointRadius: 1
            }];

            // Aggiungi supporti e resistenze con validazione
            if (showSR && data.support_resistance && Array.isArray(data.support_resistance)) {
                console.log('📏 Aggiungendo', data.support_resistance.length, 'livelli S&R');
                
                let validSRCount = 0;
                data.support_resistance.forEach((level, index) => {
                    const levelValue = this.sanitizeNumber(level.level);
                    if (levelValue === null || levelValue <= 0) {
                        console.warn(`⚠️ Livello S&R non valido saltato:`, level);
                        return;
                    }

                    const isSupport = level.type === 'support' || level.type === 'Support';
                    const levelData = new Array(labels.length).fill(levelValue);
                    
                    datasets.push({
                        label: `${isSupport ? 'Support' : 'Resistance'} ${levelValue.toFixed(2)}`,
                        data: levelData,
                        borderColor: isSupport ? '#28a745' : '#dc3545',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [8, 4],
                        pointRadius: 0,
                        fill: false
                    });
                    
                    validSRCount++;
                });
                
                console.log(`✅ Aggiunti ${validSRCount} livelli S&R validi`);
            }

            // Aggiungi zone Skorupinski con validazione
            if (showZones && data.skorupinski_zones) {
                try {
                    this.addSkorupinkiZones(datasets, data.skorupinski_zones, labels.length);
                } catch (zonesError) {
                    console.warn('⚠️ Errore aggiunta zone Skorupinski:', zonesError);
                }
            }

            // Configurazione Chart.js
            const config = {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Data'
                            },
                            ticks: {
                                maxTicksLimit: 8
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Prezzo ($)'
                            },
                            beginAtZero: false,
                            // Imposta range basato sui dati reali
                            min: Math.min(...validPrices) * 0.98,
                            max: Math.max(...validPrices) * 1.02
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: `${ticker} - Analisi Tecnica`
                        },
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                filter: function(legendItem, chartData) {
                                    // Nascondi legend items per zone troppo numerose
                                    return chartData.datasets.length < 15;
                                }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            filter: function(tooltipItem) {
                                // Mostra solo tooltip per dati validi
                                return tooltipItem.parsed.y > 0;
                            }
                        }
                    }
                }
            };

            // Crea il grafico
            console.log('🎨 Creazione Chart.js...');
            this.chart = new Chart(ctx, config);
            
            console.log('✅ Grafico creato con successo!');
            this.showLog(`✅ Grafico ${ticker} caricato (${datasets.length} datasets)`, 'success');

        } catch (error) {
            console.error('❌ Errore creazione grafico:', error);
            this.showLog(`❌ Errore grafico: ${error.message}`, 'error');
            
            // Fallback
            this.createMinimalChart(ticker, data);
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

    
  /*   updateChartInfo(data) {
        const priceInfo = document.getElementById('priceInfo');
        const srInfo = document.getElementById('srInfo');
        const zonesInfo = document.getElementById('zonesInfo');

        if (priceInfo) {
            const priceData = data.price_data;
            const lastPrice = priceData[priceData.length - 1];
            priceInfo.innerHTML = `
                <div>📊 Tipo: ${data.data_type}</div>
                <div>📈 Ultimo: $${lastPrice.close}</div>
                <div>📅 Record: ${priceData.length}</div>
            `;
        }

        if (srInfo) {
            const srData = data.support_resistance || [];
            const supports = srData.filter(s => s.type === 'Support').length;
            const resistances = srData.filter(s => s.type === 'Resistance').length;
            srInfo.innerHTML = `
                <div>🟢 Supporti: ${supports}</div>
                <div>🔴 Resistenze: ${resistances}</div>
                <div>📏 Totale: ${srData.length}</div>
            `;
        }

        if (zonesInfo) {
            const zonesData = data.skorupinski_zones || [];
            const supply = zonesData.filter(z => z.type === 'Supply').length;
            const demand = zonesData.filter(z => z.type === 'Demand').length;
            zonesInfo.innerHTML = `
                <div>🔴 Supply: ${supply}</div>
                <div>🟢 Demand: ${demand}</div>
                <div>🎯 Totale: ${zonesData.length}</div>
            `;
        }
    } */
    

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

    // Sostituzione del metodo loadChart per usare Plotly invece di Chart.js
async loadChart(ticker) {
    this.showChartLoading(true);
    
    try {
        console.log(`📊 Caricamento grafico Plotly per ${ticker}...`);
        
        // Chiama l'API Plotly invece di quella Chart.js
        const response = await fetch(`/api/technical-analysis/chart-plotly/${ticker}?days=100&include_analysis=true`);
        
        if (!response.ok) {
            throw new Error(`Errore API: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Usa Plotly invece di Chart.js
        await this.renderPlotlyChart(data);
        
        // Aggiorna info grafico
        this.updateChartInfo(data.data_info);
        
        this.showLog(`✅ Grafico Plotly ${ticker} caricato`, 'success');
        
    } catch (error) {
        console.error('❌ Errore caricamento grafico Plotly:', error);
        this.showLog(`❌ Errore grafico: ${error.message}`, 'error');
        this.showPlotlyError(ticker, error.message);
    } finally {
        this.showChartLoading(false);
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

// Aggiorna le info del grafico
updateChartInfo(dataInfo) {
    const chartInfoDiv = document.getElementById('chartInfo');
    if (!chartInfoDiv) return;
    
    chartInfoDiv.innerHTML = `
        <div class="row g-2">
            <div class="col-md-3">
                <small class="text-muted">Ticker:</small><br>
                <strong>${dataInfo.ticker}</strong>
            </div>
            <div class="col-md-3">
                <small class="text-muted">Punti dati:</small><br>
                <strong>${dataInfo.data_points}</strong>
            </div>
            <div class="col-md-3">
                <small class="text-muted">Livelli S&R:</small><br>
                <strong>${dataInfo.sr_levels}</strong>
            </div>
            <div class="col-md-3">
                <small class="text-muted">Zone:</small><br>
                <strong>${dataInfo.demand_zones + dataInfo.supply_zones}</strong>
                <small>(${dataInfo.demand_zones}D/${dataInfo.supply_zones}S)</small>
            </div>
        </div>
        <div class="row g-2 mt-2">
            <div class="col-md-6">
                <small class="text-muted">Primo:</small>
                <span class="ms-1">${dataInfo.first_date}</span>
            </div>
            <div class="col-md-6">
                <small class="text-muted">Ultimo:</small>
                <span class="ms-1">${dataInfo.last_date}</span>
            </div>
        </div>
    `;
}
}

// ===== INIZIALIZZAZIONE COMPLETA =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 DOM loaded - Inizializzazione Technical Analysis...');
    
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