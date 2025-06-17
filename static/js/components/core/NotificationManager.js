/**
 * NotificationManager.js
 * Sistema di notifiche centralizzato per tutta la dashboard
 * Supporta toast, modal, banner e notifiche con progress
 */

class NotificationManager {
    constructor(options = {}) {
        this.options = {
            container: 'body',
            position: 'top-right', // top-left, top-right, bottom-left, bottom-right, top-center, bottom-center
            maxNotifications: 5,
            defaultDuration: 4000,
            animationDuration: 300,
            stackSpacing: 10,
            autoRemove: true,
            persistOnHover: true,
            showProgress: true,
            enableSound: false,
            theme: 'light', // light, dark, auto
            rtl: false,
            ...options
        };

        this.notifications = new Map();
        this.notificationCounter = 0;
        this.container = null;
        this.initialized = false;
        
        this.init();
    }

    init() {
        this.createContainer();
        this.setupStyles();
        this.initialized = true;
        this.debug('✅ NotificationManager inizializzato');
    }

    createContainer() {
        // Trova o crea container principale
        const targetContainer = typeof this.options.container === 'string' 
            ? document.querySelector(this.options.container)
            : this.options.container;

        if (!targetContainer) {
            throw new Error('Container per notifiche non trovato');
        }

        // Crea container notifiche se non esiste
        this.container = document.querySelector('.notification-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = `notification-container ${this.options.position} ${this.options.theme}`;
            this.container.setAttribute('role', 'region');
            this.container.setAttribute('aria-label', 'Notifiche');
            targetContainer.appendChild(this.container);
        }

        // Applica stili posizione
        this.updateContainerPosition();
    }

    updateContainerPosition() {
        const positions = {
            'top-left': { top: '20px', left: '20px', right: 'auto', bottom: 'auto' },
            'top-right': { top: '20px', right: '20px', left: 'auto', bottom: 'auto' },
            'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)', right: 'auto', bottom: 'auto' },
            'bottom-left': { bottom: '20px', left: '20px', right: 'auto', top: 'auto' },
            'bottom-right': { bottom: '20px', right: '20px', left: 'auto', top: 'auto' },
            'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)', right: 'auto', top: 'auto' }
        };

        const position = positions[this.options.position] || positions['top-right'];
        Object.assign(this.container.style, position);
    }

    setupStyles() {
        // Verifica se i CSS sono già stati aggiunti
        if (document.querySelector('#notification-manager-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'notification-manager-styles';
        styles.textContent = this.getCSS();
        document.head.appendChild(styles);
    }

    // ===== API PUBBLICA - METODI PRINCIPALI =====

    /**
     * Mostra una notifica
     * @param {string} message - Messaggio da mostrare
     * @param {string} type - Tipo: success, error, warning, info
     * @param {Object} options - Opzioni aggiuntive
     */
    show(message, type = 'info', options = {}) {
        if (!this.initialized) {
            console.warn('NotificationManager non inizializzato');
            return null;
        }

        const config = {
            message,
            type,
            duration: options.duration ?? this.options.defaultDuration,
            persistent: options.persistent ?? false,
            closable: options.closable ?? true,
            showProgress: options.showProgress ?? this.options.showProgress,
            icon: options.icon ?? this.getDefaultIcon(type),
            title: options.title,
            actions: options.actions ?? [],
            data: options.data,
            onClick: options.onClick,
            onClose: options.onClose,
            className: options.className ?? '',
            html: options.html ?? false
        };

        return this.createNotification(config);
    }

    /**
     * Notifica di successo
     */
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }

    /**
     * Notifica di errore
     */
    error(message, options = {}) {
        return this.show(message, 'error', {
            duration: 6000, // Errori durano di più
            persistent: false,
            ...options
        });
    }

    /**
     * Notifica di warning
     */
    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }

    /**
     * Notifica informativa
     */
    info(message, options = {}) {
        return this.show(message, 'info', options);
    }

    /**
     * Notifica con progress bar per operazioni async
     */
    async progress(message, promise, options = {}) {
        const notification = this.show(message, 'info', {
            persistent: true,
            showProgress: true,
            closable: false,
            icon: 'bi-arrow-clockwise spin',
            ...options
        });

        try {
            const result = await promise;
            
            // Aggiorna a successo
            this.update(notification.id, {
                message: options.successMessage || 'Operazione completata',
                type: 'success',
                icon: 'bi-check-circle',
                duration: 3000,
                persistent: false,
                closable: true
            });

            return result;

        } catch (error) {
            // Aggiorna a errore
            this.update(notification.id, {
                message: options.errorMessage || `Errore: ${error.message}`,
                type: 'error',
                icon: 'bi-exclamation-triangle',
                duration: 6000,
                persistent: false,
                closable: true
            });

            throw error;
        }
    }

    /**
     * Notifica permanente che richiede azione utente
     */
    persistent(message, type = 'warning', options = {}) {
        return this.show(message, type, {
            persistent: true,
            duration: 0,
            showProgress: false,
            ...options
        });
    }

    /**
     * Notifica con azioni (bottoni)
     */
    action(message, actions, options = {}) {
        return this.show(message, options.type || 'info', {
            actions,
            persistent: true,
            duration: 0,
            ...options
        });
    }

    /**
     * Conferma con callback
     */
    confirm(message, onConfirm, onCancel = null, options = {}) {
        const actions = [
            {
                label: options.confirmLabel || 'Conferma',
                className: 'btn btn-primary btn-sm',
                callback: () => {
                    if (onConfirm) onConfirm();
                    return true; // Chiudi notifica
                }
            },
            {
                label: options.cancelLabel || 'Annulla',
                className: 'btn btn-secondary btn-sm',
                callback: () => {
                    if (onCancel) onCancel();
                    return true; // Chiudi notifica
                }
            }
        ];

        return this.action(message, actions, {
            type: 'warning',
            title: options.title || 'Conferma',
            icon: 'bi-question-circle',
            ...options
        });
    }

    // ===== GESTIONE NOTIFICHE =====

    createNotification(config) {
        const id = `notification-${++this.notificationCounter}`;
        
        // Limita numero massimo di notifiche
        this.enforceMaxNotifications();

        // Crea elemento DOM
        const element = this.buildNotificationElement(id, config);
        
        // Salva riferimento
        const notification = {
            id,
            element,
            config,
            startTime: Date.now(),
            paused: false,
            progressTimer: null,
            removeTimer: null
        };
        
        this.notifications.set(id, notification);

        // Aggiungi al DOM con animazione
        this.container.appendChild(element);
        this.animateIn(element);

        // Setup auto-removal
        if (!config.persistent && config.duration > 0) {
            this.scheduleRemoval(notification);
        }

        // Setup eventi
        this.setupNotificationEvents(notification);

        // Riordina notifiche esistenti
        this.repositionNotifications();

        this.debug(`📢 Notifica creata: ${config.type} - ${config.message}`);
        return notification;
    }

    buildNotificationElement(id, config) {
        const element = document.createElement('div');
        element.className = `notification notification-${config.type} ${config.className}`;
        element.setAttribute('data-notification-id', id);
        element.setAttribute('role', 'alert');
        element.setAttribute('aria-live', config.type === 'error' ? 'assertive' : 'polite');

        element.innerHTML = `
            <div class="notification-content">
                ${config.icon ? `<div class="notification-icon">
                    <i class="bi ${config.icon}"></i>
                </div>` : ''}
                
                <div class="notification-body">
                    ${config.title ? `<div class="notification-title">${config.title}</div>` : ''}
                    <div class="notification-message">
                        ${config.html ? config.message : this.escapeHtml(config.message)}
                    </div>
                    
                    ${config.actions.length > 0 ? `
                        <div class="notification-actions">
                            ${config.actions.map((action, index) => `
                                <button type="button" 
                                        class="${action.className || 'btn btn-sm btn-outline-primary'} notification-action-btn"
                                        data-action-index="${index}">
                                    ${action.icon ? `<i class="bi ${action.icon}"></i> ` : ''}
                                    ${action.label}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                ${config.closable ? `
                    <button type="button" class="notification-close" aria-label="Chiudi notifica">
                        <i class="bi bi-x"></i>
                    </button>
                ` : ''}
            </div>

            ${config.showProgress && !config.persistent ? `
                <div class="notification-progress">
                    <div class="notification-progress-bar"></div>
                </div>
            ` : ''}
        `;

        return element;
    }

    setupNotificationEvents(notification) {
        const { element, config } = notification;

        // Click su notifica
        if (config.onClick) {
            element.addEventListener('click', (e) => {
                if (!e.target.closest('.notification-close, .notification-action-btn')) {
                    config.onClick(notification);
                }
            });
        }

        // Bottone chiusura
        const closeBtn = element.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.remove(notification.id);
            });
        }

        // Bottoni azioni
        const actionBtns = element.querySelectorAll('.notification-action-btn');
        actionBtns.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const action = config.actions[index];
                if (action && action.callback) {
                    const shouldClose = action.callback(notification);
                    if (shouldClose !== false) {
                        this.remove(notification.id);
                    }
                }
            });
        });

        // Hover per pause/resume
        if (this.options.persistOnHover && !config.persistent) {
            element.addEventListener('mouseenter', () => {
                this.pauseTimer(notification);
            });

            element.addEventListener('mouseleave', () => {
                this.resumeTimer(notification);
            });
        }
    }

    scheduleRemoval(notification) {
        if (notification.config.persistent) return;

        const duration = notification.config.duration;
        
        // Timer per rimozione
        notification.removeTimer = setTimeout(() => {
            this.remove(notification.id);
        }, duration);

        // Progress bar animata
        if (notification.config.showProgress) {
            const progressBar = notification.element.querySelector('.notification-progress-bar');
            if (progressBar) {
                progressBar.style.animationDuration = `${duration}ms`;
                progressBar.classList.add('active');
            }
        }
    }

    pauseTimer(notification) {
        if (notification.removeTimer) {
            clearTimeout(notification.removeTimer);
            notification.removeTimer = null;
            notification.paused = true;

            // Pausa progress bar
            const progressBar = notification.element.querySelector('.notification-progress-bar');
            if (progressBar) {
                progressBar.style.animationPlayState = 'paused';
            }
        }
    }

    resumeTimer(notification) {
        if (notification.paused && !notification.config.persistent) {
            notification.paused = false;
            
            // Calcola tempo rimanente
            const elapsed = Date.now() - notification.startTime;
            const remaining = Math.max(0, notification.config.duration - elapsed);

            if (remaining > 0) {
                notification.removeTimer = setTimeout(() => {
                    this.remove(notification.id);
                }, remaining);

                // Riprendi progress bar
                const progressBar = notification.element.querySelector('.notification-progress-bar');
                if (progressBar) {
                    progressBar.style.animationPlayState = 'running';
                }
            } else {
                this.remove(notification.id);
            }
        }
    }

    update(id, updates) {
        const notification = this.notifications.get(id);
        if (!notification) return false;

        // Aggiorna configurazione
        Object.assign(notification.config, updates);

        // Aggiorna elemento DOM
        if (updates.message) {
            const messageEl = notification.element.querySelector('.notification-message');
            if (messageEl) {
                messageEl.innerHTML = updates.html ? updates.message : this.escapeHtml(updates.message);
            }
        }

        if (updates.type) {
            notification.element.className = `notification notification-${updates.type} ${updates.className || ''}`;
        }

        if (updates.icon) {
            const iconEl = notification.element.querySelector('.notification-icon i');
            if (iconEl) {
                iconEl.className = `bi ${updates.icon}`;
            }
        }

        // Aggiorna timer se necessario
        if (updates.duration !== undefined) {
            this.clearTimers(notification);
            if (!updates.persistent && updates.duration > 0) {
                notification.startTime = Date.now();
                this.scheduleRemoval(notification);
            }
        }

        return true;
    }

    remove(id) {
        const notification = this.notifications.get(id);
        if (!notification) return false;

        this.debug(`🗑️ Rimozione notifica: ${id}`);

        // Callback onClose
        if (notification.config.onClose) {
            notification.config.onClose(notification);
        }

        // Animazione uscita
        this.animateOut(notification.element, () => {
            // Rimuovi dal DOM
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }

            // Cleanup timers
            this.clearTimers(notification);

            // Rimuovi da Map
            this.notifications.delete(id);

            // Riposiziona notifiche rimanenti
            this.repositionNotifications();
        });

        return true;
    }

    removeAll() {
        const ids = Array.from(this.notifications.keys());
        ids.forEach(id => this.remove(id));
    }

    clearTimers(notification) {
        if (notification.removeTimer) {
            clearTimeout(notification.removeTimer);
            notification.removeTimer = null;
        }
        if (notification.progressTimer) {
            clearInterval(notification.progressTimer);
            notification.progressTimer = null;
        }
    }

    enforceMaxNotifications() {
        if (this.notifications.size >= this.options.maxNotifications) {
            // Rimuovi la notifica più vecchia
            const oldestId = this.notifications.keys().next().value;
            if (oldestId) {
                this.remove(oldestId);
            }
        }
    }

    repositionNotifications() {
        const notifications = Array.from(this.notifications.values());
        notifications.forEach((notification, index) => {
            const element = notification.element;
            const spacing = index * (element.offsetHeight + this.options.stackSpacing);
            
            if (this.options.position.includes('bottom')) {
                element.style.transform = `translateY(-${spacing}px)`;
            } else {
                element.style.transform = `translateY(${spacing}px)`;
            }
        });
    }

    // ===== ANIMAZIONI =====

    animateIn(element) {
        element.style.opacity = '0';
        element.style.transform = 'translateX(100%)';
        
        requestAnimationFrame(() => {
            element.style.transition = `all ${this.options.animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
            element.style.opacity = '1';
            element.style.transform = 'translateX(0)';
        });
    }

    animateOut(element, callback) {
        element.style.transition = `all ${this.options.animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        element.style.opacity = '0';
        element.style.transform = 'translateX(100%)';
        element.style.maxHeight = '0';
        element.style.marginBottom = '0';
        element.style.paddingTop = '0';
        element.style.paddingBottom = '0';

        setTimeout(callback, this.options.animationDuration);
    }

    // ===== UTILITY METHODS =====

    getDefaultIcon(type) {
        const icons = {
            success: 'bi-check-circle',
            error: 'bi-exclamation-triangle',
            warning: 'bi-exclamation-circle',
            info: 'bi-info-circle'
        };
        return icons[type] || icons.info;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    debug(...args) {
        if (window.DEBUG_NOTIFICATIONS) {
            console.log('[NotificationManager]', ...args);
        }
    }

    // ===== CSS STYLES =====

    getCSS() {
        return `
            .notification-container {
                position: fixed;
                z-index: 10000;
                pointer-events: none;
                max-width: 400px;
                width: 100%;
            }

            .notification {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                margin-bottom: 10px;
                overflow: hidden;
                pointer-events: auto;
                position: relative;
                border-left: 4px solid #007bff;
                min-height: 60px;
                max-width: 100%;
                word-wrap: break-word;
            }

            .notification-success { border-left-color: #28a745; }
            .notification-error { border-left-color: #dc3545; }
            .notification-warning { border-left-color: #ffc107; }
            .notification-info { border-left-color: #17a2b8; }

            .notification-content {
                display: flex;
                align-items: flex-start;
                padding: 12px 16px;
                gap: 12px;
            }

            .notification-icon {
                flex-shrink: 0;
                font-size: 18px;
                margin-top: 2px;
            }

            .notification-success .notification-icon { color: #28a745; }
            .notification-error .notification-icon { color: #dc3545; }
            .notification-warning .notification-icon { color: #ffc107; }
            .notification-info .notification-icon { color: #17a2b8; }

            .notification-icon .spin {
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            .notification-body {
                flex: 1;
                min-width: 0;
            }

            .notification-title {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 4px;
                color: #333;
            }

            .notification-message {
                font-size: 13px;
                line-height: 1.4;
                color: #666;
                margin-bottom: 8px;
            }

            .notification-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }

            .notification-action-btn {
                font-size: 12px;
                padding: 4px 8px;
                border-radius: 4px;
                transition: all 0.2s ease;
            }

            .notification-close {
                position: absolute;
                top: 8px;
                right: 8px;
                background: none;
                border: none;
                width: 24px;
                height: 24px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #999;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .notification-close:hover {
                background: rgba(0, 0, 0, 0.1);
                color: #666;
            }

            .notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: rgba(0, 0, 0, 0.1);
            }

            .notification-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #007bff, #0056b3);
                width: 100%;
                transform: translateX(-100%);
                transition: transform 0.3s ease;
            }

            .notification-progress-bar.active {
                animation: progressSlide linear forwards;
            }

            @keyframes progressSlide {
                from { transform: translateX(-100%); }
                to { transform: translateX(0); }
            }

            /* Tema scuro */
            .notification-container.dark .notification {
                background: #2d3748;
                color: #e2e8f0;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }

            .notification-container.dark .notification-title {
                color: #f7fafc;
            }

            .notification-container.dark .notification-message {
                color: #a0aec0;
            }

            .notification-container.dark .notification-close {
                color: #a0aec0;
            }

            .notification-container.dark .notification-close:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #e2e8f0;
            }

            /* Responsive */
            @media (max-width: 480px) {
                .notification-container {
                    max-width: calc(100vw - 20px);
                    left: 10px !important;
                    right: 10px !important;
                    transform: none !important;
                }

                .notification-content {
                    padding: 10px 12px;
                }

                .notification-message {
                    font-size: 12px;
                }
            }
        `;
    }

    // ===== METODI STATICI =====

    static getInstance(options) {
        if (!NotificationManager._instance) {
            NotificationManager._instance = new NotificationManager(options);
        }
        return NotificationManager._instance;
    }

    static show(message, type, options) {
        return NotificationManager.getInstance().show(message, type, options);
    }

    static success(message, options) {
        return NotificationManager.getInstance().success(message, options);
    }

    static error(message, options) {
        return NotificationManager.getInstance().error(message, options);
    }

    static warning(message, options) {
        return NotificationManager.getInstance().warning(message, options);
    }

    static info(message, options) {
        return NotificationManager.getInstance().info(message, options);
    }

    static progress(message, promise, options) {
        return NotificationManager.getInstance().progress(message, promise, options);
    }

    static confirm(message, onConfirm, onCancel, options) {
        return NotificationManager.getInstance().confirm(message, onConfirm, onCancel, options);
    }
}

// Inizializzazione globale
if (typeof window !== 'undefined') {
    window.NotificationManager = NotificationManager;
    
    // Shortcut globali
    window.notify = (message, type, options) => NotificationManager.show(message, type, options);
    window.notifySuccess = (message, options) => NotificationManager.success(message, options);
    window.notifyError = (message, options) => NotificationManager.error(message, options);
    window.notifyWarning = (message, options) => NotificationManager.warning(message, options);
    window.notifyInfo = (message, options) => NotificationManager.info(message, options);
}

// Export per moduli
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}

/*
=== ESEMPI DI UTILIZZO ===

// 1. Notifiche base
NotificationManager.success('Operazione completata!');
NotificationManager.error('Errore durante il salvataggio');
NotificationManager.warning('Attenzione: dati mancanti');
NotificationManager.info('Nuova versione disponibile');

// 2. Con opzioni personalizzate
NotificationManager.show('Messaggio personalizzato', 'info', {
    duration: 8000,
    title: 'Titolo Importante',
    icon: 'bi-star',
    persistent: false
});

// 3. Notifiche con azioni
NotificationManager.action('Vuoi salvare le modifiche?', [
    {
        label: 'Salva',
        className: 'btn btn-primary btn-sm',
        callback: () => saveData()
    },
    {
        label: 'Scarta',
        className: 'btn btn-secondary btn-sm',
        callback: () => discardChanges()
    }
]);

// 4. Progress per operazioni async
NotificationManager.progress(
    'Caricamento dati...',
    fetch('/api/data').then(r => r.json()),
    {
        successMessage: 'Dati caricati con successo!',
        errorMessage: 'Errore nel caricamento'
    }
);

// 5. Conferme
NotificationManager.confirm(
    'Sei sicuro di voler eliminare questo elemento?',
    () => deleteItem(),
    () => console.log('Operazione annullata')
);

// 6. Shortcut globali (se abilitati)
notify('Messaggio rapido', 'success');
notifyError('Errore rapido');
*/