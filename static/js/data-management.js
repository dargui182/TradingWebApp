/**
 * data-management-simple.js
 * File principale per la gestione della pagina dati - versione semplificata
 * CORRETTO: Usa sempre window.TickerAPI per evitare problemi di scope
 */

class DataManagement {
    constructor() {
        this.init();
    }

    init() {
        console.log('🚀 Inizializzazione DataManagement...');
        
        // Aspetta che il DOM sia pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        console.log('⚙️ Setup DataManagement...');
        
        // Verifica che TickerAPI sia disponibile
        if (!window.TickerAPI) {
            console.error('❌ TickerAPI non disponibile!');
            window.UIUtils.showNotification('❌ Sistema non inizializzato correttamente', 'danger');
            return;
        }
        
        console.log('✅ TickerAPI disponibile, procedo con setup');
        
        // Setup event listeners principali
        this.setupMainEventListeners();
        
        // Avvia auto-refresh
        this.startAutoRefresh();
        
        // Aggiorna statistiche iniziali
        this.updateStatistics();
        
        console.log('✅ DataManagement inizializzato');
    }

    setupMainEventListeners() {
        // Quick add ticker
        this.setupQuickAdd();
        
        // Popular tickers
        this.setupPopularTickers();
        
        // Examples
        this.setupExamples();
        
        // Test connection
        this.setupTestConnection();
        
        // Modal add ticker
        this.setupModalAdd();
        
        // Download all
        this.setupDownloadAll();
        
        // Refresh status
        this.setupRefreshStatus();
        
        // First ticker (if no tickers)
        this.setupFirstTicker();
        
        // Export config
        this.setupExportConfig();
        
        // Clear cache
        this.setupClearCache();
    }

    setupQuickAdd() {
        const quickAddBtn = document.getElementById('quickAddBtn');
        const quickTickerInput = document.getElementById('quickTickerInput');
        
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', () => {
                this.handleQuickAdd();
            });
        }
        
        if (quickTickerInput) {
            quickTickerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleQuickAdd();
                }
            });
            
            // Auto-uppercase
            quickTickerInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }
    }

    async handleQuickAdd() {
        const input = document.getElementById('quickTickerInput');
        const tickers = input?.value.trim().toUpperCase();
        
        if (!tickers) {
            window.UIUtils.showNotification('Inserisci almeno un ticker', 'warning');
            return;
        }
        
        const tickerList = tickers.split(',').map(t => t.trim()).filter(t => t);
        
        if (tickerList.length === 1) {
            await this.addSingleTicker(tickerList[0]);
        } else if (tickerList.length > 1) {
            await this.addMultipleTickers(tickerList);
        }
        
        input.value = '';
    }

    setupPopularTickers() {
        const addPopularBtn = document.getElementById('addPopularBtn');
        
        if (addPopularBtn) {
            addPopularBtn.addEventListener('click', async () => {
                const popularTickers = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'];
                
                const confirmed = confirm(
                    `Vuoi aggiungere questi ticker popolari?\n\n${popularTickers.join(', ')}\n\n` +
                    `Questo aggiungerà 5 ticker alla tua lista.`
                );
                
                if (confirmed) {
                    await this.addMultipleTickers(popularTickers);
                }
            });
        }
    }

    setupExamples() {
        const showExamplesBtn = document.getElementById('showExamplesBtn');
        
        if (showExamplesBtn) {
            showExamplesBtn.addEventListener('click', () => {
                this.showTickerExamples();
            });
        }
    }

    showTickerExamples() {
        const examples = `📈 Esempi di ticker popolari:

🏢 TECNOLOGIA:
• AAPL - Apple Inc.
• MSFT - Microsoft Corp
• GOOGL - Alphabet Inc
• TSLA - Tesla Inc
• NVDA - NVIDIA Corp
• META - Meta Platforms

🏦 FINANZA:
• JPM - JPMorgan Chase
• BAC - Bank of America
• WFC - Wells Fargo
• GS - Goldman Sachs

🛒 RETAIL & CONSUMO:
• AMZN - Amazon
• WMT - Walmart
• HD - Home Depot
• NKE - Nike

🎬 MEDIA & INTRATTENIMENTO:
• DIS - Disney
• NFLX - Netflix
• CMCSA - Comcast

💊 FARMACEUTICO:
• JNJ - Johnson & Johnson
• PFE - Pfizer
• UNH - UnitedHealth Group

⚡ ENERGIA:
• XOM - Exxon Mobil
• CVX - Chevron

💡 Suggerimenti:
• Usa sempre il simbolo ufficiale (es. GOOGL, non Google)
• I ticker sono case-insensitive
• Puoi aggiungere più ticker separandoli con virgole
• Verifica sempre su Yahoo Finance se non sei sicuro`;

        alert(examples);
    }

    setupTestConnection() {
        const testConnectionBtn = document.getElementById('testConnectionBtn');
        
        if (testConnectionBtn) {
            testConnectionBtn.addEventListener('click', async () => {
                await this.testConnection();
            });
        }
    }

    async testConnection() {
        const btn = document.getElementById('testConnectionBtn');
        
        window.UIUtils.setButtonLoading(btn, true, '🔧 Test Connessione');
        window.UIUtils.addLogEntry('🔧 Test connessione Yahoo Finance...', 'info');
        
        try {
            // CORRETTO: Usa window.TickerAPI
            const result = await window.TickerAPI.testConnection();
            
            if (result.status === 'success') {
                window.UIUtils.addLogEntry(`✅ Connessione OK: ${result.message}`, 'success');
                if (result.test_data) {
                    window.UIUtils.addLogEntry(`📊 Test data: ${result.test_data}`, 'info');
                }
                window.UIUtils.showNotification('✅ Connessione Yahoo Finance OK!', 'success');
            } else {
                window.UIUtils.addLogEntry(`⚠️ Problemi connessione: ${result.message}`, 'error');
                window.UIUtils.showNotification('⚠️ Problemi di connessione rilevati', 'warning');
            }
            
        } catch (error) {
            console.error('❌ Errore test connessione:', error);
            window.UIUtils.addLogEntry(`❌ Errore test connessione: ${error.message}`, 'error');
            window.UIUtils.showNotification('❌ Errore durante il test', 'danger');
        } finally {
            window.UIUtils.setButtonLoading(btn, false);
        }
    }

    setupModalAdd() {
        const confirmAddTicker = document.getElementById('confirmAddTicker');
        const modalTickerInput = document.getElementById('modalTickerInput');
        
        if (confirmAddTicker) {
            confirmAddTicker.addEventListener('click', async () => {
                const ticker = modalTickerInput?.value.trim().toUpperCase();
                if (ticker) {
                    await this.addSingleTicker(ticker);
                    
                    // Chiudi modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('addTickerModal'));
                    if (modal) modal.hide();
                    
                    // Reset input
                    if (modalTickerInput) modalTickerInput.value = '';
                }
            });
        }
        
        if (modalTickerInput) {
            modalTickerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    confirmAddTicker?.click();
                }
            });
            
            // Auto-uppercase
            modalTickerInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }
    }

    setupDownloadAll() {
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        
        if (downloadAllBtn) {
            downloadAllBtn.addEventListener('click', async () => {
                await this.downloadAllTickers();
            });
        }
    }

    async downloadAllTickers() {
        const btn = document.getElementById('downloadAllBtn');
        
        window.UIUtils.setButtonLoading(btn, true, '<i class="bi bi-cloud-download me-1"></i>Aggiorna Tutti');
        window.UIUtils.addLogEntry('🚀 Inizio aggiornamento di tutti i ticker...', 'info');
        
        try {
            // CORRETTO: Usa window.TickerAPI
            const result = await window.TickerAPI.downloadAllTickers();
            
            if (result.status === 'success') {
                const summary = result.summary;
                const message = `✅ Completato: ${summary.updated_tickers}/${summary.total_tickers} ticker aggiornati, ${summary.total_new_records} nuovi record`;
                
                window.UIUtils.addLogEntry(message, 'success');
                window.UIUtils.showNotification(
                    `Aggiornati ${summary.updated_tickers} ticker con ${summary.total_new_records} nuovi record`, 
                    'success'
                );
                
                // Mostra dettagli se disponibili
                if (result.results) {
                    this.logDownloadResults(result.results);
                }
                
                setTimeout(() => location.reload(), 2000);
            } else {
                window.UIUtils.addLogEntry(`❌ Errore generale: ${result.message}`, 'error');
                window.UIUtils.showNotification('Errore durante l\'aggiornamento', 'danger');
            }
            
        } catch (error) {
            console.error('❌ Errore download all:', error);
            window.UIUtils.addLogEntry(`❌ Errore generale: ${error.message}`, 'error');
            window.UIUtils.showNotification('❌ Errore durante l\'aggiornamento', 'danger');
        } finally {
            window.UIUtils.setButtonLoading(btn, false);
        }
    }

    logDownloadResults(results) {
        const successResults = results.filter(r => r.status === 'success' && r.records > 0);
        const errorResults = results.filter(r => r.status === 'error');
        
        // Log successi significativi
        successResults.slice(0, 5).forEach(result => {
            window.UIUtils.addLogEntry(`📈 ${result.ticker}: ${result.records} nuovi record`, 'success');
        });
        
        if (successResults.length > 5) {
            window.UIUtils.addLogEntry(`... e altri ${successResults.length - 5} ticker aggiornati`, 'success');
        }
        
        // Log errori
        errorResults.slice(0, 3).forEach(result => {
            window.UIUtils.addLogEntry(`❌ ${result.ticker}: ${result.message}`, 'error');
        });
        
        if (errorResults.length > 3) {
            window.UIUtils.addLogEntry(`... e altri ${errorResults.length - 3} errori`, 'error');
        }
    }

    setupRefreshStatus() {
        const refreshStatusBtn = document.getElementById('refreshStatusBtn');
        
        if (refreshStatusBtn) {
            refreshStatusBtn.addEventListener('click', async () => {
                await this.refreshStatus();
            });
        }
    }

    async refreshStatus() {
        const btn = document.getElementById('refreshStatusBtn');
        
        window.UIUtils.setButtonLoading(btn, true, '<i class="bi bi-arrow-clockwise me-1"></i>Aggiorna Stato');
        
        try {
            // CORRETTO: Usa window.TickerAPI
            await window.TickerAPI.getTickersStatus();
            window.UIUtils.addLogEntry('🔄 Status ticker aggiornato', 'info');
            window.UIUtils.showNotification('Status aggiornato', 'success');
            
            // Aggiorna statistiche
            setTimeout(() => this.updateStatistics(), 500);
            
        } catch (error) {
            console.error('❌ Errore refresh status:', error);
            window.UIUtils.showNotification('Errore aggiornamento status', 'warning');
        } finally {
            window.UIUtils.setButtonLoading(btn, false);
        }
    }

    setupFirstTicker() {
        const addFirstBtn = document.getElementById('addFirstTickerBtn');
        
        if (addFirstBtn) {
            addFirstBtn.addEventListener('click', async () => {
                const ticker = prompt('Inserisci il primo ticker (es. AAPL):');
                if (ticker && ticker.trim()) {
                    await this.addSingleTicker(ticker.trim().toUpperCase());
                }
            });
        }
    }

    setupExportConfig() {
        const exportConfigBtn = document.getElementById('exportConfigBtn');
        
        if (exportConfigBtn) {
            exportConfigBtn.addEventListener('click', () => {
                this.exportConfiguration();
            });
        }
    }

    async exportConfiguration() {
        window.UIUtils.showNotification('📥 Preparazione export configurazione...', 'info');
        
        setTimeout(async () => {
            try {
                // CORRETTO: Usa window.TickerAPI
                const config = await window.TickerAPI.getTickers();
                const stats = await window.TickerAPI.getTickersStatus();
                
                const exportData = {
                    export_info: {
                        exported_at: new Date().toISOString(),
                        exported_by: 'Stock Data Manager',
                        version: '1.0'
                    },
                    configuration: config,
                    ticker_status: stats,
                    summary: {
                        total_tickers: config.tickers?.length || 0,
                        export_date: new Date().toLocaleDateString('it-IT')
                    }
                };
                
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                    type: 'application/json' 
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ticker_config_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                
                window.UIUtils.showNotification('✅ Configurazione esportata!', 'success');
                
            } catch (error) {
                console.error('❌ Errore export:', error);
                window.UIUtils.showNotification('❌ Errore export configurazione', 'danger');
            }
        }, 1000);
    }

    setupClearCache() {
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                this.clearCache();
            });
        }
    }

    clearCache() {
        if (confirm('🧹 Pulire la cache del browser?\n\nQuesta azione rimuoverà i dati temporanei salvati localmente.')) {
            try {
                // Clear localStorage se presente
                if (typeof Storage !== 'undefined') {
                    localStorage.clear();
                    sessionStorage.clear();
                }
                
                window.UIUtils.showNotification('✅ Cache pulita!', 'success');
                window.UIUtils.addLogEntry('🧹 Cache del browser pulita', 'info');
                
            } catch (error) {
                window.UIUtils.showNotification('⚠️ Impossibile pulire completamente la cache', 'warning');
            }
        }
    }

    // Utility methods
    async addSingleTicker(ticker) {
        if (!ticker || ticker.length < 1) {
            window.UIUtils.showNotification('Ticker non valido', 'warning');
            return;
        }
        
        window.UIUtils.showNotification(`Aggiungendo ${ticker}...`, 'info');
        
        try {
            // CORRETTO: Usa window.TickerAPI
            const result = await window.TickerAPI.addTicker(ticker);
            
            if (result.status === 'success') {
                window.UIUtils.showNotification(`✅ ${result.message}`, 'success');
                window.UIUtils.addLogEntry(`➕ Ticker ${ticker} aggiunto alla configurazione`, 'success');
                
                // Mostra info ticker se disponibili
                if (result.ticker_info) {
                    window.UIUtils.addLogEntry(`📊 ${ticker}: ${result.ticker_info.name}`, 'info');
                }
                
                setTimeout(() => location.reload(), 1000);
            } else {
                window.UIUtils.showNotification(`⚠️ ${result.message}`, result.status === 'warning' ? 'warning' : 'danger');
            }
            
        } catch (error) {
            console.error(`❌ Errore adding ticker ${ticker}:`, error);
            window.UIUtils.showNotification(`❌ Errore aggiungendo ${ticker}: ${error.message}`, 'danger');
        }
    }

    async addMultipleTickers(tickerList) {
        window.UIUtils.showNotification(`Aggiungendo ${tickerList.length} ticker...`, 'info');
        
        let successCount = 0;
        let errorCount = 0;
        const results = [];
        
        for (const ticker of tickerList) {
            try {
                // CORRETTO: Usa window.TickerAPI
                const result = await window.TickerAPI.addTicker(ticker);
                results.push({ ticker, result });
                
                if (result.status === 'success') {
                    successCount++;
                    window.UIUtils.addLogEntry(`➕ ${ticker} aggiunto`, 'success');
                } else {
                    errorCount++;
                    window.UIUtils.addLogEntry(`❌ ${ticker}: ${result.message}`, 'error');
                }
                
                // Pausa tra richieste
                await this.delay(200);
                
            } catch (error) {
                errorCount++;
                results.push({ ticker, error: error.message });
                window.UIUtils.addLogEntry(`❌ ${ticker}: ${error.message}`, 'error');
            }
        }
        
        // Risultato finale
        if (successCount > 0) {
            const message = `✅ ${successCount} ticker aggiunti con successo${errorCount > 0 ? `, ${errorCount} errori` : ''}`;
            window.UIUtils.showNotification(message, 'success');
            window.UIUtils.addLogEntry(`🎉 Completata aggiunta multipla: ${successCount} successi, ${errorCount} errori`, 'success');
            setTimeout(() => location.reload(), 2000);
        } else {
            window.UIUtils.showNotification(`❌ Nessun ticker aggiunto (${errorCount} errori)`, 'danger');
        }
        
        return results;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    updateStatistics() {
        // Qui potresti aggiornare le statistiche nella dashboard
        // Per ora lasciamo che vengano aggiornate dal reload della pagina
        console.log('📊 Aggiornamento statistiche...');
    }

    startAutoRefresh() {
        // Auto-refresh ogni 5 minuti
        setInterval(async () => {
            if (!document.hidden && window.TickerAPI) {
                console.log('🔄 Auto-refresh dati...');
                try {
                    // CORRETTO: Usa window.TickerAPI
                    await window.TickerAPI.getTickersStatus();
                } catch (error) {
                    console.warn('⚠️ Auto-refresh fallito:', error);
                }
            }
        }, 300000); // 5 minuti
    }
}

// Inizializza quando il DOM è pronto - SEMPLICE!
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 DOM pronto, controllo elementi per DataManagement...');
    
    // Controlla se siamo nella pagina di gestione dati
    if (document.getElementById('quickAddCard') || document.getElementById('tickersTable')) {
        console.log('✅ Elementi trovati, inizializzazione DataManagement...');
        window.DataManagementInstance = new DataManagement();
    } else {
        console.log('ℹ️ Non siamo nella pagina di gestione dati, skip inizializzazione');
    }
});

console.log('✅ DataManagement Simple module caricato');