/**
 * BaseComponent.js
 * Classe base per tutti i componenti della dashboard
 * Fornisce funzionalità comuni: eventi, DOM manipulation, lifecycle
 */

class BaseComponent {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = null;
        this.options = { ...this.defaultOptions, ...options };
        this.eventListeners = new Map();
        this.isInitialized = false;
        this.isDestroyed = false;
        
        // Auto-inizializzazione se il DOM è pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    /**
     * Opzioni di default - da sovrascrivere nelle classi figlie
     */
    get defaultOptions() {
        return {
            debug: false,
            autoInit: true,
            destroyOnRemove: true
        };
    }

    /**
     * Inizializzazione del componente
     */
    async init() {
        if (this.isInitialized || this.isDestroyed) return;

        try {
            // Trova il container
            this.container = document.getElementById(this.containerId);
            if (!this.container) {
                throw new Error(`Container con ID '${this.containerId}' non trovato`);
            }

            // Log debug
            this.debug(`🔧 Inizializzazione ${this.constructor.name}...`);

            // Hook per setup pre-render
            await this.beforeRender();

            // Rendering del componente
            await this.render();

            // Hook per setup post-render
            await this.afterRender();

            // Setup eventi
            this.setupEventListeners();

            this.isInitialized = true;
            this.debug(`✅ ${this.constructor.name} inizializzato`);

            // Emette evento di inizializzazione
            this.emit('initialized');

        } catch (error) {
            console.error(`❌ Errore inizializzazione ${this.constructor.name}:`, error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Hook: eseguito prima del rendering
     */
    async beforeRender() {
        // Override nelle classi figlie
    }

    /**
     * Rendering del componente - DEVE essere implementato nelle classi figlie
     */
    async render() {
        throw new Error('Il metodo render() deve essere implementato nelle classi figlie');
    }

    /**
     * Hook: eseguito dopo il rendering
     */
    async afterRender() {
        // Override nelle classi figlie
    }

    /**
     * Setup event listeners - Override nelle classi figlie
     */
    setupEventListeners() {
        // Override nelle classi figlie
    }

    /**
     * Aggiunge un event listener e lo traccia per cleanup automatico
     */
    addEventListener(element, event, handler, options = {}) {
        if (typeof element === 'string') {
            element = this.container.querySelector(element);
        }

        if (!element) {
            this.debug(`⚠️ Elemento non trovato per event listener: ${event}`);
            return;
        }

        // Wrapper per cleanup automatico
        const wrappedHandler = (e) => {
            if (this.isDestroyed) return;
            handler.call(this, e);
        };

        element.addEventListener(event, wrappedHandler, options);

        // Traccia per cleanup
        const key = `${element.tagName}-${event}-${Date.now()}`;
        this.eventListeners.set(key, { element, event, handler: wrappedHandler });

        return key;
    }

    /**
     * Rimuove un event listener tracciato
     */
    removeEventListener(key) {
        const listener = this.eventListeners.get(key);
        if (listener) {
            listener.element.removeEventListener(listener.event, listener.handler);
            this.eventListeners.delete(key);
        }
    }

    /**
     * Emette un evento personalizzato
     */
    emit(eventName, data = null) {
        const event = new CustomEvent(`${this.constructor.name.toLowerCase()}:${eventName}`, {
            detail: { component: this, data }
        });
        
        this.container?.dispatchEvent(event);
        document.dispatchEvent(event);
    }

    /**
     * Ascolta un evento del componente
     */
    on(eventName, handler) {
        const fullEventName = `${this.constructor.name.toLowerCase()}:${eventName}`;
        document.addEventListener(fullEventName, handler);
        
        // Traccia per cleanup
        this.eventListeners.set(`custom-${eventName}`, {
            element: document,
            event: fullEventName,
            handler
        });
    }

    /**
     * Utility per selezionare elementi nel container
     */
    $(selector) {
        return this.container?.querySelector(selector);
    }

    /**
     * Utility per selezionare tutti gli elementi nel container
     */
    $$(selector) {
        return this.container?.querySelectorAll(selector) || [];
    }

    /**
     * Crea un elemento HTML con attributi e contenuto
     */
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className' || key === 'class') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else {
                element.setAttribute(key, value);
            }
        });

        if (content) {
            if (typeof content === 'string') {
                element.innerHTML = content;
            } else {
                element.appendChild(content);
            }
        }

        return element;
    }

    /**
     * Mostra loading nel container
     */
    showLoading(message = 'Caricamento...') {
        const loading = this.createElement('div', {
            className: 'component-loading text-center p-4',
            style: 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000;'
        }, `
            <div class="spinner-border text-primary mb-2" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="text-muted">${message}</div>
        `);

        this.hideLoading(); // Rimuovi loading precedente
        this.container.style.position = 'relative';
        this.container.appendChild(loading);
    }

    /**
     * Nasconde loading
     */
    hideLoading() {
        const loading = this.$('.component-loading');
        if (loading) {
            loading.remove();
        }
    }

    /**
     * Mostra errore nel container
     */
    showError(message, error = null) {
        this.hideLoading();
        
        const errorElement = this.createElement('div', {
            className: 'alert alert-danger component-error',
            role: 'alert'
        }, `
            <h6 class="alert-heading">
                <i class="bi bi-exclamation-triangle"></i> Errore
            </h6>
            <p class="mb-0">${message}</p>
            ${error && this.options.debug ? `<small class="text-muted">${error.message}</small>` : ''}
        `);

        this.container.appendChild(errorElement);
        this.debug('❌ Errore mostrato:', message, error);
    }

    /**
     * Rimuove messaggi di errore
     */
    hideError() {
        const errors = this.$$('.component-error');
        errors.forEach(error => error.remove());
    }

    /**
     * Aggiorna il componente con nuovi dati
     */
    async update(newData) {
        if (!this.isInitialized) {
            this.debug('⚠️ Tentativo di update su componente non inizializzato');
            return;
        }

        try {
            this.emit('beforeUpdate', newData);
            await this.handleUpdate(newData);
            this.emit('updated', newData);
        } catch (error) {
            console.error(`❌ Errore update ${this.constructor.name}:`, error);
            this.emit('error', error);
        }
    }

    /**
     * Gestisce l'aggiornamento - da implementare nelle classi figlie
     */
    async handleUpdate(newData) {
        // Override nelle classi figlie
        await this.render();
    }

    /**
     * Refresh del componente
     */
    async refresh() {
        if (!this.isInitialized) return;
        
        this.debug('🔄 Refresh componente...');
        await this.handleRefresh();
        this.emit('refreshed');
    }

    /**
     * Gestisce il refresh - da implementare nelle classi figlie  
     */
    async handleRefresh() {
        await this.render();
    }

    /**
     * Logging con debug
     */
    debug(...args) {
        if (this.options.debug) {
            console.log(`[${this.constructor.name}]`, ...args);
        }
    }

    /**
     * Distrugge il componente e fa cleanup
     */
    destroy() {
        if (this.isDestroyed) return;

        this.debug(`🧹 Distruzione ${this.constructor.name}...`);

        // Cleanup event listeners
        this.eventListeners.forEach((listener, key) => {
            this.removeEventListener(key);
        });
        this.eventListeners.clear();

        // Hook per cleanup custom
        this.beforeDestroy();

        // Cleanup DOM
        if (this.container) {
            this.container.innerHTML = '';
        }

        // Cleanup referenze
        this.container = null;
        this.isDestroyed = true;
        this.isInitialized = false;

        this.debug(`✅ ${this.constructor.name} distrutto`);
    }

    /**
     * Hook: eseguito prima della distruzione
     */
    beforeDestroy() {
        // Override nelle classi figlie
    }

    /**
     * Getter per lo stato del componente
     */
    get isReady() {
        return this.isInitialized && !this.isDestroyed && this.container;
    }

    /**
     * Getter per informazioni debug
     */
    get debugInfo() {
        return {
            containerId: this.containerId,
            isInitialized: this.isInitialized,
            isDestroyed: this.isDestroyed,
            eventListeners: this.eventListeners.size,
            options: this.options
        };
    }
}

// Export per uso in moduli
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseComponent;
} else {
    window.BaseComponent = BaseComponent;
}