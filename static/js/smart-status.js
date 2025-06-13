/**
 * smart-status.js
 * Fix intelligente per gli status dei ticker basato sui giorni di mercato reali
 */

class SmartStatus {
    constructor() {
        this.init();
    }

    init() {
        console.log('🔧 Inizializzazione SmartStatus...');
        
        // Aspetta che il DOM sia pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        // Applica fix dopo un breve delay per assicurarsi che tutto sia caricato
        setTimeout(() => {
            this.updateAllStatusBadges();
            this.setupModalStatusUpdater();
            this.logDebugInfo();
            console.log('✅ SmartStatus applicato con successo');
        }, 1000);
    }

    /**
     * Verifica se una data è un giorno di mercato (Lun-Ven, esclude weekend)
     */
    isMarketDay(date) {
        const day = date.getDay();
        
        // 0 = Domenica, 6 = Sabato
        if (day === 0 || day === 6) {
            return false;
        }
        
        // Qui puoi aggiungere festività specifiche se necessario
        const holidays = this.getMarketHolidays(date.getFullYear());
        const dateStr = this.formatDateForComparison(date);
        
        if (holidays.includes(dateStr)) {
            return false;
        }
        
        return true;
    }

    /**
     * Ottiene le principali festività del mercato USA per un anno
     */
    getMarketHolidays(year) {
        return [
            `${year}-01-01`, // New Year's Day
            `${year}-07-04`, // Independence Day  
            `${year}-12-25`, // Christmas Day
            // Aggiungi altre festività se necessario
            // `${year}-11-28`, // Thanksgiving (ultimo giovedì di novembre - varia)
        ];
    }

    /**
     * Formatta data per confronto (YYYY-MM-DD)
     */
    formatDateForComparison(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Calcola l'ultimo giorno di mercato atteso
     */
    getLastExpectedMarketDay() {
        const now = new Date();
        const currentHour = now.getHours();
        
        // Il mercato USA chiude alle 22:00 ora italiana (16:00 EST + 6 ore)
        // Se è dopo le 22:00 e oggi è un giorno di mercato, i dati di oggi potrebbero essere disponibili
        if (currentHour >= 22 && this.isMarketDay(now)) {
            return now;
        }
        
        // Altrimenti cerca l'ultimo giorno di mercato precedente
        let checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() - 1);
        
        let attempts = 0;
        while (!this.isMarketDay(checkDate) && attempts < 10) {
            checkDate.setDate(checkDate.getDate() - 1);
            attempts++;
        }
        
        return checkDate;
    }

    /**
     * Calcola lo status intelligente basato sull'ultimo dato disponibile
     */
    calculateSmartStatus(lastDataDateStr) {
        if (!lastDataDateStr || lastDataDateStr === 'N/A') {
            return {
                needsUpdate: true,
                className: 'badge bg-danger status-badge',
                text: '❌ Nessun dato',
                tooltip: 'Nessun dato disponibile'
            };
        }

        try {
            // Parsing flessibile della data
            let lastDataDate;
            
            if (lastDataDateStr.includes('/')) {
                // Formato DD/MM/YYYY (italiano)
                const parts = lastDataDateStr.split('/');
                lastDataDate = new Date(parts[2], parts[1] - 1, parts[0]);
            } else if (lastDataDateStr.includes('-')) {
                // Formato YYYY-MM-DD (ISO)
                lastDataDate = new Date(lastDataDateStr);
            } else {
                throw new Error('Formato data non riconosciuto');
            }

            if (isNaN(lastDataDate.getTime())) {
                throw new Error('Data non valida');
            }

            const lastExpectedDay = this.getLastExpectedMarketDay();
            
            // Confronta solo le date (ignora l'ora)
            const lastDataDateOnly = new Date(lastDataDate.getFullYear(), lastDataDate.getMonth(), lastDataDate.getDate());
            const lastExpectedDayOnly = new Date(lastExpectedDay.getFullYear(), lastExpectedDay.getMonth(), lastExpectedDay.getDate());
            
            const diffMs = lastExpectedDayOnly.getTime() - lastDataDateOnly.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            // Calcola quanti giorni di mercato sono passati
            let marketDaysDiff = 0;
            let checkDate = new Date(lastDataDateOnly);
            checkDate.setDate(checkDate.getDate() + 1);
            
            while (checkDate <= lastExpectedDayOnly && marketDaysDiff < 10) {
                if (this.isMarketDay(checkDate)) {
                    marketDaysDiff++;
                }
                checkDate.setDate(checkDate.getDate() + 1);
            }

            const lastDataFormatted = lastDataDate.toLocaleDateString('it-IT');
            const lastExpectedFormatted = lastExpectedDay.toLocaleDateString('it-IT');

            if (diffDays <= 0) {
                // Dati aggiornati
                return {
                    needsUpdate: false,
                    className: 'badge bg-success status-badge',
                    text: '✅ Aggiornato',
                    tooltip: `Ultimo dato: ${lastDataFormatted} (aggiornato)`
                };
            } else if (marketDaysDiff === 1) {
                // Manca 1 giorno di mercato
                return {
                    needsUpdate: true,
                    className: 'badge bg-warning status-badge',
                    text: '⏰ 1 giorno',
                    tooltip: `Ultimo dato: ${lastDataFormatted}\nAtteso: ${lastExpectedFormatted}`
                };
            } else if (marketDaysDiff <= 3) {
                // Mancano pochi giorni di mercato
                return {
                    needsUpdate: true,
                    className: 'badge bg-warning status-badge',
                    text: `⏰ ${marketDaysDiff} giorni`,
                    tooltip: `Ultimo dato: ${lastDataFormatted}\nAtteso: ${lastExpectedFormatted}\n${marketDaysDiff} giorni di mercato mancanti`
                };
            } else {
                // Molto in ritardo
                return {
                    needsUpdate: true,
                    className: 'badge bg-danger status-badge',
                    text: `❌ ${marketDaysDiff} giorni`,
                    tooltip: `Ultimo dato: ${lastDataFormatted}\nAtteso: ${lastExpectedFormatted}\n${marketDaysDiff} giorni di mercato mancanti`
                };
            }

        } catch (error) {
            console.warn('Errore parsing data:', lastDataDateStr, error);
            return {
                needsUpdate: true,
                className: 'badge bg-warning status-badge',
                text: '⚠️ Errore data',
                tooltip: `Errore nel parsing della data: ${lastDataDateStr}`
            };
        }
    }

    /**
     * Aggiorna tutti i badge di status nella tabella
     */
    updateAllStatusBadges() {
        const statusBadges = document.querySelectorAll('.status-badge');
        
        console.log(`📊 Aggiornamento ${statusBadges.length} badge di status...`);
        
        statusBadges.forEach((badge, index) => {
            const row = badge.closest('tr');
            if (!row) return;
            
            // Cerca la data dell'ultimo dato nel DOM
            const lastDate = this.extractLastDateFromRow(row);
            
            if (lastDate) {
                const status = this.calculateSmartStatus(lastDate);
                
                // Aggiorna il badge
                badge.className = status.className;
                badge.innerHTML = status.text;
                badge.title = status.tooltip;
                
                console.log(`📅 Badge ${index + 1}: ${lastDate} → ${status.text}`);
            }
        });
        
        // Aggiorna anche le statistiche nei card header
        this.updateHeaderStatistics();
    }

    /**
     * Estrae l'ultima data disponibile da una riga della tabella
     */
    extractLastDateFromRow(row) {
        // Cerca in vari posti dove potrebbe essere la data
        const selectors = [
            'td div strong',        // Date nelle celle
            'td strong',            // Date dirette
            '[data-last-date]',     // Attributi data
        ];
        
        let latestDate = null;
        let latestDateObj = null;
        
        selectors.forEach(selector => {
            const elements = row.querySelectorAll(selector);
            
            elements.forEach(element => {
                const text = element.textContent.trim();
                
                // Cerca pattern di date
                const datePatterns = [
                    /\d{4}-\d{2}-\d{2}/,        // YYYY-MM-DD
                    /\d{2}\/\d{2}\/\d{4}/,      // DD/MM/YYYY
                ];
                
                datePatterns.forEach(pattern => {
                    const match = text.match(pattern);
                    if (match) {
                        try {
                            let candidateDate;
                            const dateStr = match[0];
                            
                            if (dateStr.includes('/')) {
                                const parts = dateStr.split('/');
                                candidateDate = new Date(parts[2], parts[1] - 1, parts[0]);
                            } else {
                                candidateDate = new Date(dateStr);
                            }
                            
                            if (!isNaN(candidateDate.getTime())) {
                                if (!latestDateObj || candidateDate > latestDateObj) {
                                    latestDate = dateStr;
                                    latestDateObj = candidateDate;
                                }
                            }
                        } catch (error) {
                            // Ignora errori di parsing
                        }
                    }
                });
            });
        });
        
        return latestDate;
    }

    /**
     * Aggiorna le statistiche nei card header
     */
    updateHeaderStatistics() {
        // Conta i badge per tipo
        const badges = document.querySelectorAll('.status-badge');
        let updatedCount = 0;
        let pendingCount = 0;
        
        badges.forEach(badge => {
            if (badge.textContent.includes('✅')) {
                updatedCount++;
            } else if (badge.textContent.includes('⏰') || badge.textContent.includes('❌')) {
                pendingCount++;
            }
        });
        
        // Aggiorna i contatori nei card
        const updatedElement = document.getElementById('updatedTickers');
        const pendingElement = document.getElementById('pendingTickers');
        
        if (updatedElement) {
            updatedElement.textContent = updatedCount;
        }
        
        if (pendingElement) {
            pendingElement.textContent = pendingCount;
        }
        
        console.log(`📈 Statistiche aggiornate: ${updatedCount} aggiornati, ${pendingCount} da aggiornare`);
    }

    /**
     * Setup dell'aggiornamento status nel modal
     */
    setupModalStatusUpdater() {
        const modal = document.getElementById('viewTickerModal');
        if (!modal) return;
        
        modal.addEventListener('shown.bs.modal', () => {
            // Aspetta un attimo che il modal sia popolato
            setTimeout(() => {
                this.updateModalStatus();
            }, 500);
        });
    }

    /**
     * Aggiorna lo status nel modal dei dettagli
     */
    updateModalStatus() {
        const statusBadge = document.getElementById('modalStatusBadge');
        const statusIcon = document.getElementById('modalStatusIcon');
        const lastDateElement = document.getElementById('modalLastDate');
        
        if (!statusBadge || !lastDateElement) return;
        
        const lastDateText = lastDateElement.textContent.trim();
        
        if (lastDateText && lastDateText !== 'N/A') {
            const status = this.calculateSmartStatus(lastDateText);
            
            // Aggiorna badge
            statusBadge.className = status.className.replace('status-badge', 'fs-6 mb-2');
            statusBadge.textContent = status.text;
            statusBadge.title = status.tooltip;
            
            // Aggiorna icona
            if (statusIcon) {
                if (status.text.includes('✅')) {
                    statusIcon.textContent = '✅';
                } else if (status.text.includes('⏰')) {
                    statusIcon.textContent = '⏰';
                } else {
                    statusIcon.textContent = '❌';
                }
            }
            
            console.log(`📊 Status modal aggiornato: ${status.text}`);
        }
    }

    /**
     * Log informazioni di debug
     */
    logDebugInfo() {
        const now = new Date();
        const lastMarketDay = this.getLastExpectedMarketDay();
        const isToday = now.toDateString() === lastMarketDay.toDateString();
        
        console.log(`📅 SmartStatus Debug Info:
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        📆 Oggi: ${now.toLocaleDateString('it-IT')} (${this.getDayName(now)})
        📈 Ultimo giorno mercato atteso: ${lastMarketDay.toLocaleDateString('it-IT')} (${this.getDayName(lastMarketDay)})
        🕐 Ora corrente: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}
        ✅ Oggi è giorno di mercato: ${this.isMarketDay(now) ? 'Sì' : 'No'}
        📊 Dati di oggi sono attesi: ${isToday ? 'Sì' : 'No'}
        ⚡ Mercato chiuso (>= 22:00): ${now.getHours() >= 22 ? 'Sì' : 'No'}
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
    }

    /**
     * Ottiene il nome del giorno
     */
    getDayName(date) {
        const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        return days[date.getDay()];
    }

    /**
     * Metodo pubblico per refresh manuale
     */
    refresh() {
        console.log('🔄 Refresh manuale SmartStatus...');
        this.updateAllStatusBadges();
        this.logDebugInfo();
    }
}

// Aggiungi CSS per migliorare l'aspetto (versione sicura senza conflitti)
(function addSmartStatusCSS() {
    // Controlla se il CSS è già stato aggiunto
    if (document.getElementById('smart-status-css')) {
        return;
    }
    
    const styleElement = document.createElement('style');
    styleElement.id = 'smart-status-css';
    styleElement.textContent = `
        /* Migliora l'aspetto dei badge */
        .status-badge {
            cursor: help;
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .status-badge:hover {
            transform: scale(1.05);
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        /* Animazione per i badge aggiornati */
        @keyframes pulse-success {
            0% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.7); }
            70% { box-shadow: 0 0 0 5px rgba(40, 167, 69, 0); }
            100% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0); }
        }

        .badge.bg-success.status-badge {
            animation: pulse-success 2s ease-in-out;
        }
        
        /* Stili aggiuntivi per tooltip migliorati */
        .status-badge[title]:hover::after {
            content: attr(title);
            position: absolute;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
            z-index: 1000;
            margin-top: 25px;
            margin-left: -50px;
        }
    `;
    document.head.appendChild(styleElement);
})();

// Crea istanza globale
window.SmartStatusInstance = null;

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    window.SmartStatusInstance = new SmartStatus();
});

// Esponi metodi utili globalmente
window.SmartStatus = {
    refresh: () => {
        if (window.SmartStatusInstance) {
            window.SmartStatusInstance.refresh();
        }
    },
    
    isMarketDay: (date = new Date()) => {
        if (window.SmartStatusInstance) {
            return window.SmartStatusInstance.isMarketDay(date);
        }
        return true;
    },
    
    getLastExpectedMarketDay: () => {
        if (window.SmartStatusInstance) {
            return window.SmartStatusInstance.getLastExpectedMarketDay();
        }
        return new Date();
    }
};

console.log('✅ SmartStatus module caricato');