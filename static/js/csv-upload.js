/**
 * csv-upload.js
 * Gestione dell'upload e preview dei file CSV
 */

class CSVUpload {
    constructor() {
        this.csvData = null;
        this.init();
    }

    init() {
        console.log('✅ CSVUpload inizializzato');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // File input change
        const csvFileInput = document.getElementById('csvFile');
        if (csvFileInput) {
            csvFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.previewCsvFile(e.target.files[0]);
                }
            });
        }

        // Upload button
        const confirmUploadBtn = document.getElementById('confirmUploadCsv');
        if (confirmUploadBtn) {
            confirmUploadBtn.addEventListener('click', () => {
                this.uploadCsvFile();
            });
        }

        // Reset modal on close
        const uploadModal = document.getElementById('uploadCsvModal');
        if (uploadModal) {
            uploadModal.addEventListener('hidden.bs.modal', () => {
                this.resetModal();
            });
        }
    }

    previewCsvFile(file) {
        if (!file) {
            console.warn('⚠️ Nessun file selezionato');
            return;
        }

        console.log(`📄 Preview file: ${file.name}`);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csvContent = e.target.result;
                this.parseCsvContent(csvContent);
            } catch (error) {
                console.error('❌ Errore lettura file:', error);
                UIUtils.showNotification('❌ Errore nella lettura del file', 'danger');
                this.hidePreview();
            }
        };

        reader.onerror = () => {
            console.error('❌ Errore lettura file');
            UIUtils.showNotification('❌ Errore nella lettura del file', 'danger');
            this.hidePreview();
        };

        reader.readAsText(file);
    }

    parseCsvContent(csvContent) {
        try {
            const lines = csvContent.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                UIUtils.showNotification('❌ File CSV troppo corto (meno di 2 righe)', 'danger');
                this.hidePreview();
                return;
            }

            // Parse header
            const headerLine = lines[0];
            const headers = this.parseCsvLine(headerLine);

            console.log(`📊 Headers trovati: ${headers.join(', ')}`);

            // Verifica colonne richieste
            const requiredColumns = ['Ticker', 'Company', 'Sector', 'Industry'];
            const missingColumns = requiredColumns.filter(col => 
                !headers.some(header => header.toLowerCase() === col.toLowerCase())
            );

            if (missingColumns.length > 0) {
                UIUtils.showNotification(
                    `❌ Colonne mancanti nel CSV: ${missingColumns.join(', ')}`, 
                    'danger'
                );
                this.hidePreview();
                return;
            }

            // Parse data rows (max 10 per anteprima)
            const dataRows = lines.slice(1, Math.min(11, lines.length));
            const parsedRows = dataRows.map(line => this.parseCsvLine(line));

            // Store parsed data
            this.csvData = {
                headers: headers,
                rows: parsedRows,
                totalRows: lines.length - 1
            };

            // Show preview
            this.showPreview();

        } catch (error) {
            console.error('❌ Errore parsing CSV:', error);
            UIUtils.showNotification('❌ Errore nel parsing del CSV', 'danger');
            this.hidePreview();
        }
    }

    parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/^"(.+)"$/, '$1'));
                current = '';
            } else {
                current += char;
            }
        }

        // Add last field
        result.push(current.trim().replace(/^"(.+)"$/, '$1'));

        return result;
    }

    showPreview() {
        if (!this.csvData) return;

        const previewDiv = document.getElementById('csvPreview');
        const headerDiv = document.getElementById('csvPreviewHeader');
        const bodyDiv = document.getElementById('csvPreviewBody');
        const statsDiv = document.getElementById('csvStats');

        if (!previewDiv || !headerDiv || !bodyDiv || !statsDiv) {
            console.warn('⚠️ Elementi preview non trovati');
            return;
        }

        // Header
        headerDiv.innerHTML = `
            <tr>
                ${this.csvData.headers.map(col => `<th>${this.escapeHtml(col)}</th>`).join('')}
            </tr>
        `;

        // Body
        bodyDiv.innerHTML = this.csvData.rows.map(row => `
            <tr>
                ${row.map(cell => `<td>${this.escapeHtml(cell)}</td>`).join('')}
            </tr>
        `).join('');

        // Stats
        const showingRows = Math.min(10, this.csvData.totalRows);
        statsDiv.innerHTML = `
            <small class="text-muted">
                📊 Trovati <strong>${this.csvData.totalRows}</strong> ticker nel CSV
                ${this.csvData.totalRows > 10 ? ` (mostrando primi ${showingRows})` : ''}
            </small>
        `;

        previewDiv.classList.remove('d-none');

        console.log(`✅ Preview mostrata: ${this.csvData.totalRows} ticker`);
    }

    hidePreview() {
        const previewDiv = document.getElementById('csvPreview');
        if (previewDiv) {
            previewDiv.classList.add('d-none');
        }
        this.csvData = null;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async uploadCsvFile() {
        const fileInput = document.getElementById('csvFile');
        const file = fileInput?.files[0];

        if (!file) {
            UIUtils.showNotification('❌ Seleziona un file CSV', 'warning');
            return;
        }

        const downloadData = document.getElementById('downloadData')?.checked || false;
        const replaceExisting = document.getElementById('replaceExisting')?.checked || false;

        console.log(`📤 Inizio upload: ${file.name}, download=${downloadData}, replace=${replaceExisting}`);

        // Prepare form data
        const formData = new FormData();
        formData.append('csvFile', file);
        formData.append('downloadData', downloadData);
        formData.append('replaceExisting', replaceExisting);

        // UI elements
        const btn = document.getElementById('confirmUploadCsv');
        const progressDiv = document.getElementById('uploadProgress');
        const progressBar = progressDiv?.querySelector('.progress-bar');
        const statusDiv = document.getElementById('uploadStatus');

        try {
            // Show loading state
            UIUtils.setButtonLoading(btn, true, '<i class="bi bi-upload me-1"></i>Carica CSV');
            this.showProgress(true);

            if (statusDiv) statusDiv.textContent = 'Caricamento file...';
            if (progressBar) progressBar.style.width = '25%';

            UIUtils.addLogEntry('📁 Inizio upload CSV...', 'info');

            // Upload file
            const result = await TickerAPI.uploadCsv(formData);

            if (progressBar) progressBar.style.width = '75%';
            if (statusDiv) statusDiv.textContent = 'Elaborazione dati...';

            if (result.status === 'success') {
                if (progressBar) progressBar.style.width = '100%';
                if (statusDiv) statusDiv.textContent = 'Upload completato!';

                UIUtils.showNotification(`✅ ${result.message}`, 'success');
                
                // Log dettagliato
                const summary = result.summary;
                if (summary) {
                    UIUtils.addLogEntry(
                        `📊 CSV importato: ${summary.total_tickers} ticker processati, ` +
                        `${summary.added_tickers} aggiunti, ${summary.updated_tickers} aggiornati, ` +
                        `${summary.skipped_tickers} saltati, ${summary.error_count} errori`,
                        'success'
                    );
                } else {
                    UIUtils.addLogEntry(`📊 ${result.message}`, 'success');
                }

                // Show details if available
                if (result.details && result.details.length > 0) {
                    this.showUploadDetails(result.details);
                }

                // Close modal and refresh after delay
                setTimeout(() => {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('uploadCsvModal'));
                    if (modal) modal.hide();
                    setTimeout(() => location.reload(), 500);
                }, 3000);

            } else {
                UIUtils.showNotification(`❌ ${result.message}`, 'danger');
                UIUtils.addLogEntry(`❌ Errore upload CSV: ${result.message}`, 'error');
            }

        } catch (error) {
            console.error('❌ Errore upload:', error);
            UIUtils.showNotification('❌ Errore durante l\'upload', 'danger');
            UIUtils.addLogEntry(`❌ Errore upload: ${error.message}`, 'error');
        } finally {
            // Restore UI
            UIUtils.setButtonLoading(btn, false);
            
            setTimeout(() => {
                this.showProgress(false);
            }, 2000);
        }
    }

    showProgress(show) {
        const progressDiv = document.getElementById('uploadProgress');
        const progressBar = progressDiv?.querySelector('.progress-bar');
        
        if (show) {
            if (progressDiv) progressDiv.classList.remove('d-none');
        } else {
            if (progressDiv) progressDiv.classList.add('d-none');
            if (progressBar) progressBar.style.width = '0%';
        }
    }

    showUploadDetails(details) {
        console.log('📋 Dettagli upload:', details);

        const successCount = details.filter(d => d.status === 'success').length;
        const errorCount = details.filter(d => d.status === 'error').length;
        const warningCount = details.filter(d => d.status === 'warning').length;

        let detailsHtml = `
            <div class="mt-3">
                <h6>Dettagli Upload:</h6>
                <div class="mb-2">
                    <span class="badge bg-success me-1">${successCount} successi</span>
                    <span class="badge bg-warning me-1">${warningCount} avvisi</span>
                    <span class="badge bg-danger">${errorCount} errori</span>
                </div>
        `;

        if (errorCount > 0) {
            const errors = details.filter(d => d.status === 'error').slice(0, 5);
            detailsHtml += `
                <div class="alert alert-danger">
                    <strong>Errori:</strong><br>
                    ${errors.map(e => `• ${e.ticker}: ${e.message}`).join('<br>')}
                    ${errorCount > 5 ? `<br>... e altri ${errorCount - 5} errori` : ''}
                </div>
            `;
        }

        detailsHtml += '</div>';

        // Append to progress div
        const progressDiv = document.getElementById('uploadProgress');
        if (progressDiv) {
            progressDiv.insertAdjacentHTML('beforeend', detailsHtml);
        }
    }

    resetModal() {
        console.log('🔄 Reset modal CSV');

        // Reset file input
        const fileInput = document.getElementById('csvFile');
        if (fileInput) {
            fileInput.value = '';
        }

        // Reset checkboxes
        const downloadData = document.getElementById('downloadData');
        const replaceExisting = document.getElementById('replaceExisting');
        if (downloadData) downloadData.checked = false;
        if (replaceExisting) replaceExisting.checked = false;

        // Hide preview and progress
        this.hidePreview();
        this.showProgress(false);

        // Clear any details
        const progressDiv = document.getElementById('uploadProgress');
        if (progressDiv) {
            const extraContent = progressDiv.querySelectorAll('.mt-3');
            extraContent.forEach(el => el.remove());
        }

        // Reset data
        this.csvData = null;
    }

    // Public method for external use
    openModal() {
        const modal = new bootstrap.Modal(document.getElementById('uploadCsvModal'));
        modal.show();
    }
}

// Export per uso esterno
window.CSVUploadInstance = null;

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('uploadCsvModal')) {
        window.CSVUploadInstance = new CSVUpload();
    }
});

console.log('✅ CSVUpload module caricato');