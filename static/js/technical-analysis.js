/**
 * technical-analysis.js
 * JavaScript per la gestione dell'analisi tecnica con supporti/resistenze e zone Skorupinski
 */

class TechnicalAnalysisManager {
    constructor() {
        this.currentDataSource = 'adjusted';
        this.chart = null;
        this.chartData = null;
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

            this.showLog(`📊 Caricamento grafico ${ticker} (${days} giorni)...`, 'info');

            const response = await fetch(`/api/technical-analysis/chart/${ticker}?days=${days}&include_analysis=true`);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            this.chartData = data;
            this.renderChart(ticker, data, showSR, showZones);
            this.updateChartInfo(data);

            document.getElementById('chartTitle').textContent = 
                `${ticker} - Analisi Tecnica (${data.data_type})`;

            this.showLog(`✅ Grafico ${ticker} caricato`, 'success');

        } catch (error) {
            console.error('❌ Errore caricamento grafico:', error);
            this.showLog(`❌ Errore caricamento grafico: ${error.message}`, 'error');
        } finally {
            this.showChartLoading(false);
        }
    }

    renderChart(ticker, data, showSR, showZones) {
        const ctx = document.getElementById('technicalChart');
        if (!ctx) return;

        // Distruggi grafico esistente
        if (this.chart) {
            this.chart.destroy();
        }

        // Prepara dati prezzo per candlestick
        const priceData = data.price_data.map(item => ({
            x: item.date,
            o: item.open,
            h: item.high,
            l: item.low,
            c: item.close
        }));

        // Dataset base
        const datasets = [{
            label: 'Prezzo',
            data: priceData,
            type: 'candlestick',
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)'
        }];

        // Aggiungi supporti/resistenze se richiesti
        if (showSR && data.support_resistance && data.support_resistance.length > 0) {
            const srLines = this.createSRLines(data.support_resistance);
            datasets.push(...srLines);
        }

        // Aggiungi zone Skorupinski se richieste
        if (showZones && data.skorupinski_zones && data.skorupinski_zones.length > 0) {
            const zoneAreas = this.createZoneAreas(data.skorupinski_zones);
            datasets.push(...zoneAreas);
        }

        // Configura e crea grafico
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'right'
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
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