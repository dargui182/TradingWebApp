/**
 * technical-analysis.js
 * JavaScript per la gestione dell'analisi tecnica con supporti/resistenze e zone Skorupinski
 */

class TechnicalAnalysisManager {
    constructor() {
        this.currentDataSource = 'adjusted';
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
    }

    async loadInitialData() {
        try {
            await this.refreshSummary();
        } catch (error) {
            console.error('❌ Errore caricamento dati iniziali:', error);
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

        if (source === 'adjusted') {
            sourceElement.textContent = 'ADJUSTED';
            descriptionElement.textContent = 'Prezzi aggiustati per splits e dividendi (raccomandato per analisi tecnica)';
        } else {
            sourceElement.textContent = 'NOT ADJUSTED';
            descriptionElement.textContent = 'Prezzi originali senza aggiustamenti';
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
            const response = await fetch('/api/technical-analysis/summary');
            const summary = await response.json();

            // Aggiorna le card statistiche
            document.getElementById('totalAnalyzedTickers').textContent = 
                summary.support_resistance.analyzed + summary.skorupinski_zones.analyzed;
            
            document.getElementById('totalSRLevels').textContent = 
                summary.support_resistance.total_levels;
            
            document.getElementById('totalSupplyZones').textContent = 
                summary.skorupinski_zones.supply_zones;
            
            document.getElementById('totalDemandZones').textContent = 
                summary.skorupinski_zones.demand_zones;

            console.log('📊 Summary aggiornato:', summary);

        } catch (error) {
            console.error('❌ Errore refresh summary:', error);
        }
    }
    async loadChart(ticker) {
        try {
            this.showChartLoading(true);
            
            const days = document.getElementById('chartDaysSelect')?.value || 100;
            const showSR = document.getElementById('showSRLevels')?.checked;
            const showZones = document.getElementById('showZones')?.checked;

            // Opzione 1: Usa backend Python
            const response = await fetch(`/api/technical-analysis/chart-plotly/${ticker}?days=${days}&include_analysis=true`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Renderizza grafico Plotly dal JSON backend
            const chartDiv = document.getElementById('technicalChart');
            Plotly.newPlot(chartDiv, JSON.parse(data.chart_json), {}, data.chart_config);
            
            this.showLog(`✅ Grafico Plotly ${ticker} caricato`, 'success');

        } catch (error) {
            console.error('❌ Errore caricamento grafico:', error);
            this.showLog(`❌ Errore: ${error.message}`, 'error');
            
            // Fallback: crea grafico direttamente con Plotly.js
            this.createPlotlyChart(ticker);
        } finally {
            this.showChartLoading(false);
        }
    }
    async createPlotlyChart(ticker) {
        try {
            // Ottieni dati grezzi
            const response = await fetch(`/api/technical-analysis/chart/${ticker}?days=100&include_analysis=true`);
            const data = await response.json();

            // Prepara trace candlestick
            const trace = {
                x: data.price_data.map(item => item.date),
                open: data.price_data.map(item => item.open),
                high: data.price_data.map(item => item.high),
                low: data.price_data.map(item => item.low),
                close: data.price_data.map(item => item.close),
                type: 'candlestick',
                name: ticker,
                increasing: {line: {color: '#00C851'}},
                decreasing: {line: {color: '#FF4444'}}
            };

            const layout = {
                title: `${ticker} - Analisi Tecnica`,
                xaxis: {
                    title: 'Data',
                    type: 'date'
                },
                yaxis: {
                    title: 'Prezzo ($)'
                },
                template: 'plotly_white',
                height: 500
            };

            const config = {
                displayModeBar: true,
                displaylogo: false
            };

            // Crea il grafico
            const chartDiv = document.getElementById('technicalChart');
            Plotly.newPlot(chartDiv, [trace], layout, config);

            // Aggiungi supporti e resistenze come shapes
            if (data.support_resistance) {
                const shapes = data.support_resistance.map(level => ({
                    type: 'line',
                    x0: data.price_data[0].date,
                    x1: data.price_data[data.price_data.length - 1].date,
                    y0: level.level,
                    y1: level.level,
                    line: {
                        color: level.type === 'support' ? '#28a745' : '#dc3545',
                        width: 2,
                        dash: 'dash'
                    }
                }));

                Plotly.relayout(chartDiv, {'shapes': shapes});
            }

            this.showLog(`✅ Grafico Plotly ${ticker} creato`, 'success');

        } catch (error) {
            console.error('❌ Errore creazione grafico Plotly:', error);
            this.showLog(`❌ Errore: ${error.message}`, 'error');
        }
    }
// ===== STEP 3: Aggiorna renderChart in technical-analysis.js =====
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

    // ===== DISTRUGGI GRAFICO ESISTENTE IN MODO SICURO =====
    this.destroyExistingChart();

    // Usa setTimeout per assicurarsi che la distruzione sia completa
    setTimeout(() => {
        this.createChart(ticker, data, showSR, showZones);
    }, 200);
}

// Metodo separato per distruggere il grafico
destroyExistingChart() {
    try {
        if (this.chart && typeof this.chart.destroy === 'function') {
            console.log('🗑️ Distruzione grafico esistente...');
            this.chart.destroy();
            this.chart = null;
            console.log('✅ Grafico distrutto');
        }
    } catch (error) {
        console.warn('⚠️ Errore durante distruzione:', error);
        this.chart = null;
    }
}

// Metodo separato per creare il grafico
createChart(ticker, data, showSR, showZones) {
    const ctx = document.getElementById('technicalChart');
    if (!ctx) return;

    try {
        console.log('📊 Creazione nuovo grafico per', ticker);

        // ===== PREPARA DATI =====
        const labels = data.price_data.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit'
            });
        });

        const priceData = data.price_data.map(item => item.close);

        console.log('📊 Dati preparati:', {
            labels: labels.length,
            prices: priceData.length,
            firstLabel: labels[0],
            lastLabel: labels[labels.length - 1]
        });

        // ===== DATASET BASE =====
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

        // ===== AGGIUNGI SUPPORTI E RESISTENZE =====
        if (showSR && data.support_resistance && Array.isArray(data.support_resistance)) {
            console.log('📏 Aggiungendo', data.support_resistance.length, 'livelli S&R');
            
            data.support_resistance.forEach((level, index) => {
                const isSupport = level.type === 'support';
                const levelData = new Array(labels.length).fill(level.level);
                
                datasets.push({
                    label: `${isSupport ? 'Support' : 'Resistance'} $${level.level.toFixed(2)}`,
                    data: levelData,
                    borderColor: isSupport ? '#28a745' : '#dc3545',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [8, 4],
                    pointRadius: 0,
                    fill: false
                });
            });
        }

        // ===== AGGIUNGI ZONE SKORUPINSKI =====
        if (showZones && data.skorupinski_zones) {
            this.addZonesToChart(datasets, data.skorupinski_zones, labels.length);
        }

        // ===== CONFIGURAZIONE CHART.JS =====
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
                        beginAtZero: false
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: `${ticker} - Analisi Tecnica`
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        };

        // ===== CREA IL GRAFICO =====
        console.log('🎨 Creazione Chart.js...');
        this.chart = new Chart(ctx, config);
        
        console.log('✅ Grafico creato con successo!');
        this.showLog(`✅ Grafico ${ticker} caricato (${datasets.length} datasets)`, 'success');

    } catch (error) {
        console.error('❌ Errore creazione grafico:', error);
        this.showLog(`❌ Errore grafico: ${error.message}`, 'error');
        
        // Prova un fallback ancora più semplice
        this.createSimpleChart(ticker, data);
    }
}

// Metodo fallback semplicissimo
createSimpleChart(ticker, data) {
    const ctx = document.getElementById('technicalChart');
    if (!ctx) return;

    try {
        console.log('🔄 Tentativo grafico semplice...');

        const simpleLabels = data.price_data.map((_, index) => `Giorno ${index + 1}`);
        const simplePrices = data.price_data.map(item => item.close);

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: simpleLabels,
                datasets: [{
                    label: ticker,
                    data: simplePrices,
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

        console.log('✅ Grafico semplice creato');
        this.showLog('ℹ️ Grafico semplificato caricato', 'info');

    } catch (error) {
        console.error('❌ Errore anche nel grafico semplice:', error);
        this.showLog('❌ Impossibile creare grafico', 'error');
        
        // Mostra messaggio di errore nel canvas
        const canvas = document.getElementById('technicalChart');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#dc3545';
        ctx.textAlign = 'center';
        ctx.fillText('Errore: Impossibile creare grafico', canvas.width / 2, canvas.height / 2);
    }
}

// Metodo per aggiungere zone
addZonesToChart(datasets, zonesData, labelsLength) {
    try {
        if (zonesData.demand_zones && Array.isArray(zonesData.demand_zones)) {
            zonesData.demand_zones.forEach((zone, index) => {
                datasets.push({
                    label: `Demand Zone ${zone.zone_bottom.toFixed(2)}-${zone.zone_top.toFixed(2)}`,
                    data: new Array(labelsLength).fill(zone.zone_bottom),
                    borderColor: 'rgba(40, 167, 69, 0.8)',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                });
            });
        }

        if (zonesData.supply_zones && Array.isArray(zonesData.supply_zones)) {
            zonesData.supply_zones.forEach((zone, index) => {
                datasets.push({
                    label: `Supply Zone ${zone.zone_bottom.toFixed(2)}-${zone.zone_top.toFixed(2)}`,
                    data: new Array(labelsLength).fill(zone.zone_top),
                    borderColor: 'rgba(220, 53, 69, 0.8)',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                });
            });
        }

        console.log('📦 Zone Skorupinski aggiunte');
    } catch (error) {
        console.error('❌ Errore aggiunta zone:', error);
    }
}
// ===== SOLUZIONE 2: Aggiornare il metodo renderChart in technical-analysis.js =====
// 2. SOSTITUISCI renderChart in technical-analysis.js con questo:

createNewChart(ticker, data, showSR, showZones) {
    const ctx = document.getElementById('technicalChart');
    if (!ctx) return;

    try {
        // ===== PREPARA LABELS COME STRINGHE (NO DATE ADAPTER) =====
        const labels = data.price_data.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit'
            });
        });

        // ===== DATI PREZZO =====
        const priceData = data.price_data.map(item => item.close);

        console.log('📊 Labels preparate:', labels.slice(0, 5), '...');
        console.log('📊 Dati prezzo:', priceData.slice(0, 5), '...');

        // ===== DATASET BASE =====
        const datasets = [{
            label: `${ticker} - Prezzo di Chiusura`,
            data: priceData,
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 1,
            pointHoverRadius: 5
        }];

        // ===== AGGIUNGI SUPPORTI E RESISTENZE =====
        if (showSR && data.support_resistance && Array.isArray(data.support_resistance)) {
            console.log('📏 Aggiungendo S&R:', data.support_resistance.length, 'livelli');
            
            data.support_resistance.forEach((level, index) => {
                const isSupport = level.type === 'support';
                const levelData = new Array(labels.length).fill(level.level);
                
                datasets.push({
                    label: `${isSupport ? 'Supporto' : 'Resistenza'} ${level.level.toFixed(2)}`,
                    data: levelData,
                    borderColor: isSupport ? '#28a745' : '#dc3545',
                    backgroundColor: isSupport ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                    borderWidth: 2,
                    borderDash: [10, 5],
                    pointRadius: 0,
                    fill: false,
                    order: 2 // Metti le linee sotto il prezzo
                });
            });
        }

        // ===== AGGIUNGI ZONE SKORUPINSKI =====
        if (showZones && data.skorupinski_zones) {
            this.addSkorupinkiZones(datasets, data.skorupinski_zones, labels.length);
        }

        // ===== CONFIGURAZIONE GRAFICO =====
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
                            maxTicksLimit: 10, // Limita il numero di etichette sull'asse X
                            callback: function(value, index, values) {
                                // Mostra solo ogni N-esima etichetta per evitare sovraffollamento
                                if (index % Math.ceil(values.length / 8) === 0) {
                                    return this.getLabelForValue(value);
                                }
                                return '';
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Prezzo ($)'
                        },
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: `${ticker} - Analisi Tecnica`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: '#007bff',
                        borderWidth: 1,
                        callbacks: {
                            title: function(context) {
                                return `Data: ${context[0].label}`;
                            },
                            label: function(context) {
                                const value = context.parsed.y;
                                if (context.dataset.label.includes('Prezzo')) {
                                    return `${context.dataset.label}: $${value.toFixed(2)}`;
                                } else {
                                    return `${context.dataset.label}: $${value.toFixed(2)}`;
                                }
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                elements: {
                    line: {
                        tension: 0.1
                    }
                }
            }
        };

        // ===== CREA GRAFICO =====
        console.log('🎨 Creazione grafico in corso...');
        this.chart = new Chart(ctx, config);
        
        console.log('✅ Grafico creato con successo!');
        this.showLog(`✅ Grafico ${ticker} caricato (${datasets.length} datasets)`, 'success');

    } catch (error) {
        console.error('❌ Errore creazione grafico:', error);
        this.showLog(`❌ Errore grafico: ${error.message}`, 'error');
        
        // Fallback estremo - grafico minimale
        this.createMinimalChart(ticker, data);
    }
}

// ===== METODO PER AGGIUNGERE ZONE SKORUPINSKI =====
addSkorupinkiZones(datasets, zonesData, labelsLength) {
    try {
        // Zone di domanda (support)
        if (zonesData.demand_zones && Array.isArray(zonesData.demand_zones)) {
            zonesData.demand_zones.forEach((zone, index) => {
                // Linea inferiore della zona
                datasets.push({
                    label: `Zona Domanda ${zone.zone_bottom.toFixed(2)}`,
                    data: new Array(labelsLength).fill(zone.zone_bottom),
                    borderColor: 'rgba(40, 167, 69, 0.8)',
                    backgroundColor: 'rgba(40, 167, 69, 0.2)',
                    borderWidth: 1,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false,
                    order: 3
                });

                // Linea superiore della zona
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

// ===== FALLBACK ESTREMO - GRAFICO MINIMALE =====
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
// ===== SOLUZIONE 3: Metodi di supporto aggiornati =====
// ===== METODI DI SUPPORTO AGGIORNATI =====
addSRLevelsToDatasets(datasets, srData, priceData) {
    if (!srData || !Array.isArray(srData)) return;

    const minDate = priceData[0]?.x;
    const maxDate = priceData[priceData.length - 1]?.x;

    if (!minDate || !maxDate) return;

    srData.forEach((level, index) => {
        const isSupport = level.type === 'support';
        
        datasets.push({
            label: `${level.type.charAt(0).toUpperCase() + level.type.slice(1)} ${level.level.toFixed(2)}`,
            type: 'line',
            data: [
                { x: minDate, y: level.level },
                { x: maxDate, y: level.level }
            ],
            borderColor: isSupport ? '#28a745' : '#dc3545',
            backgroundColor: isSupport ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    });
}


addZonesToDatasets(datasets, zonesData, priceData) {
    if (!zonesData || !Array.isArray(zonesData.demand_zones) && !Array.isArray(zonesData.supply_zones)) return;

    const minDate = priceData[0]?.x;
    const maxDate = priceData[priceData.length - 1]?.x;

    // Aggiungi zone di domanda (support)
    if (zonesData.demand_zones) {
        zonesData.demand_zones.forEach((zone, index) => {
            datasets.push({
                label: `Zona Domanda ${zone.zone_bottom.toFixed(2)}-${zone.zone_top.toFixed(2)}`,
                type: 'line',
                data: [
                    { x: minDate, y: zone.zone_bottom },
                    { x: maxDate, y: zone.zone_bottom },
                    { x: maxDate, y: zone.zone_top },
                    { x: minDate, y: zone.zone_top },
                    { x: minDate, y: zone.zone_bottom }
                ],
                backgroundColor: 'rgba(40, 167, 69, 0.2)',
                borderColor: 'rgba(40, 167, 69, 0.8)',
                borderWidth: 1,
                fill: true,
                pointRadius: 0
            });
        });
    }

    // Aggiungi zone di offerta (resistance)
    if (zonesData.supply_zones) {
        zonesData.supply_zones.forEach((zone, index) => {
            datasets.push({
                label: `Zona Offerta ${zone.zone_bottom.toFixed(2)}-${zone.zone_top.toFixed(2)}`,
                type: 'line',
                data: [
                    { x: minDate, y: zone.zone_bottom },
                    { x: maxDate, y: zone.zone_bottom },
                    { x: maxDate, y: zone.zone_top },
                    { x: minDate, y: zone.zone_top },
                    { x: minDate, y: zone.zone_bottom }
                ],
                backgroundColor: 'rgba(220, 53, 69, 0.2)',
                borderColor: 'rgba(220, 53, 69, 0.8)',
                borderWidth: 1,
                fill: true,
                pointRadius: 0
            });
        });
    }
}

// ===== SOLUZIONE 4: Fallback senza candlestick (se il plugin non funziona) =====
// ===== METODO FALLBACK SENZA DATE ADAPTER =====
renderChartFallback(ticker, data, showSR, showZones) {
    const ctx = document.getElementById('technicalChart');
    if (!ctx) return;

    try {
        // Distruggi grafico esistente
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }

        // Prepara dati con labels stringa
        const labels = data.price_data.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('it-IT');
        });

        const priceData = data.price_data.map(item => item.close);

        const datasets = [{
            label: `${ticker} - Prezzo`,
            data: priceData,
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1
        }];

        // Aggiungi livelli S&R come linee orizzontali
        if (showSR && data.support_resistance) {
            data.support_resistance.forEach(level => {
                const isSupport = level.type === 'support';
                datasets.push({
                    label: `${level.type} ${level.level.toFixed(2)}`,
                    data: new Array(labels.length).fill(level.level),
                    borderColor: isSupport ? '#28a745' : '#dc3545',
                    backgroundColor: isSupport ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                });
            });
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Prezzo ($)'
                        },
                        beginAtZero: false
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: `${ticker} - Analisi Tecnica (Fallback)`
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });

        console.log('✅ Grafico fallback creato');
        this.showLog('ℹ️ Utilizzando grafico semplificato', 'info');

    } catch (error) {
        console.error('❌ Errore anche nel fallback:', error);
        this.showLog(`❌ Errore fatale grafico: ${error.message}`, 'error');
    }
}


    createSRLines(srLevels) {
        const lines = [];
        
        srLevels.forEach((level, index) => {
            if (index >= 10) return; // Max 10 livelli per non sovraccaricare

            const color = level.type === 'Support' ? 'rgba(40, 167, 69, 0.8)' : 'rgba(220, 53, 69, 0.8)';
            
            lines.push({
                label: `${level.type} ${level.level}`,
                data: [{x: 'min', y: level.level}, {x: 'max', y: level.level}],
                borderColor: color,
                backgroundColor: color,
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                showLine: true,
                tension: 0,
                fill: false
            });
        });

        return lines;
    }

    createZoneAreas(zones) {
        const areas = [];

        zones.forEach((zone, index) => {
            if (index >= 5) return; // Max 5 zone per non sovraccaricare

            const color = zone.type === 'Supply' ? 
                'rgba(220, 53, 69, 0.2)' : 'rgba(40, 167, 69, 0.2)';
            
            areas.push({
                label: `${zone.pattern} ${zone.type}`,
                data: [
                    {x: 'min', y: zone.zone_bottom},
                    {x: 'max', y: zone.zone_bottom},
                    {x: 'max', y: zone.zone_top},
                    {x: 'min', y: zone.zone_top}
                ],
                backgroundColor: color,
                borderColor: color.replace('0.2', '0.8'),
                borderWidth: 1,
                fill: true,
                pointRadius: 0,
                tension: 0
            });
        });

        return areas;
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

    updateChartInfo(data) {
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
    }

    async loadZonesTable() {
        try {
            // Qui dovresti implementare il caricamento della tabella zone
            // Per ora placeholder
            console.log('📊 Caricamento tabella zone...');
        } catch (error) {
            console.error('❌ Errore caricamento tabella zone:', error);
        }
    }

    async loadLevelsTable() {
        try {
            // Qui dovresti implementare il caricamento della tabella livelli
            // Per ora placeholder
            console.log('📏 Caricamento tabella livelli...');
        } catch (error) {
            console.error('❌ Errore caricamento tabella livelli:', error);
        }
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
}

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    // Controlla se siamo nella pagina di analisi tecnica
    if (document.getElementById('analysisNavTabs')) {
        console.log('🔄 Inizializzazione Technical Analysis...');
        window.TechnicalAnalysisInstance = new TechnicalAnalysisManager();
    }
});

console.log('✅ Technical Analysis module caricato');