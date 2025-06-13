from flask import Flask, render_template, request, jsonify, flash, redirect, url_for
from datetime import datetime
import os
import logging

# Import del modulo personalizzato per gestione ticker
from TickerDataManager import TickerDataManager

# Configurazione dell'applicazione
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this'  # Cambia questa chiave in produzione
app.config['DEBUG'] = True

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inizializza il manager per i dati ticker
ticker_manager = TickerDataManager()

# Dati di esempio per la dashboard principale
sample_data = {
    'total_users': 1234,
    'total_sales': 45678.90,
    'active_sessions': 89,
    'conversion_rate': 12.5
}

recent_activities = [
    {'action': 'Nuovo utente registrato', 'time': '2 minuti fa', 'type': 'success'},
    {'action': 'Ordine completato #1234', 'time': '5 minuti fa', 'type': 'info'},
    {'action': 'Errore nel sistema pagamenti', 'time': '10 minuti fa', 'type': 'warning'},
    {'action': 'Backup completato', 'time': '1 ora fa', 'type': 'success'}
]

# === ROUTES PRINCIPALI ===

@app.route('/')
def dashboard():
    """Dashboard principale"""
    return render_template('dashboard.html', 
                         title='Dashboard',
                         stats=sample_data,
                         activities=recent_activities,
                         current_time=datetime.now())

@app.route('/analytics')
def analytics():
    """Pagina Analytics (placeholder)"""
    return render_template('analytics.html', title='Analytics')

@app.route('/users')
def users():
    """Gestione utenti (placeholder)"""
    return render_template('users.html', title='Gestione Utenti')

@app.route('/settings')
def settings():
    """Impostazioni (placeholder)"""
    return render_template('settings.html', title='Impostazioni')

@app.route('/data')
def data_management():
    """Gestione dati finanziari"""
    config = ticker_manager.load_ticker_config()
    ticker_status = ticker_manager.get_ticker_status()
    
    return render_template('data.html', 
                         title='Gestione Dati', 
                         tickers=config['tickers'],
                         ticker_status=ticker_status,
                         last_config_update=config.get('last_updated'))

# === API ENDPOINTS PER GESTIONE DATI ===

@app.route('/api/stats')
def api_stats():
    """API endpoint per statistiche dashboard"""
    return jsonify(sample_data)

@app.route('/api/activities')
def api_activities():
    """API endpoint per attività recenti"""
    return jsonify(recent_activities)

@app.route('/api/tickers', methods=['GET'])
def api_get_tickers():
    """API per ottenere la lista dei ticker con gestione errori"""
    try:
        config = ticker_manager.load_ticker_config()
        return jsonify(config)
    except Exception as e:
        logger.error(f"Errore nel recuperare configurazione ticker: {e}")
        # Ritorna configurazione vuota di default
        return jsonify({'tickers': [], 'last_updated': None})
    
@app.route('/api/tickers', methods=['POST'])
def api_add_ticker():
    """API per aggiungere un nuovo ticker"""
    data = request.get_json()
    ticker = data.get('ticker', '').upper().strip()
    
    if not ticker:
        return jsonify({'status': 'error', 'message': 'Ticker non valido'}), 400
    
    result = ticker_manager.add_ticker(ticker)
    
    if result['status'] == 'error':
        return jsonify(result), 400
    elif result['status'] == 'warning':
        return jsonify(result), 400
    else:
        return jsonify(result)

@app.route('/api/tickers/<ticker>', methods=['DELETE'])
def api_remove_ticker(ticker):
    """API per rimuovere un ticker"""
    result = ticker_manager.remove_ticker(ticker)
    
    if result['status'] == 'error':
        return jsonify(result), 404
    else:
        return jsonify(result)

@app.route('/api/tickers/status')
def api_ticker_status():
    """API per ottenere lo stato di tutti i ticker con gestione errori"""
    try:
        status = ticker_manager.get_ticker_status()
        return jsonify(status)
    except Exception as e:
        logger.error(f"Errore nel recuperare status ticker: {e}")
        # Ritorna una lista vuota in caso di errore per evitare crash
        return jsonify([])

@app.route('/api/download/<ticker>')
def api_download_ticker(ticker):
    """API per scaricare/aggiornare i dati di un ticker"""
    ticker = ticker.upper()
    config = ticker_manager.load_ticker_config()
    
    if ticker not in config['tickers']:
        return jsonify({'status': 'error', 'message': f'Ticker {ticker} non configurato'}), 404
    
    result = ticker_manager.update_ticker_data(ticker)
    
    # Aggiungi all'activity feed
    if result['status'] == 'success':
        recent_activities.insert(0, {
            'action': f'Dati {ticker} aggiornati ({result["records"]} record, 2 versioni)',
            'time': 'Adesso',
            'type': 'success'
        })
    elif result['status'] == 'error':
        recent_activities.insert(0, {
            'action': f'Errore download {ticker}: {result["message"]}',
            'time': 'Adesso',
            'type': 'warning'
        })
    
    # Mantieni solo le ultime 10 attività
    recent_activities[:] = recent_activities[:10]
    
    return jsonify(result)

@app.route('/api/download/all')
def api_download_all():
    """API per scaricare/aggiornare tutti i ticker"""
    config = ticker_manager.load_ticker_config()
    results = []
    
    for ticker in config['tickers']:
        result = ticker_manager.update_ticker_data(ticker)
        result['ticker'] = ticker
        results.append(result)
        
        # Aggiungi attività significative
        if result['status'] == 'success' and result['records'] > 0:
            recent_activities.insert(0, {
                'action': f'Dati {ticker} aggiornati ({result["records"]} record, 2 versioni)',
                'time': 'Adesso',
                'type': 'success'
            })
    
    # Mantieni solo le ultime 10 attività
    recent_activities[:] = recent_activities[:10]
    
    success_count = sum(1 for r in results if r['status'] == 'success' and r['records'] > 0)
    total_records = sum(r['records'] for r in results if r['status'] == 'success')
    
    return jsonify({
        'status': 'success',
        'results': results,
        'summary': {
            'total_tickers': len(config['tickers']),
            'updated_tickers': success_count,
            'total_new_records': total_records
        }
    })

@app.route('/api/test/connection')
def api_test_connection():
    """API per testare la connessione a Yahoo Finance"""
    result = ticker_manager.test_connection()
    return jsonify(result)

@app.route('/api/upload/csv', methods=['POST'])
def api_upload_csv():
    """API per caricare un file CSV con ticker e informazioni"""
    try:
        # Verifica che il file sia presente
        if 'csvFile' not in request.files:
            return jsonify({'status': 'error', 'message': 'Nessun file caricato'}), 400
        
        file = request.files['csvFile']
        if file.filename == '':
            return jsonify({'status': 'error', 'message': 'Nessun file selezionato'}), 400
        
        # Verifica estensione
        if not file.filename.lower().endswith('.csv'):
            return jsonify({'status': 'error', 'message': 'File deve essere in formato CSV'}), 400
        
        # Parametri aggiuntivi
        download_data = request.form.get('downloadData') == 'true'
        replace_existing = request.form.get('replaceExisting') == 'true'
        
        logger.info(f"Inizio upload CSV: {file.filename}, download_data={download_data}, replace_existing={replace_existing}")
        
        # Processa il CSV
        result = ticker_manager.process_csv_upload(file, download_data, replace_existing)
        
        logger.info(f"Risultato upload CSV: {result.get('status', 'unknown')}")
        
        if result['status'] == 'error':
            return jsonify(result), 400
        else:
            return jsonify(result)
            
    except Exception as e:
        logger.error(f"Errore upload CSV: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({'status': 'error', 'message': f'Errore interno: {str(e)}'}), 500

# === ERROR HANDLERS ===

@app.errorhandler(404)
def not_found_error(error):
    return render_template('errors/404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('errors/500.html'), 500

# === CONTEXT PROCESSOR ===

@app.context_processor
def inject_globals():
    return {
        'app_name': 'My Dashboard',
        'current_year': datetime.now().year
    }

# === MAIN ===

if __name__ == '__main__':
    # Crea le directory necessarie se non esistono
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('templates/errors', exist_ok=True)
    
    # Il ticker_manager inizializza le sue directory automaticamente
    
    app.run(debug=True, host='0.0.0.0', port=5000)