/**
 * ticker-api.js
 * Gestione centralizzata delle chiamate API per i ticker
 */

class TickerAPI {
    constructor() {
        this.baseUrl = '';
        this.defaultTimeout = 30000; // 30 secondi
        console.log('✅ TickerAPI: Costruttore chiamato');
    }

    /**
     * Utility per fetch con timeout e gestione errori
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

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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
            const response = await this.fetchWithTimeout('/api/tickers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ticker: ticker.trim().toUpperCase() })
            });

            return await response.json();
        } catch (error) {
            console.error(`Error adding ticker ${ticker}:`, error);
            throw error;
        }
    }

    /**
     * Rimuove un ticker
     */
    async removeTicker(ticker) {
        try {
            const response = await this.fetchWithTimeout(`/api/tickers/${ticker}`, {
                method: 'DELETE'
            });

            return await response.json();
        } catch (error) {
            console.error(`Error removing ticker ${ticker}:`, error);
            throw error;
        }
    }

    /**
     * Scarica/aggiorna i dati di un ticker
     */
    async downloadTicker(ticker) {
        try {
            const response = await this.fetchWithTimeout(`/api/download/${ticker}`);
            return await response.json();
        } catch (error) {
            console.error(`Error downloading ticker ${ticker}:`, error);
            throw error;
        }
    }

    /**
     * Scarica/aggiorna tutti i ticker
     */
    async downloadAllTickers() {
        try {
            const response = await this.fetchWithTimeout('/api/download/all');
            return await response.json();
        } catch (error) {
            console.error('Error downloading all tickers:', error);
            throw error;
        }
    }

    /**
     * Testa la connessione a Yahoo Finance
     */
    async testConnection() {
        try {
            const response = await this.fetchWithTimeout('/api/test/connection');
            return await response.json();
        } catch (error) {
            console.error('Error testing connection:', error);
            throw error;
        }
    }

    /**
     * Carica un file CSV
     */
    async uploadCsv(formData) {
        try {
            const response = await this.fetchWithTimeout('/api/upload/csv', {
                method: 'POST',
                body: formData
            });

            return await response.json();
        } catch (error) {
            console.error('Error uploading CSV:', error);
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

// Crea istanza globale dell'API
console.log('🔄 Creazione istanza TickerAPI...');
window.TickerAPI = new TickerAPI();
console.log('✅ TickerAPI istanza creata:', window.TickerAPI);

// Test metodi disponibili
console.log('🔍 Metodi TickerAPI disponibili:');
console.log('- getTickerDetails:', typeof window.TickerAPI.getTickerDetails);
console.log('- getTickerData:', typeof window.TickerAPI.getTickerData);
console.log('- getTickers:', typeof window.TickerAPI.getTickers);

// Utility functions per l'interfaccia utente
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

console.log('✅ TickerAPI e UIUtils caricati completamente');

// Test finale
setTimeout(() => {
    console.log('🧪 Test finale TickerAPI:');
    console.log('TickerAPI.getTickerData è funzione?', typeof window.TickerAPI.getTickerData === 'function');
    console.log('TickerAPI.getTickerDetails è funzione?', typeof window.TickerAPI.getTickerDetails === 'function');
}, 100);