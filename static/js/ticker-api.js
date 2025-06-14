/**
 * ticker-api-simple.js
 * Gestione centralizzata delle chiamate API per i ticker - versione semplificata e sincrona
 */

class TickerAPI {
    constructor() {
        this.baseUrl = '';
        this.defaultTimeout = 30000; // 30 secondi
        console.log('✅ TickerAPI: Costruttore chiamato');
    }

/**
     * Utility per fetch con timeout e gestione errori MIGLIORATA
     */
async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeout);

        // MIGLIORATO: Se la risposta non è OK, leggi comunque il body per il messaggio di errore
        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            
            try {
                // Prova a leggere il messaggio di errore dal server
                const errorData = await response.json();
                if (errorData.message) {
                    errorMessage = errorData.message;
                }
            } catch (parseError) {
                // Se non riusciamo a parsare il JSON, usa il messaggio di default
                console.warn('Impossibile parsare errore dal server:', parseError);
            }
            
            throw new Error(errorMessage);
        }

        return response;
    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        throw error;
    }
}

    /**
     * Ottiene la lista dei ticker configurati
     */
    async getTickers() {
        try {
            const response = await this.fetchWithTimeout('/api/tickers');
            return await response.json();
        } catch (error) {
            console.error('Error fetching tickers:', error);
            return { tickers: [], last_updated: null };
        }
    }

    /**
     * Ottiene lo stato di tutti i ticker
     */
    async getTickersStatus() {
        try {
            const response = await this.fetchWithTimeout('/api/tickers/status');
            return await response.json();
        } catch (error) {
            console.error('Error fetching tickers status:', error);
            return [];
        }
    }

    /**
     * Ottiene i dettagli di un ticker specifico
     */
    async getTickerDetails(ticker) {
        try {
            console.log(`🌐 TickerAPI.getTickerDetails: chiamata per ${ticker}`);
            const url = `/api/ticker/${ticker}/details`;
            console.log(`📡 URL: ${url}`);
            
            const response = await this.fetchWithTimeout(url);
            const data = await response.json();
            
            console.log(`✅ TickerAPI.getTickerDetails: dati ricevuti per ${ticker}:`, data);
            return data;
        } catch (error) {
            console.error(`❌ TickerAPI.getTickerDetails error for ${ticker}:`, error);
            throw error;
        }
    }

    /**
     * Ottiene i dati storici di un ticker
     */
    async getTickerData(ticker, options = {}) {
        const {
            limit = 20,
            version = 'adjusted'
        } = options;

        try {
            const url = `/api/ticker/${ticker}/data?limit=${limit}&version=${version}`;
            console.log(`🌐 TickerAPI.getTickerData: chiamata ${url}`);
            
            const response = await this.fetchWithTimeout(url);
            const data = await response.json();
            
            console.log(`✅ TickerAPI.getTickerData: ricevuti ${data.data?.length || 0} record per ${ticker}`);
            console.log(`🔍 Primo record:`, data.data?.[0]);
            
            return data;
        } catch (error) {
            console.error(`❌ TickerAPI.getTickerData error for ${ticker}:`, error);
            throw error;
        }
    }

    /**
     * Aggiunge un nuovo ticker
     */
    async addTicker(ticker) {
        try {
            console.log(`🌐 TickerAPI.addTicker: aggiungendo ${ticker}`);
            
            const response = await this.fetchWithTimeout('/api/tickers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ticker: ticker.trim().toUpperCase() })
            });

            const result = await response.json();
            console.log(`✅ TickerAPI.addTicker: risultato per ${ticker}:`, result);
            return result;
        } catch (error) {
            console.error(`❌ Error adding ticker ${ticker}:`, error);
            throw error;
        }
    }

    /**
     * Rimuove un ticker
     */
    async removeTicker(ticker) {
        try {
            console.log(`🌐 TickerAPI.removeTicker: rimuovendo ${ticker}`);
            
            const response = await this.fetchWithTimeout(`/api/tickers/${ticker}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            console.log(`✅ TickerAPI.removeTicker: risultato per ${ticker}:`, result);
            return result;
        } catch (error) {
            console.error(`❌ Error removing ticker ${ticker}:`, error);
            throw error;
        }
    }

    /**
     * Scarica/aggiorna i dati di un ticker
     */
    async downloadTicker(ticker) {
        try {
            console.log(`🌐 TickerAPI.downloadTicker: download ${ticker}`);
            
            const response = await this.fetchWithTimeout(`/api/download/${ticker}`);
            const result = await response.json();
            
            console.log(`✅ TickerAPI.downloadTicker: risultato per ${ticker}:`, result);
            return result;
        } catch (error) {
            console.error(`❌ Error downloading ticker ${ticker}:`, error);
            throw error;
        }
    }

    /**
     * Scarica/aggiorna tutti i ticker
     */
    async downloadAllTickers() {
        try {
            console.log(`🌐 TickerAPI.downloadAllTickers: download di tutti i ticker`);
            
            const response = await this.fetchWithTimeout('/api/download/all');
            const result = await response.json();
            
            console.log(`✅ TickerAPI.downloadAllTickers: risultato:`, result);
            return result;
        } catch (error) {
            console.error('❌ Error downloading all tickers:', error);
            throw error;
        }
    }

    /**
     * Testa la connessione a Yahoo Finance
     */
    async testConnection() {
        try {
            console.log(`🌐 TickerAPI.testConnection: test connessione`);
            
            const response = await this.fetchWithTimeout('/api/test/connection');
            const result = await response.json();
            
            console.log(`✅ TickerAPI.testConnection: risultato:`, result);
            return result;
        } catch (error) {
            console.error('❌ Error testing connection:', error);
            throw error;
        }
    }

    /**
     * Carica un file CSV
     */
    async uploadCsv(formData) {
        try {
            console.log(`🌐 TickerAPI.uploadCsv: upload CSV`);
            
            const response = await this.fetchWithTimeout('/api/upload/csv', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            console.log(`✅ TickerAPI.uploadCsv: risultato:`, result);
            return result;
        } catch (error) {
            console.error('❌ Error uploading CSV:', error);
            throw error;
        }
    }

    /**
     * Ottiene le statistiche del dashboard
     */
    async getStats() {
        try {
            const response = await this.fetchWithTimeout('/api/stats');
            return await response.json();
        } catch (error) {
            console.error('Error fetching stats:', error);
            return {};
        }
    }

    /**
     * Ottiene le attività recenti
     */
    async getActivities() {
        try {
            const response = await this.fetchWithTimeout('/api/activities');
            return await response.json();
        } catch (error) {
            console.error('Error fetching activities:', error);
            return [];
        }
    }
}

// ===== INIZIALIZZAZIONE SINCRONA =====
// Crea immediatamente l'istanza globale - NESSUNA COMPLESSITÀ ASINCRONA
console.log('🔄 Creazione istanza TickerAPI...');
window.TickerAPI = new TickerAPI();
console.log('✅ TickerAPI istanza creata e assegnata a window.TickerAPI:', window.TickerAPI);

// Test immediato per verificare che tutto funzioni
console.log('🧪 Test immediato TickerAPI:');
console.log('- TickerAPI.addTicker è funzione?', typeof window.TickerAPI.addTicker === 'function');
console.log('- TickerAPI.downloadTicker è funzione?', typeof window.TickerAPI.downloadTicker === 'function');
console.log('- TickerAPI.testConnection è funzione?', typeof window.TickerAPI.testConnection === 'function');
console.log('- TickerAPI.uploadCsv è funzione?', typeof window.TickerAPI.uploadCsv === 'function');
console.log('- TickerAPI.downloadAllTickers è funzione?', typeof window.TickerAPI.downloadAllTickers === 'function');

// ===== UTILITY FUNCTIONS =====
window.UIUtils = {
    /**
     * Mostra una notifica
     */
    showNotification(message, type = 'info', duration = 5000) {
        // Rimuovi notifiche esistenti
        const existingNotifications = document.querySelectorAll('.toast-notification');
        existingNotifications.forEach(notification => notification.remove());

        // Crea nuova notifica
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show toast-notification`;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 500px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            word-wrap: break-word;
        `;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        // Auto-remove
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, duration);
        }
    },

    /**
     * Aggiunge una voce al log delle attività
     */
    addLogEntry(message, type = 'info') {
        const logDiv = document.getElementById('downloadLog');
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
    },

    /**
     * Formatta numeri con separatori delle migliaia
     */
    formatNumber(num) {
        return num.toLocaleString('it-IT');
    },

    /**
     * Formatta valute
     */
    formatCurrency(amount, currency = '€') {
        return `${currency}${this.formatNumber(amount.toFixed(2))}`;
    },

    /**
     * Formatta prezzi azioni
     */
    formatPrice(price) {
        if (price === null || price === undefined) return '-';
        return `$${price.toFixed(2)}`;
    },

    /**
     * Formatta volume
     */
    formatVolume(volume) {
        if (!volume) return '-';

        if (volume >= 1000000) {
            return `${(volume / 1000000).toFixed(1)}M`;
        } else if (volume >= 1000) {
            return `${(volume / 1000).toFixed(0)}K`;
        }
        return this.formatNumber(volume);
    },

    /**
     * Formatta date
     */
    formatDate(dateStr) {
        if (!dateStr) return 'N/A';

        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    },

    /**
     * Formatta data e ora
     */
    formatDateTime(isoString) {
        if (!isoString) return 'N/A';

        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('it-IT') + ' ' +
                   date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return 'N/A';
        }
    },

    /**
     * Calcola il periodo di dati in anni
     */
    calculateDataSpan(firstDate, lastDate) {
        if (!firstDate || !lastDate) return 'N/A';

        try {
            const start = new Date(firstDate);
            const end = new Date(lastDate);
            const years = (end - start) / (1000 * 60 * 60 * 24 * 365.25);
            return Math.round(years * 10) / 10;
        } catch {
            return 'N/A';
        }
    },

    /**
     * Calcola variazione percentuale giornaliera
     */
    calculateDayChange(open, close) {
        if (!open || !close || open === 0) return null;
        return ((close - open) / open) * 100;
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Setta il testo di un bottone durante operazioni asincrone
     */
    setButtonLoading(button, isLoading, originalText = null) {
        if (isLoading) {
            if (!button.dataset.originalText) {
                button.dataset.originalText = originalText || button.innerHTML;
            }
            button.innerHTML = '<i class="bi bi-arrow-clockwise" style="animation: spin 1s linear infinite;"></i> Caricamento...';
            button.disabled = true;
        } else {
            button.innerHTML = button.dataset.originalText || originalText || button.innerHTML;
            button.disabled = false;
            delete button.dataset.originalText;
        }
    }
};

// Aggiungi CSS per animazioni
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    @keyframes fadeInDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

console.log('✅ TickerAPI Simple e UIUtils caricati completamente - READY TO USE!');