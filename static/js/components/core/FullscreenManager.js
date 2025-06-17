/**
 * FullscreenManager.js
 * Gestione fullscreen universale per qualsiasi elemento della dashboard
 * Supporta browser diversi, eventi personalizzati e stato persistente
 */

class FullscreenManager {
    constructor() {
        this.currentFullscreenElement = null;
        this.originalStyles = new Map();
        this.callbacks = new Map();
        this.isSupported = this.checkFullscreenSupport();
        this.boundHandlers = {
            fullscreenChange: this.handleFullscreenChange.bind(this),
            keydown: this.handleKeydown.bind(this),
            resize: this.handleResize.bind(this)
        };
        
        this.init();
    }

    init() {
        if (this.isSupported) {
            this.setupEventListeners();
            this.debug('✅ FullscreenManager inizializzato');
        } else {
            this.debug('⚠️ Fullscreen API non supportata in questo browser');
        }
    }

    // ===== SUPPORTO BROWSER =====
    
    checkFullscreenSupport() {
        return !!(
            document.fullscreenEnabled ||
            document.webkitFullscreenEnabled ||
            document.mozFullScreenEnabled ||
            document.msFullscreenEnabled
        );
    }

    getFullscreenElement() {
        return (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
    }

    async requestFullscreen(element) {
        if (element.requestFullscreen) {
            return element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            return element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            return element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            return element.msRequestFullscreen();
        }
        throw new Error('Fullscreen non supportato');
    }

    async exitFullscreen() {
        if (document.exitFullscreen) {
            return document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            return document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            return document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            return document.msExitFullscreen();
        }
        throw new Error('Exit fullscreen non supportato');
    }

    // ===== API PUBBLICA =====

    /**
     * Attiva fullscreen per un elemento
     * @param {string|HTMLElement} elementOrId - Elemento o ID dell'elemento
     * @param {Object} options - Opzioni di configurazione
     */
    async enter(elementOrId, options = {}) {
        if (!this.isSupported) {
            throw new Error('Fullscreen non supportato');
        }

        const element = typeof elementOrId === 'string' 
            ? document.getElementById(elementOrId) 
            : elementOrId;

        if (!element) {
            throw new Error('Elemento non trovato');
        }

        if (this.isFullscreen()) {
            await this.exit(); // Esci dal fullscreen corrente
        }

        try {
            this.debug(`🖥️ Entrando in fullscreen per elemento:`, element.id || element.tagName);
            
            // Salva stato originale
            this.saveOriginalState(element, options);
            
            // Applica stili pre-fullscreen
            this.applyPreFullscreenStyles(element, options);
            
            // Richiedi fullscreen nativo
            await this.requestFullscreen(element);
            
            this.currentFullscreenElement = element;
            
            // Callback di successo
            this.executeCallbacks('onEnter', element, options);
            
            // Evento personalizzato
            this.dispatchEvent('fullscreenEntered', { element, options });
            
        } catch (error) {
            this.debug('❌ Errore entrando in fullscreen:', error);
            this.restoreOriginalState(element);
            throw error;
        }
    }

    /**
     * Esce dal fullscreen
     */
    async exit() {
        if (!this.isFullscreen()) {
            this.debug('⚠️ Non in modalità fullscreen');
            return;
        }

        try {
            this.debug('🖥️ Uscendo da fullscreen...');
            
            const element = this.currentFullscreenElement;
            const wasFullscreen = this.getFullscreenElement();
            
            // Esci dal fullscreen nativo
            await this.exitFullscreen();
            
            // Il cleanup verrà fatto nell'evento fullscreenchange
            
        } catch (error) {
            this.debug('❌ Errore uscendo da fullscreen:', error);
            throw error;
        }
    }

    /**
     * Toggle fullscreen
     */
    async toggle(elementOrId, options = {}) {
        if (this.isFullscreen()) {
            await this.exit();
        } else {
            await this.enter(elementOrId, options);
        }
    }

    /**
     * Verifica se si è in modalità fullscreen
     */
    isFullscreen() {
        return !!this.getFullscreenElement();
    }

    /**
     * Registra callback per eventi fullscreen
     */
    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event).push(callback);
    }

    /**
     * Rimuove callback per eventi fullscreen
     */
    off(event, callback) {
        const callbacks = this.callbacks.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    // ===== GESTIONE STATO =====

    saveOriginalState(element, options) {
        const originalState = {
            position: element.style.position,
            top: element.style.top,
            left: element.style.left,
            width: element.style.width,
            height: element.style.height,
            zIndex: element.style.zIndex,
            transform: element.style.transform,
            transition: element.style.transition,
            backgroundColor: element.style.backgroundColor,
            className: element.className,
            scrollTop: element.scrollTop,
            scrollLeft: element.scrollLeft,
            options: { ...options }
        };

        this.originalStyles.set(element, originalState);
        this.debug('💾 Stato originale salvato per:', element.id || element.tagName);
    }

    restoreOriginalState(element) {
        const originalState = this.originalStyles.get(element);
        if (!originalState) return;

        this.debug('🔄 Ripristino stato originale per:', element.id || element.tagName);

        // Ripristina stili CSS
        Object.entries(originalState).forEach(([property, value]) => {
            if (property !== 'options' && property !== 'className') {
                element.style[property] = value || '';
            }
        });

        // Ripristina className se specificato
        if (originalState.className) {
            element.className = originalState.className;
        }

        // Ripristina scroll position
        element.scrollTop = originalState.scrollTop || 0;
        element.scrollLeft = originalState.scrollLeft || 0;

        // Rimuovi classi fullscreen
        element.classList.remove('fullscreen-active', 'fullscreen-element');

        this.originalStyles.delete(element);
    }

    applyPreFullscreenStyles(element, options) {
        // Applica classe CSS per identificazione
        element.classList.add('fullscreen-element');

        // Stili base per fullscreen
        const baseStyles = {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            zIndex: '9999',
            backgroundColor: options.backgroundColor || element.style.backgroundColor || '#fff',
            transition: 'all 0.3s ease-in-out'
        };

        // Applica stili personalizzati
        if (options.styles) {
            Object.assign(baseStyles, options.styles);
        }

        // Applica al DOM
        Object.entries(baseStyles).forEach(([property, value]) => {
            element.style[property] = value;
        });

        this.debug('🎨 Stili pre-fullscreen applicati');
    }

    // ===== EVENT HANDLERS =====

    setupEventListeners() {
        // Eventi fullscreen browser
        document.addEventListener('fullscreenchange', this.boundHandlers.fullscreenChange);
        document.addEventListener('webkitfullscreenchange', this.boundHandlers.fullscreenChange);
        document.addEventListener('mozfullscreenchange', this.boundHandlers.fullscreenChange);
        document.addEventListener('msfullscreenchange', this.boundHandlers.fullscreenChange);

        // Tasto ESC per uscire
        document.addEventListener('keydown', this.boundHandlers.keydown);

        // Resize window
        window.addEventListener('resize', this.boundHandlers.resize);
    }

    handleFullscreenChange() {
        const isCurrentlyFullscreen = this.isFullscreen();
        const element = this.currentFullscreenElement;

        if (!isCurrentlyFullscreen && element) {
            // Uscito da fullscreen
            this.debug('🖥️ Uscito da fullscreen per:', element.id || element.tagName);
            
            // Ripristina stato originale
            this.restoreOriginalState(element);
            
            // Callback di uscita
            this.executeCallbacks('onExit', element);
            
            // Evento personalizzato
            this.dispatchEvent('fullscreenExited', { element });
            
            // Reset stato interno
            this.currentFullscreenElement = null;
            
        } else if (isCurrentlyFullscreen && element) {
            // Entrato in fullscreen
            this.debug('🖥️ Entrato in fullscreen per:', element.id || element.tagName);
            
            // Applica classe attiva
            element.classList.add('fullscreen-active');
            
            // Applica stili post-fullscreen se necessario
            this.applyPostFullscreenStyles(element);
            
            // Callback post-enter
            this.executeCallbacks('onFullscreenActivated', element);
        }

        // Callback generico di cambio stato
        this.executeCallbacks('onChange', isCurrentlyFullscreen, element);
        
        // Evento generico
        this.dispatchEvent('fullscreenChanged', { 
            isFullscreen: isCurrentlyFullscreen, 
            element 
        });
    }

    handleKeydown(event) {
        // ESC per uscire da fullscreen
        if (event.key === 'Escape' && this.isFullscreen()) {
            event.preventDefault();
            this.exit();
        }
    }

    handleResize() {
        // Aggiusta dimensioni elemento fullscreen se necessario
        if (this.isFullscreen() && this.currentFullscreenElement) {
            this.adjustFullscreenDimensions(this.currentFullscreenElement);
        }
    }

    applyPostFullscreenStyles(element) {
        const originalState = this.originalStyles.get(element);
        const options = originalState?.options || {};

        // Stili aggiuntivi post-fullscreen
        if (options.postFullscreenStyles) {
            Object.entries(options.postFullscreenStyles).forEach(([property, value]) => {
                element.style[property] = value;
            });
        }

        // Forza re-layout per componenti complessi (es. grafici)
        if (options.forceReflow) {
            element.offsetHeight; // Trigger reflow
        }

        // Dispatch resize event per componenti interni
        if (options.dispatchResize) {
            window.dispatchEvent(new Event('resize'));
        }
    }

    adjustFullscreenDimensions(element) {
        // Assicura che l'elemento utilizzi tutto lo schermo
        element.style.width = '100vw';
        element.style.height = '100vh';
    }

    // ===== CALLBACKS E EVENTI =====

    executeCallbacks(eventType, ...args) {
        const callbacks = this.callbacks.get(eventType);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    this.debug(`❌ Errore callback ${eventType}:`, error);
                }
            });
        }
    }

    dispatchEvent(eventName, detail) {
        const event = new CustomEvent(`fullscreen:${eventName}`, {
            detail,
            bubbles: true,
            cancelable: true
        });
        
        document.dispatchEvent(event);
        
        // Dispatch anche sull'elemento se disponibile
        if (detail.element) {
            detail.element.dispatchEvent(event);
        }
    }

    // ===== UTILITY METHODS =====

    /**
     * Crea un bottone fullscreen per un elemento
     */
    createFullscreenButton(targetElementId, options = {}) {
        const button = document.createElement('button');
        button.className = options.className || 'btn btn-outline-secondary btn-sm fullscreen-btn';
        button.innerHTML = options.innerHTML || '<i class="bi bi-fullscreen"></i>';
        button.title = options.title || 'Fullscreen';
        
        button.addEventListener('click', async () => {
            try {
                await this.toggle(targetElementId, options);
                
                // Aggiorna icona bottone
                const icon = button.querySelector('i');
                if (icon) {
                    if (this.isFullscreen()) {
                        icon.className = 'bi bi-fullscreen-exit';
                        button.title = 'Esci da Fullscreen';
                    } else {
                        icon.className = 'bi bi-fullscreen';
                        button.title = 'Fullscreen';
                    }
                }
                
            } catch (error) {
                console.error('Errore toggle fullscreen:', error);
            }
        });

        return button;
    }

    /**
     * Aggiunge capacità fullscreen a un elemento esistente
     */
    makeElementFullscreenable(elementId, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) {
            throw new Error(`Elemento ${elementId} non trovato`);
        }

        // Crea bottone se richiesto
        if (options.addButton !== false) {
            const button = this.createFullscreenButton(elementId, {
                className: options.buttonClass,
                ...options.buttonOptions
            });
            
            // Posiziona bottone
            if (options.buttonPosition === 'inside') {
                element.style.position = 'relative';
                button.style.position = 'absolute';
                button.style.top = '10px';
                button.style.right = '10px';
                button.style.zIndex = '1000';
                element.appendChild(button);
            } else {
                // Inserisci prima dell'elemento
                element.parentNode.insertBefore(button, element);
            }
        }

        // Aggiungi double-click listener se richiesto
        if (options.doubleClickToFullscreen) {
            element.addEventListener('dblclick', () => {
                this.toggle(elementId, options);
            });
        }

        // Setup callbacks se forniti
        if (options.onEnter) this.on('onEnter', options.onEnter);
        if (options.onExit) this.on('onExit', options.onExit);
        if (options.onChange) this.on('onChange', options.onChange);

        return element;
    }

    /**
     * Debug logging
     */
    debug(...args) {
        if (window.DEBUG_FULLSCREEN) {
            console.log('[FullscreenManager]', ...args);
        }
    }

    /**
     * Cleanup e distruzione
     */
    destroy() {
        // Esci da fullscreen se attivo
        if (this.isFullscreen()) {
            this.exit();
        }

        // Rimuovi event listeners
        document.removeEventListener('fullscreenchange', this.boundHandlers.fullscreenChange);
        document.removeEventListener('webkitfullscreenchange', this.boundHandlers.fullscreenChange);
        document.removeEventListener('mozfullscreenchange', this.boundHandlers.fullscreenChange);
        document.removeEventListener('msfullscreenchange', this.boundHandlers.fullscreenChange);
        document.removeEventListener('keydown', this.boundHandlers.keydown);
        window.removeEventListener('resize', this.boundHandlers.resize);

        // Pulisci riferimenti
        this.callbacks.clear();
        this.originalStyles.clear();
        this.currentFullscreenElement = null;

        this.debug('🧹 FullscreenManager destroyed');
    }

    // ===== METODI STATICI PER USO DIRETTO =====

    /**
     * Istanza singleton globale
     */
    static getInstance() {
        if (!FullscreenManager._instance) {
            FullscreenManager._instance = new FullscreenManager();
        }
        return FullscreenManager._instance;
    }

    /**
     * Metodi statici per uso diretto
     */
    static async enter(elementId, options) {
        return FullscreenManager.getInstance().enter(elementId, options);
    }

    static async exit() {
        return FullscreenManager.getInstance().exit();
    }

    static async toggle(elementId, options) {
        return FullscreenManager.getInstance().toggle(elementId, options);
    }

    static isFullscreen() {
        return FullscreenManager.getInstance().isFullscreen();
    }

    static makeFullscreenable(elementId, options) {
        return FullscreenManager.getInstance().makeElementFullscreenable(elementId, options);
    }

    static createButton(targetElementId, options) {
        return FullscreenManager.getInstance().createFullscreenButton(targetElementId, options);
    }
}

// ===== INIZIALIZZAZIONE GLOBALE =====
if (typeof window !== 'undefined') {
    // Crea istanza globale
    window.FullscreenManager = FullscreenManager;
    
    // Shortcut globali per comodità
    window.enterFullscreen = (elementId, options) => FullscreenManager.enter(elementId, options);
    window.exitFullscreen = () => FullscreenManager.exit();
    window.toggleFullscreen = (elementId, options) => FullscreenManager.toggle(elementId, options);
    
    // Auto-inizializzazione per elementi con attributo data-fullscreen
    document.addEventListener('DOMContentLoaded', () => {
        const fullscreenElements = document.querySelectorAll('[data-fullscreen]');
        fullscreenElements.forEach(element => {
            const options = JSON.parse(element.dataset.fullscreenOptions || '{}');
            FullscreenManager.makeFullscreenable(element.id, options);
        });
    });
}

// Export per moduli
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FullscreenManager;
}

/*
=== ESEMPI DI UTILIZZO ===

// 1. Uso base
await FullscreenManager.enter('myChart');
await FullscreenManager.exit();

// 2. Con opzioni
await FullscreenManager.enter('dashboard', {
    backgroundColor: '#000',
    styles: { padding: '20px' },
    dispatchResize: true
});

// 3. Rendi un elemento fullscreenable
FullscreenManager.makeFullscreenable('myElement', {
    addButton: true,
    buttonPosition: 'inside',
    doubleClickToFullscreen: true,
    onEnter: () => console.log('Fullscreen!'),
    onExit: () => console.log('Normale!')
});

// 4. Uso con HTML data attributes
<div id="chart" data-fullscreen data-fullscreen-options='{"addButton":true}'>
    My Chart
</div>

// 5. Callbacks avanzati
const fs = FullscreenManager.getInstance();
fs.on('onEnter', (element) => {
    console.log('Entrato in fullscreen:', element);
});
fs.on('onChange', (isFullscreen) => {
    document.body.classList.toggle('fullscreen-mode', isFullscreen);
});
*/