from flask import Flask, render_template, request, jsonify, flash, redirect, url_for
from datetime import datetime
import os
import logging
import pandas as pd  # AGGIUNGERE QUESTO IMPORT

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

# ✅ AGGIORNARE la route dashboard:
@app.route('/')
def dashboard():
    """Dashboard principale con dati reali"""
    try:
        real_stats = get_real_dashboard_stats()
        real_activities = get_recent_activities()
        
        return render_template('dashboard.html', 
                             title='Dashboard',
                             stats=real_stats,
                             activities=real_activities,
                             current_time=datetime.now())
    except Exception as e:
        logger.error(f"Errore dashboard: {e}")
        # Fallback per errori
        fallback_stats = {
            'total_tickers': 0,
            'updated_tickers': 0,
            'total_records': 0,
            'total_size_mb': 0
        }
        fallback_activities = [{
            'action': 'Sistema avviato',
            'time': 'Ora',
            'type': 'info'
        }]
        
        return render_template('dashboard.html', 
                             title='Dashboard',
                             stats=fallback_stats,
                             activities=fallback_activities,
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

# ✅ AGGIORNARE gli endpoint API:
@app.route('/api/stats')
def api_stats():
    """API endpoint per statistiche dashboard reali"""
    try:
        return jsonify(get_real_dashboard_stats())
    except Exception as e:
        logger.error(f"Errore API stats: {e}")
        return jsonify({'error': 'Errore nel recuperare statistiche'}), 500

@app.route('/api/activities')
def api_activities():
    """API endpoint per attività recenti reali"""
    try:
        return jsonify(get_recent_activities())
    except Exception as e:
        logger.error(f"Errore API activities: {e}")
        return jsonify([]), 500

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
    
    # Aggiungi questi endpoint al tuo app.py, prima della sezione "# === ERROR HANDLERS ==="

@app.route('/api/ticker/<ticker>/details')
def api_ticker_details(ticker):
    """API per ottenere i dettagli completi di un ticker"""
    try:
        ticker = ticker.upper()
        
        # Carica metadati
        meta = ticker_manager.load_ticker_meta(ticker)
        if not meta:
            return jsonify({'status': 'error', 'message': f'Ticker {ticker} non trovato'}), 404
        
        # Calcola informazioni aggiuntive
        file_adj = ticker_manager.data_dir / f"{ticker}.csv"
        file_not_adj = ticker_manager.data_dir_not_adj / f"{ticker}_notAdjusted.csv"
        
        result = meta.copy()
        result.update({
            'files_exist': {
                'adjusted': file_adj.exists(),
                'not_adjusted': file_not_adj.exists()
            },
            'file_sizes': {
                'adjusted': f"{file_adj.stat().st_size / 1024:.1f} KB" if file_adj.exists() else "0 KB",
                'not_adjusted': f"{file_not_adj.stat().st_size / 1024:.1f} KB" if file_not_adj.exists() else "0 KB"
            },
            'needs_update': False
        })
        
        # Calcola se serve aggiornamento
        if meta.get('last_close_date'):
            try:
                from datetime import datetime
                last_date = datetime.strptime(meta['last_close_date'], '%Y-%m-%d').date()
                result['needs_update'] = last_date < datetime.now().date()
            except:
                result['needs_update'] = True
        else:
            result['needs_update'] = True
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Errore nel recuperare dettagli per {ticker}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/ticker/<ticker>/data')
def api_ticker_data(ticker):
    """API per ottenere gli ultimi dati storici di un ticker"""
    try:
        ticker = ticker.upper()
        
        # Parametri query
        limit = request.args.get('limit', 50, type=int)  # Ultimi 50 record di default
        version = request.args.get('version', 'adjusted')  # 'adjusted' o 'raw'
        
        # Determina quale file leggere
        if version == 'raw':
            file_path = ticker_manager.data_dir_not_adj / f"{ticker}_notAdjusted.csv"
        else:
            file_path = ticker_manager.data_dir / f"{ticker}.csv"
        
        if not file_path.exists():
            return jsonify({'status': 'error', 'message': f'File dati per {ticker} non trovato'}), 404
        
        # Leggi il CSV
        df = pd.read_csv(file_path)
        
        # Prendi gli ultimi N record
        df_recent = df.tail(limit)
        
        # Converti in formato JSON amichevole
        records = []
        for _, row in df_recent.iterrows():
            record = {
                'date': row['Date'],
                'open': round(float(row['Open']), 2) if pd.notna(row['Open']) else None,
                'high': round(float(row['High']), 2) if pd.notna(row['High']) else None,
                'low': round(float(row['Low']), 2) if pd.notna(row['Low']) else None,
                'close': round(float(row['Close']), 2) if pd.notna(row['Close']) else None,
                'volume': int(row['Volume']) if pd.notna(row['Volume']) else None
            }
            
            # Aggiungi Adj Close se presente (solo per versione adjusted)
            if version == 'adjusted' and 'Adj Close' in row:
                record['adj_close'] = round(float(row['Adj Close']), 2) if pd.notna(row['Adj Close']) else None
            
            records.append(record)
        
        return jsonify({
            'ticker': ticker,
            'version': version,
            'total_records': len(df),
            'returned_records': len(records),
            'data': records
        })
        
    except Exception as e:
        logger.error(f"Errore nel recuperare dati per {ticker}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

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

def get_real_dashboard_stats():
    """Genera statistiche reali basate sui ticker configurati"""
    config = ticker_manager.load_ticker_config()
    ticker_status = ticker_manager.get_ticker_status()
    
    total_tickers = len(config.get('tickers', []))
    updated_tickers = sum(1 for ticker in ticker_status if not ticker.get('needs_update', True))
    total_records = sum(ticker.get('total_records', 0) for ticker in ticker_status)
    
    # Calcola dimensione totale file
    total_size_mb = 0
    for ticker in ticker_status:
        file_sizes = ticker.get('file_sizes', {})
        for size_str in file_sizes.values():
            if 'KB' in size_str:
                total_size_mb += float(size_str.replace(' KB', '').replace(',', '')) / 1024
            elif 'MB' in size_str:
                total_size_mb += float(size_str.replace(' MB', '').replace(',', ''))
    
    return {
        'total_tickers': total_tickers,
        'updated_tickers': updated_tickers,
        'total_records': total_records,
        'total_size_mb': round(total_size_mb, 2)
    }

def get_recent_activities():
    """Genera attività recenti basate sui metadati reali"""
    activities = []
    
    try:
        # Leggi i file meta più recenti
        meta_files = list(ticker_manager.meta_dir.glob('*.json'))
        meta_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        
        for meta_file in meta_files[:10]:  # Ultimi 10
            meta_data = ticker_manager.load_ticker_meta(meta_file.stem)
            if meta_data:
                last_updated = meta_data.get('last_updated', '')
                if last_updated:
                    from datetime import datetime
                    try:
                        update_time = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
                        time_diff = datetime.now() - update_time.replace(tzinfo=None)
                        
                        if time_diff.days == 0:
                            if time_diff.seconds < 3600:
                                time_str = f"{time_diff.seconds // 60} minuti fa"
                            else:
                                time_str = f"{time_diff.seconds // 3600} ore fa"
                        else:
                            time_str = f"{time_diff.days} giorni fa"
                        
                        activities.append({
                            'action': f'Ticker {meta_data["ticker"]} aggiornato - {meta_data.get("total_records", 0)} record',
                            'time': time_str,
                            'type': 'success'
                        })
                    except:
                        continue
        
        if not activities:
            activities = [{
                'action': 'Sistema inizializzato correttamente',
                'time': 'Ora',
                'type': 'info'
            }]
                        
    except Exception as e:
        logger.error(f"Errore nel recuperare attività recenti: {e}")
        activities = [{
            'action': 'Sistema in funzione',
            'time': 'Ora',
            'type': 'info'
        }]
    
    return activities

# ✅ AGGIUNGERE questo endpoint a app.py:

@app.route('/api/ticker-chart-data')
def api_ticker_chart_data():
    """API endpoint per dati del grafico ticker"""
    try:
        ticker_status = ticker_manager.get_ticker_status()
        
        # Organizza i dati per mese basandosi su last_updated
        from collections import defaultdict
        import calendar
        
        monthly_data = defaultdict(int)
        
        for ticker in ticker_status:
            last_updated = ticker.get('last_updated')
            if last_updated:
                try:
                    update_date = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
                    month_key = update_date.strftime('%Y-%m')
                    monthly_data[month_key] += 1
                except:
                    continue
        
        # Prepara dati per gli ultimi 12 mesi
        current_date = datetime.now()
        chart_data = {
            'labels': [],
            'datasets': [{
                'label': 'Ticker Aggiornati',
                'data': [],
                'borderColor': 'rgb(54, 162, 235)',
                'backgroundColor': 'rgba(54, 162, 235, 0.1)',
                'tension': 0.4,
                'fill': True
            }]
        }
        
        for i in range(11, -1, -1):  # Ultimi 12 mesi
            target_date = current_date.replace(day=1) - timedelta(days=i*30)
            month_key = target_date.strftime('%Y-%m')
            month_name = calendar.month_name[target_date.month][:3]  # Gen, Feb, etc.
            
            chart_data['labels'].append(month_name)
            chart_data['datasets'][0]['data'].append(monthly_data.get(month_key, 0))
        
        return jsonify(chart_data)
        
    except Exception as e:
        logger.error(f"Errore API ticker chart: {e}")
        
        # Fallback con dati base
        months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
        current_month = datetime.now().month - 1
        
        return jsonify({
            'labels': months,
            'datasets': [{
                'label': 'Ticker Configurati',
                'data': [0] * current_month + [len(ticker_manager.load_ticker_config().get('tickers', []))] + [0] * (11 - current_month),
                'borderColor': 'rgb(54, 162, 235)',
                'backgroundColor': 'rgba(54, 162, 235, 0.1)',
                'tension': 0.4,
                'fill': True
            }]
        })
# === MAIN ===

if __name__ == '__main__':
    # Crea le directory necessarie se non esistono
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('templates/errors', exist_ok=True)
    
    # Il ticker_manager inizializza le sue directory automaticamente
    
    app.run(debug=True, host='0.0.0.0', port=5000)