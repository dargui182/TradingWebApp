/**
 * PlotlyChart.js
 * Componente grafico universale basato su Plotly.js
 * Estende BaseComponent con funzionalità avanzate per grafici
 */

class PlotlyChart extends BaseComponent {
    constructor(containerId, options = {}) {
        super(containerId, options);
        
        // Stato interno del grafico
        this.plotlyInstance = null;
        this.chartData = null;
        this.isFullscreen = false;
        this.originalDimensions = null;
        this.resizeObserver = null;
        
        // Cache per performance
        this.renderCache = new Map();
        this.layoutCache = null;
        
        // Event handlers bound
        this.boundHandlers = {
            resize: this.handleResize.bind(this),
            fullscreenChange: this.handleFullscreenChange.bind(this),
            plotlyClick: this.handlePlotlyClick.bind(this),
            plotlyHover: this.handlePlotlyHover.bind(this),
            plotlyRelayout: this.handlePlotlyRelayout.bind(this)
        };
    }

    get defaultOptions() {
        return {
            ...super.defaultOptions,
            
            // Configurazione Plotly
            plotly: {
                responsive: true,
                displayModeBar: true,
                displaylogo: false,
                toImageButtonOptions: {
                    format: 'png',
                    filename: 'chart',
                    height: 800,
                    width: 1200,
                    scale: 1
                }
            },
            
            // Toolbar personalizzata
            toolbar: {
                enabled: true,
                position: 'top-right', // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
                buttons: [
                    'zoom', 'pan', 'select', 'reset', 'export', 'fullscreen'
                ],
                customButtons: [],
                style: 'modern' // 'modern', 'classic', 'minimal'
            },
            
            // Leggenda interattiva
            legend: {
                enabled: true,
                interactive: true,
                position: 'right', // 'left', 'right', 'top', 'bottom'
                collapsible: true,
                showVisibility: true,
                showValues: false
            },
            
            // Gestione fullscreen
            fullscreen: {
                enabled: true,
                button: true,
                escapeKey: true,
                clickOutside: false,
                dimensions: 'auto' // 'auto', 'viewport', { width: X, height: Y }
            },
            
            // Dimensioni e layout
            layout: {
                autosize: true,
                responsive: true,
                width: null,
                height: 600,
                margin: { l: 60, r: 60, t: 80, b: 80 },
                font: { family: 'Arial, sans-serif', size: 12 },
                plot_bgcolor: 'white',
                paper_bgcolor: 'white'
            },
            
            // Configurazione performance
            performance: {
                enableWebGL: false,
                maxDataPoints: 10000,
                simplifyOnZoom: true,
                lazyLoad: false,
                throttleResize: 100
            },
            
            // Temi
            theme: 'light', // 'light', 'dark', 'auto'
            
            // Export
            export: {
                enabled: true,
                formats: ['png', 'svg', 'pdf', 'html'],
                defaultFormat: 'png',
                filename: 'chart'
            },
            
            // Callbacks
            onDataChanged: null,
            onFullscreenToggle: null,
            onExport: null,
            onClick: null,
            onHover: null,
            onRelayout: null
        };
    }

    async beforeRender() {
        // Verifica disponibilità Plotly
        if (typeof Plotly === 'undefined') {
            throw new Error('Plotly.js non disponibile. Assicurati che sia caricato prima di questo componente.');
        }
        
        // Setup ResizeObserver per performance ottimali
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(
                this.debounce(this.boundHandlers.resize, this.options.performance.throttleResize)
            );
        }
        
        // Applica tema
        this.applyTheme();
        
        // Setup dimensioni iniziali
        this.setupInitialDimensions();
    }

    async render() {
        this.hideError();
        
        // Template principale del grafico
        this.container.innerHTML = this.getChartTemplate();
        
        // Rendering componenti
        await this.renderToolbar();
        await this.renderChart();
        await this.renderLegend();
        
        // Setup observers
        this.setupObservers();
    }

    getChartTemplate() {
        return `
            <div class="plotly-chart-container" data-theme="${this.options.theme}">
                <!-- Toolbar superiore -->
                ${this.options.toolbar.enabled ? `
                    <div class="plotly-toolbar ${this.options.toolbar.position}">
                        <!-- Toolbar renderizzata dinamicamente -->
                    </div>
                ` : ''}
                
                <!-- Container principale grafico -->
                <div class="plotly-chart-wrapper">
                    <div class="plotly-chart-main" id="${this.containerId}_chart">
                        <!-- Grafico Plotly renderizzato qui -->
                    </div>
                    
                    <!-- Loading overlay -->
                    <div class="plotly-loading-overlay">
                        <div class="loading-spinner">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Caricamento grafico...</span>
                            </div>
                            <div class="loading-text mt-2">Rendering chart...</div>
                        </div>
                    </div>
                </div>
                
                <!-- Leggenda laterale (se abilitata) -->
                ${this.options.legend.enabled && this.options.legend.position !== 'plotly' ? `
                    <div class="plotly-legend-container ${this.options.legend.position}">
                        <!-- Leggenda renderizzata dinamicamente -->
                    </div>
                ` : ''}
                
                <!-- Fullscreen overlay -->
                <div class="plotly-fullscreen-overlay" style="display: none;">
                    <div class="fullscreen-header">
                        <div class="fullscreen-title">Chart Fullscreen</div>
                        <button class="btn btn-outline-light btn-sm fullscreen-close">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div class="fullscreen-chart-container">
                        <!-- Chart in fullscreen -->
                    </div>
                </div>
            </div>
        `;
    }

    async renderToolbar() {
        if (!this.options.toolbar.enabled) return;
        
        const toolbar = this.$('.plotly-toolbar');
        if (!toolbar) return;

        const buttons = this.getToolbarButtons();
        toolbar.innerHTML = `
            <div class="toolbar-group">
                ${buttons.map(button => this.renderToolbarButton(button)).join('')}
            </div>
        `;
    }

    getToolbarButtons() {
        const baseButtons = {
            zoom: {
                icon: 'bi-search-plus',
                title: 'Zoom',
                action: 'zoom',
                type: 'toggle'
            },
            pan: {
                icon: 'bi-arrows-move',
                title: 'Pan',
                action: 'pan',
                type: 'toggle'
            },
            select: {
                icon: 'bi-bounding-box',
                title: 'Selezione',
                action: 'select',
                type: 'toggle'
            },
            reset: {
                icon: 'bi-arrow-clockwise',
                title: 'Reset Zoom',
                action: 'reset',
                type: 'button'
            },
            export: {
                icon: 'bi-download',
                title: 'Esporta',
                action: 'export',
                type: 'dropdown',
                items: this.options.export.formats.map(format => ({
                    label: format.toUpperCase(),
                    action: `export-${format}`,
                    icon: `bi-file-earmark-${format === 'pdf' ? 'pdf' : 'image'}`
                }))
            },
            fullscreen: {
                icon: 'bi-fullscreen',
                title: 'Fullscreen',
                action: 'fullscreen',
                type: 'button'
            }
        };

        return this.options.toolbar.buttons
            .map(buttonName => baseButtons[buttonName])
            .filter(Boolean)
            .concat(this.options.toolbar.customButtons);
    }

    renderToolbarButton(button) {
        if (button.type === 'dropdown') {
            return `
                <div class="btn-group" role="group">
                    <button type="button" 
                            class="btn btn-outline-secondary btn-sm dropdown-toggle plotly-toolbar-btn"
                            data-bs-toggle="dropdown" 
                            data-action="${button.action}"
                            title="${button.title}">
                        <i class="bi ${button.icon}"></i>
                    </button>
                    <ul class="dropdown-menu">
                        ${button.items.map(item => `
                            <li>
                                <button class="dropdown-item plotly-toolbar-action" 
                                        data-action="${item.action}">
                                    <i class="bi ${item.icon} me-2"></i>${item.label}
                                </button>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else {
            return `
                <button type="button" 
                        class="btn btn-outline-secondary btn-sm plotly-toolbar-btn ${button.type === 'toggle' ? 'toggle-btn' : ''}"
                        data-action="${button.action}"
                        data-toggle="${button.type === 'toggle'}"
                        title="${button.title}">
                    <i class="bi ${button.icon}"></i>
                </button>
            `;
        }
    }

    async renderChart() {
        const chartDiv = this.$('.plotly-chart-main');
        if (!chartDiv || !this.chartData) {
            return;
        }

        try {
            this.showChartLoading(true);
            
            // Prepara configurazione Plotly
            const { data, layout, config } = this.prepareChartConfig();
            
            // Rendering Plotly
            await Plotly.newPlot(chartDiv, data, layout, config);
            
            // Salva riferimento
            this.plotlyInstance = chartDiv;
            
            // Setup eventi Plotly
            this.setupPlotlyEvents();
            
            this.showChartLoading(false);
            this.emit('chartRendered', { data, layout, config });
            
        } catch (error) {
            this.showChartLoading(false);
            this.showError('Errore durante il rendering del grafico', error);
            throw error;
        }
    }

    prepareChartConfig() {
        if (!this.chartData) {
            throw new Error('Nessun dato disponibile per il grafico');
        }

        // Data processing
        const data = this.processChartData(this.chartData);
        
        // Layout configuration
        const layout = this.buildLayout();
        
        // Plotly config
        const config = {
            ...this.options.plotly,
            modeBarButtonsToRemove: this.getModeBarButtonsToRemove(),
            modeBarButtonsToAdd: this.getModeBarButtonsToAdd()
        };

        return { data, layout, config };
    }

    processChartData(rawData) {
        // Se i dati sono già processati per Plotly, restituiscili
        if (Array.isArray(rawData) && rawData[0]?.type) {
            return rawData;
        }
        
        // Altrimenti, converte formato generico in formato Plotly
        return this.convertToPlotlyFormat(rawData);
    }

    convertToPlotlyFormat(data) {
        // Implementazione conversione dati generici -> Plotly
        // Questa funzione può essere sovrascritta nelle classi figlie
        if (data.series) {
            return data.series;
        }
        
        // Formato candlestick di default per financial data
        if (data.ohlc) {
            return [{
                type: 'candlestick',
                x: data.dates,
                open: data.ohlc.open,
                high: data.ohlc.high,
                low: data.ohlc.low,
                close: data.ohlc.close,
                name: data.symbol || 'Price'
            }];
        }
        
        return [];
    }

    buildLayout() {
        const baseLayout = {
            ...this.options.layout,
            
            // Dimensioni responsive
            autosize: true,
            
            // Margini ottimizzati
            margin: this.calculateOptimalMargins(),
            
            // Font e stili
            font: {
                ...this.options.layout.font,
                color: this.getThemeColor('text')
            },
            
            // Background colors
            plot_bgcolor: this.getThemeColor('plotBackground'),
            paper_bgcolor: this.getThemeColor('paperBackground'),
            
            // Griglia e assi
            xaxis: this.buildXAxisConfig(),
            yaxis: this.buildYAxisConfig(),
            
            // Leggenda
            showlegend: this.options.legend.position === 'plotly',
            legend: this.options.legend.position === 'plotly' ? this.buildLegendConfig() : undefined,
            
            // Hover mode
            hovermode: 'x unified',
            
            // Modebar
            modebar: {
                orientation: 'v',
                bgcolor: 'rgba(255,255,255,0.8)',
                color: '#666',
                activecolor: '#007bff'
            }
        };

        return this.mergeLayoutWithCache(baseLayout);
    }

    buildXAxisConfig() {
        return {
            gridcolor: this.getThemeColor('grid'),
            linecolor: this.getThemeColor('axis'),
            tickcolor: this.getThemeColor('axis'),
            tickfont: { color: this.getThemeColor('text') },
            title: { font: { color: this.getThemeColor('text') } }
        };
    }

    buildYAxisConfig() {
        return {
            gridcolor: this.getThemeColor('grid'),
            linecolor: this.getThemeColor('axis'),
            tickcolor: this.getThemeColor('axis'),
            tickfont: { color: this.getThemeColor('text') },
            title: { font: { color: this.getThemeColor('text') } }
        };
    }

    buildLegendConfig() {
        return {
            bgcolor: 'rgba(255,255,255,0.8)',
            bordercolor: '#ddd',
            borderwidth: 1,
            font: { color: this.getThemeColor('text') }
        };
    }

    async renderLegend() {
        if (!this.options.legend.enabled || this.options.legend.position === 'plotly') {
            return;
        }

        const legendContainer = this.$('.plotly-legend-container');
        if (!legendContainer || !this.chartData) return;

        // Rendering leggenda personalizzata
        const legendItems = this.extractLegendItems();
        
        legendContainer.innerHTML = `
            <div class="custom-legend">
                <div class="legend-header">
                    <h6 class="legend-title">Leggenda</h6>
                    ${this.options.legend.collapsible ? `
                        <button class="btn btn-sm legend-toggle">
                            <i class="bi bi-chevron-up"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="legend-content">
                    ${legendItems.map(item => this.renderLegendItem(item)).join('')}
                </div>
            </div>
        `;
    }

    extractLegendItems() {
        if (!this.chartData) return [];
        
        // Estrae elementi leggenda dai dati del grafico
        const data = Array.isArray(this.chartData) ? this.chartData : this.chartData.series || [];
        
        return data.map((trace, index) => ({
            name: trace.name || `Serie ${index + 1}`,
            color: trace.line?.color || trace.marker?.color || this.getDefaultColor(index),
            visible: trace.visible !== false,
            type: trace.type || 'scatter',
            index
        }));
    }

    renderLegendItem(item) {
        return `
            <div class="legend-item ${item.visible ? 'visible' : 'hidden'}" 
                 data-trace-index="${item.index}">
                <div class="legend-marker" style="background-color: ${item.color}"></div>
                <span class="legend-label">${item.name}</span>
                ${this.options.legend.showVisibility ? `
                    <button class="btn btn-sm legend-visibility-toggle" 
                            data-visible="${item.visible}">
                        <i class="bi ${item.visible ? 'bi-eye' : 'bi-eye-slash'}"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }

    setupEventListeners() {
        // Toolbar events
        this.addEventListener('.plotly-toolbar-btn', 'click', this.handleToolbarClick.bind(this));
        this.addEventListener('.plotly-toolbar-action', 'click', this.handleToolbarAction.bind(this));
        
        // Legend events
        this.addEventListener('.legend-item', 'click', this.handleLegendItemClick.bind(this));
        this.addEventListener('.legend-visibility-toggle', 'click', this.handleLegendVisibilityToggle.bind(this));
        this.addEventListener('.legend-toggle', 'click', this.handleLegendToggle.bind(this));
        
        // Fullscreen events
        this.addEventListener('.fullscreen-close', 'click', this.exitFullscreen.bind(this));
        document.addEventListener('fullscreenchange', this.boundHandlers.fullscreenChange);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isFullscreen && this.options.fullscreen.escapeKey) {
                this.exitFullscreen();
            }
        });
        
        // Window resize
        window.addEventListener('resize', this.boundHandlers.resize);
    }

    setupPlotlyEvents() {
        if (!this.plotlyInstance) return;

        // Plotly events
        this.plotlyInstance.on('plotly_click', this.boundHandlers.plotlyClick);
        this.plotlyInstance.on('plotly_hover', this.boundHandlers.plotlyHover);
        this.plotlyInstance.on('plotly_relayout', this.boundHandlers.plotlyRelayout);
    }

    setupObservers() {
        if (this.resizeObserver) {
            this.resizeObserver.observe(this.container);
        }
    }

    // ===== EVENT HANDLERS =====

    handleToolbarClick(e) {
        const action = e.currentTarget.dataset.action;
        const isToggle = e.currentTarget.dataset.toggle === 'true';
        
        if (isToggle) {
            e.currentTarget.classList.toggle('active');
        }
        
        this.executeToolbarAction(action, e.currentTarget);
    }

    handleToolbarAction(e) {
        const action = e.currentTarget.dataset.action;
        this.executeToolbarAction(action, e.currentTarget);
    }

    executeToolbarAction(action, button) {
        switch (action) {
            case 'zoom':
                this.setMode('zoom');
                break;
            case 'pan':
                this.setMode('pan');
                break;
            case 'select':
                this.setMode('select');
                break;
            case 'reset':
                this.resetZoom();
                break;
            case 'fullscreen':
                this.toggleFullscreen();
                break;
            case 'export-png':
            case 'export-svg':
            case 'export-pdf':
            case 'export-html':
                const format = action.split('-')[1];
                this.exportChart(format);
                break;
            default:
                this.handleCustomAction(action, button);
        }
    }

    handleLegendItemClick(e) {
        if (e.target.classList.contains('legend-visibility-toggle')) {
            return; // Gestito da handleLegendVisibilityToggle
        }
        
        const traceIndex = parseInt(e.currentTarget.dataset.traceIndex);
        this.highlightTrace(traceIndex);
    }

    handleLegendVisibilityToggle(e) {
        e.stopPropagation();
        
        const traceIndex = parseInt(e.currentTarget.closest('.legend-item').dataset.traceIndex);
        const currentlyVisible = e.currentTarget.dataset.visible === 'true';
        
        this.toggleTraceVisibility(traceIndex, !currentlyVisible);
    }

    handleLegendToggle(e) {
        const content = this.$('.legend-content');
        const icon = e.currentTarget.querySelector('i');
        
        content.classList.toggle('collapsed');
        icon.classList.toggle('bi-chevron-up');
        icon.classList.toggle('bi-chevron-down');
    }

    handleResize() {
        if (this.plotlyInstance && !this.isFullscreen) {
            this.resizeChart();
        }
    }

    handleFullscreenChange() {
        const isFullscreen = !!document.fullscreenElement;
        if (isFullscreen !== this.isFullscreen) {
            this.isFullscreen = isFullscreen;
            this.handleFullscreenStateChange();
        }
    }

    handlePlotlyClick(data) {
        if (this.options.onClick) {
            this.options.onClick(data);
        }
        this.emit('chartClick', data);
    }

    handlePlotlyHover(data) {
        if (this.options.onHover) {
            this.options.onHover(data);
        }
        this.emit('chartHover', data);
    }

    handlePlotlyRelayout(eventData) {
        if (this.options.onRelayout) {
            this.options.onRelayout(eventData);
        }
        this.emit('chartRelayout', eventData);
    }

    // ===== API PUBBLICA =====

    setData(data) {
        this.chartData = data;
        if (this.isReady) {
            this.renderChart();
        }
        
        if (this.options.onDataChanged) {
            this.options.onDataChanged(data);
        }
        this.emit('dataChanged', data);
    }

    updateData(newData) {
        this.setData(newData);
    }

    async addTrace(trace) {
        if (this.plotlyInstance) {
            await Plotly.addTraces(this.plotlyInstance, trace);
            this.emit('traceAdded', trace);
        }
    }

    async removeTrace(index) {
        if (this.plotlyInstance) {
            await Plotly.deleteTraces(this.plotlyInstance, index);
            this.emit('traceRemoved', index);
        }
    }

    async updateLayout(updates) {
        if (this.plotlyInstance) {
            await Plotly.relayout(this.plotlyInstance, updates);
            this.emit('layoutUpdated', updates);
        }
    }

    setMode(mode) {
        const config = {};
        
        switch (mode) {
            case 'zoom':
                config.dragmode = 'zoom';
                break;
            case 'pan':
                config.dragmode = 'pan';
                break;
            case 'select':
                config.dragmode = 'select';
                break;
        }
        
        if (this.plotlyInstance) {
            Plotly.relayout(this.plotlyInstance, config);
        }
    }

    resetZoom() {
        if (this.plotlyInstance) {
            Plotly.relayout(this.plotlyInstance, {
                'xaxis.autorange': true,
                'yaxis.autorange': true
            });
        }
    }

    toggleFullscreen() {
        if (this.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    async enterFullscreen() {
        try {
            this.originalDimensions = {
                width: this.container.offsetWidth,
                height: this.container.offsetHeight
            };
            
            await this.container.requestFullscreen();
            this.isFullscreen = true;
            
            // Ridimensiona chart per fullscreen
            setTimeout(() => this.resizeChart(), 100);
            
            if (this.options.onFullscreenToggle) {
                this.options.onFullscreenToggle(true);
            }
            this.emit('fullscreenEntered');
            
        } catch (error) {
            console.error('Errore entrando in fullscreen:', error);
        }
    }

    async exitFullscreen() {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
            
            this.isFullscreen = false;
            
            // Ripristina dimensioni originali
            setTimeout(() => this.resizeChart(), 100);
            
            if (this.options.onFullscreenToggle) {
                this.options.onFullscreenToggle(false);
            }
            this.emit('fullscreenExited');
            
        } catch (error) {
            console.error('Errore uscendo da fullscreen:', error);
        }
    }

    async exportChart(format = 'png') {
        try {
            this.showChartLoading(true, 'Esportazione in corso...');
            
            const filename = `${this.options.export.filename}_${new Date().toISOString().split('T')[0]}`;
            
            const exportOptions = {
                format,
                filename,
                width: 1200,
                height: 800,
                scale: 1
            };
            
            await Plotly.downloadImage(this.plotlyInstance, exportOptions);
            
            this.showChartLoading(false);
            
            if (this.options.onExport) {
                this.options.onExport(format, filename);
            }
            this.emit('chartExported', { format, filename });
            
        } catch (error) {
            this.showChartLoading(false);
            this.showError('Errore durante l\'esportazione', error);
        }
    }

    resizeChart() {
        if (this.plotlyInstance) {
            Plotly.Plots.resize(this.plotlyInstance);
        }
    }

    toggleTraceVisibility(index, visible) {
        if (this.plotlyInstance) {
            const update = { visible: visible };
            Plotly.restyle(this.plotlyInstance, update, index);
            
            // Aggiorna UI leggenda
            const legendItem = this.$(`.legend-item[data-trace-index="${index}"]`);
            if (legendItem) {
                legendItem.classList.toggle('visible', visible);
                legendItem.classList.toggle('hidden', !visible);
                
                const toggle = legendItem.querySelector('.legend-visibility-toggle');
                if (toggle) {
                    toggle.dataset.visible = visible;
                    const icon = toggle.querySelector('i');
                    icon.className = `bi ${visible ? 'bi-eye' : 'bi-eye-slash'}`;
                }
            }
        }
    }

    highlightTrace(index) {
        // Implementazione highlight temporaneo di una traccia
        if (this.plotlyInstance) {
            // Logica per evidenziare temporaneamente una traccia
            console.log(`Highlighting trace ${index}`);
        }
    }

    // ===== UTILITY METHODS =====

    showChartLoading(show, message = 'Caricamento grafico...') {
        const overlay = this.$('.plotly-loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
            if (show && message) {
                const text = overlay.querySelector('.loading-text');
                if (text) text.textContent = message;
            }
        }
    }

    applyTheme() {
        const theme = this.options.theme === 'auto' ? this.detectSystemTheme() : this.options.theme;
        this.container?.setAttribute('data-theme', theme);
    }

    detectSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    getThemeColor(colorKey) {
        const themes = {
            light: {
                text: '#333',
                plotBackground: 'white',
                paperBackground: 'white',
                grid: '#f0f0f0',
                axis: '#ccc'
            },
            dark: {
                text: '#fff',
                plotBackground: '#2d3748',
                paperBackground: '#1a202c',
                grid: '#4a5568',
                axis: '#718096'
            }
        };
        
        const currentTheme = this.container?.getAttribute('data-theme') || 'light';
        return themes[currentTheme]?.[colorKey] || themes.light[colorKey];
    }

    getDefaultColor(index) {
        const colors = [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
            '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
        ];
        return colors[index % colors.length];
    }

    calculateOptimalMargins() {
        const base = this.options.layout.margin;
        
        // Adjust margins based on toolbar and legend positions
        const margins = { ...base };
        
        if (this.options.toolbar.enabled) {
            if (this.options.toolbar.position.includes('top')) {
                margins.t += 40;
            }
        }
        
        if (this.options.legend.enabled && this.options.legend.position !== 'plotly') {
            if (this.options.legend.position === 'right') {
                margins.r += 200;
            } else if (this.options.legend.position === 'left') {
                margins.l += 200;
            }
        }
        
        return margins;
    }

    mergeLayoutWithCache(layout) {
        // Merge con layout cache per performance
        if (this.layoutCache) {
            return { ...this.layoutCache, ...layout };
        }
        return layout;
    }

    setupInitialDimensions() {
        if (this.options.layout.width) {
            this.container.style.width = `${this.options.layout.width}px`;
        }
        if (this.options.layout.height) {
            this.container.style.height = `${this.options.layout.height}px`;
        }
    }

    getModeBarButtonsToRemove() {
        // Rimuovi bottoni Plotly di default se abbiamo toolbar personalizzata
        if (this.options.toolbar.enabled) {
            return ['pan2d', 'zoom2d', 'select2d', 'lasso2d', 'autoScale2d', 'resetScale2d'];
        }
        return [];
    }

    getModeBarButtonsToAdd() {
        // Aggiungi bottoni personalizzati se necessario
        return [];
    }

    handleCustomAction(action, button) {
        // Override nelle classi figlie per azioni personalizzate
        this.emit('customAction', { action, button });
    }

    handleFullscreenStateChange() {
        this.container.classList.toggle('fullscreen-active', this.isFullscreen);
        
        // Update toolbar button state
        const fullscreenBtn = this.$('.plotly-toolbar-btn[data-action="fullscreen"] i');
        if (fullscreenBtn) {
            fullscreenBtn.className = `bi ${this.isFullscreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`;
        }
    }

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
    }

    beforeDestroy() {
        // Cleanup Plotly instance
        if (this.plotlyInstance) {
            Plotly.purge(this.plotlyInstance);
        }
        
        // Cleanup observers
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Cleanup event listeners
        window.removeEventListener('resize', this.boundHandlers.resize);
        document.removeEventListener('fullscreenchange', this.boundHandlers.fullscreenChange);
        
        // Exit fullscreen if active
        if (this.isFullscreen) {
            this.exitFullscreen();
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlotlyChart;
} else {
    window.PlotlyChart = PlotlyChart;
}