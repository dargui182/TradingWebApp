from flask import Flask, render_template, request, jsonify, flash, redirect, url_for
from datetime import datetime, timedelta
import os
import logging
import pandas as pd
import numpy as np
from pathlib import Path
import calendar

# Import moduli personalizzati
from SmartStatus import SmartStatusPython
from moduls.TechnicalAnalysis.TechnicalAnalysisManager import TechnicalAnalysisManager
from TickerDataManager import TickerDataManager

# ===== CONFIGURAZIONE APP =====
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this'  # Cambia in produzione
app.config['DEBUG'] = True

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===== INIZIALIZZAZIONE MANAGER =====
ticker_manager = TickerDataManager()
smart_status = SmartStatusPython()
technical_manager = TechnicalAnalysisManager()

# ===== DATI SAMPLE =====
recent_activities = [
    {'action': 'Nuovo utente registrato', 'time': '2 minuti fa', 'type': 'success'},
    {'action': 'Ordine completato #1234', 'time': '5 minuti fa', 'type': 'info'},
    {'action': 'Errore nel sistema pagamenti', 'time': '10 minuti fa', 'type': 'warning'},
    {'action': 'Backup completato', 'time': '1 ora fa', 'type': 'success'}
]

# ===== FUNZIONI HELPER =====

def get_current_price(ticker):
    """Ottiene il prezzo corrente di un ticker per calcolare le distanze."""
    try:
        # Prova prima con dati adjusted
        adjusted_file = Path(f'resources/data/daily/{ticker}.csv')
        if adjusted_file.exists():
            df = pd.read_csv(adjusted_file, parse_dates=['Date'])
            return float(df.iloc[-1]['Close'])
        
        # Fallback con dati not adjusted
        notadj_file = Path(f'resources/data/daily_notAdjusted/{ticker}_notAdjusted.csv')
        if notadj_file.exists():
            df = pd.read_csv(notadj_file, parse_dates=['Date'])
            return float(df.iloc[-1]['Close'])
            
        return 0.0
        
    except Exception as e:
        print(f"Errore ottenimento prezzo corrente per {ticker}: {e}")
        return 0.0

def get_real_dashboard_stats():
    """Genera statistiche reali basate sui ticker configurati - CON SMART STATUS"""
    try:
        config = ticker_manager.load_ticker_config()
        ticker_status = ticker_manager.get_ticker_status()
        
        total_tickers = len(config.get('tickers', []))
        
        # Usa SmartStatus per calcoli precisi
        updated_tickers = 0
        pending_tickers = 0
        total_records = 0
        total_size_mb = 0
        
        for ticker in ticker_status:
            # Conta record totali
            total_records += ticker.get('total_records', 0)
            
            # Calcola dimensione file
            file_sizes = ticker.get('file_sizes', {})
            for size_str in file_sizes.values():
                if isinstance(size_str, str):
                    if 'KB' in size_str:
                        try:
                            kb_value = float(size_str.replace(' KB', '').replace(',', ''))
                            total_size_mb += kb_value / 1024
                        except (ValueError, AttributeError):
                            pass
                    elif 'MB' in size_str:
                        try:
                            mb_value = float(size_str.replace(' MB', '').replace(',', ''))
                            total_size_mb += mb_value
                        except (ValueError, AttributeError):
                            pass
            
            # Usa SmartStatus invece di needs_update statico
            last_close_date = ticker.get('last_close_date')
            smart_result = smart_status.calculate_smart_status(last_close_date)
            
            if smart_result['needs_update']:
                pending_tickers += 1
            else:
                updated_tickers += 1
            
            # Debug dettagliato
            logger.debug(f"📊 {ticker.get('ticker', 'N/A')}: {last_close_date} → {smart_result['status_text']} (needs_update: {smart_result['needs_update']})")
        
        # Debug riepilogo
        logger.info(f"📊 Smart Stats: {total_tickers} totali, {updated_tickers} aggiornati, {pending_tickers} da aggiornare")
        
        return {
            'total_tickers': total_tickers,
            'updated_tickers': updated_tickers,
            'pending_tickers': pending_tickers,
            'total_records': total_records,
            'total_size_mb': round(total_size_mb, 2)
        }
        
    except Exception as e:
        logger.error(f"Errore calcolo Smart Stats: {e}")
        # Fallback sicuro
        return {
            'total_tickers': 0,
            'updated_tickers': 0,
            'pending_tickers': 0,
            'total_records': 0,
            'total_size_mb': 0
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

# ===== ROUTES PRINCIPALI =====

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

@app.route('/technical-analysis')
def technical_analysis():
    """Pagina principale dell'analisi tecnica"""
    try:
        # Ottieni riassunto delle analisi
        summary = technical_manager.get_analysis_summary()
        
        # Carica ticker configurati
        config = ticker_manager.load_ticker_config()
        tickers = config.get('tickers', [])
        
        return render_template('technical_analysis.html', 
                             title='Analisi Tecnica',
                             summary=summary,
                             tickers=tickers)
    except Exception as e:
        logger.error(f"Errore pagina analisi tecnica: {e}")
        flash(f'Errore nel caricamento dell\'analisi tecnica: {str(e)}', 'error')
        return redirect(url_for('dashboard'))

# ===== API ENDPOINTS BASE =====

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

# ===== API ENDPOINTS TICKER =====

@app.route('/api/tickers', methods=['GET'])
def api_get_tickers():
    """API per ottenere la lista dei ticker con gestione errori"""
    try:
        config = ticker_manager.load_ticker_config()
        return jsonify(config)
    except Exception as e:
        logger.error(f"Errore nel recuperare configurazione ticker: {e}")
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
        return jsonify([])

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

# ===== API ENDPOINTS DOWNLOAD =====

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

# ===== API ENDPOINTS UPLOAD =====

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

# ===== API ENDPOINTS TECHNICAL ANALYSIS =====

@app.route('/api/technical-analysis/run', methods=['POST'])
def api_run_technical_analysis():
    """API per eseguire l'analisi tecnica completa"""
    try:
        data = request.get_json() or {}
        use_adjusted = data.get('use_adjusted', True)
        analysis_type = data.get('analysis_type', 'both')  # 'sr', 'skorupinski', 'both'
        
        results = {}
        
        if analysis_type in ['sr', 'both']:
            technical_manager.set_data_source(use_adjusted)
            results['support_resistance'] = technical_manager.run_support_resistance_analysis()
        
        if analysis_type in ['skorupinski', 'both']:
            technical_manager.set_data_source(use_adjusted)
            results['skorupinski_zones'] = technical_manager.run_skorupinski_analysis()
        
        return jsonify({
            'status': 'success',
            'message': 'Analisi tecnica completata',
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Errore API analisi tecnica: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Errore durante l\'analisi: {str(e)}'
        }), 500

@app.route('/api/technical-analysis/summary')
def api_technical_analysis_summary():
    """API per ottenere riassunto analisi tecnica"""
    try:
        # Usa technical_manager se disponibile
        summary = technical_manager.get_analysis_summary()
        return jsonify(summary)
        
    except Exception as e:
        logger.error(f"Errore API summary analisi tecnica: {e}")
        
        # Fallback manuale
        zones_dir = Path('resources/analysis/skorupinski_zones')
        levels_dir = Path('resources/analysis/support_resistance')
        
        summary = {
            'total_tickers': 0,
            'support_resistance': {
                'analyzed': 0,
                'total_levels': 0
            },
            'skorupinski_zones': {
                'analyzed': 0,
                'total_zones': 0,
                'supply_zones': 0,
                'demand_zones': 0
            }
        }
        
        # Conta zone Skorupinski
        if zones_dir.exists():
            for csv_file in zones_dir.glob("*_SkorupinkiZones.csv"):
                try:
                    df = pd.read_csv(csv_file)
                    summary['skorupinski_zones']['analyzed'] += 1
                    summary['skorupinski_zones']['total_zones'] += len(df)
                    summary['skorupinski_zones']['supply_zones'] += len(df[df['type'] == 'Supply'])
                    summary['skorupinski_zones']['demand_zones'] += len(df[df['type'] == 'Demand'])
                except:
                    continue
        
        # Conta supporti/resistenze
        if levels_dir.exists():
            for csv_file in levels_dir.glob("*_SR.csv"):
                try:
                    df = pd.read_csv(csv_file)
                    summary['support_resistance']['analyzed'] += 1
                    summary['support_resistance']['total_levels'] += len(df)
                except:
                    continue
        
        # Totale ticker analizzati
        summary['total_tickers'] = max(
            summary['support_resistance']['analyzed'],
            summary['skorupinski_zones']['analyzed']
        )
        
        return jsonify(summary)

@app.route('/api/technical-analysis/zones')
def get_skorupinski_zones():
    """API endpoint per ottenere tutte le zone Skorupinski"""
    try:
        zones_dir = Path('resources/analysis/skorupinski_zones')
        
        if not zones_dir.exists():
            return jsonify({
                'success': False,
                'message': 'Directory zone Skorupinski non trovata',
                'zones': []
            })
        
        all_zones = []
        
        # Leggi tutti i file CSV delle zone
        for csv_file in zones_dir.glob("*_SkorupinkiZones.csv"):
            try:
                df = pd.read_csv(csv_file, parse_dates=['date'])
                
                # Converti NaN in valori gestibili
                df = df.replace({np.nan: None})
                
                # Aggiungi ogni zona alla lista
                for _, row in df.iterrows():
                    zone_data = {
                        'ticker': row['ticker'],
                        'date': row['date'].strftime('%Y-%m-%d') if pd.notna(row['date']) else None,
                        'pattern': row['pattern'],
                        'type': row['type'],
                        'zone_bottom': float(row['zone_bottom']) if pd.notna(row['zone_bottom']) else 0,
                        'zone_top': float(row['zone_top']) if pd.notna(row['zone_top']) else 0,
                        'zone_center': float(row['zone_center']) if pd.notna(row['zone_center']) else 0,
                        'distance_from_current': float(row['distance_from_current']) if pd.notna(row['distance_from_current']) else 0,
                        'strength_score': float(row['strength_score']) if pd.notna(row['strength_score']) else 1.0,
                        'virgin_zone': bool(row['virgin_zone']) if pd.notna(row['virgin_zone']) else False,
                        'zone_thickness_pct': float(row['zone_thickness_pct']) if pd.notna(row['zone_thickness_pct']) else 1.0,
                        'test_count': int(row['test_count']) if pd.notna(row['test_count']) else 0,
                        'days_ago': int(row['days_ago']) if pd.notna(row['days_ago']) else 0,
                        'zone_id': row['zone_id'] if pd.notna(row['zone_id']) else f"{row['ticker']}_{row['pattern']}_{len(all_zones)}"
                    }
                    all_zones.append(zone_data)
                    
            except Exception as e:
                print(f"Errore lettura file {csv_file}: {e}")
                continue
        
        # Ordina per strength_score decrescente e poi per days_ago crescente
        all_zones.sort(key=lambda x: (-x['strength_score'], x['days_ago']))
        
        return jsonify({
            'success': True,
            'zones': all_zones,
            'total_count': len(all_zones),
            'supply_count': len([z for z in all_zones if z['type'] == 'Supply']),
            'demand_count': len([z for z in all_zones if z['type'] == 'Demand'])
        })
        
    except Exception as e:
        print(f"Errore API zone Skorupinski: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore interno: {str(e)}',
            'zones': []
        }), 500

@app.route('/api/technical-analysis/levels')
def get_support_resistance_levels():
    """API endpoint per ottenere tutti i livelli di supporto e resistenza"""
    try:
        levels_dir = Path('resources/analysis/support_resistance')
        
        if not levels_dir.exists():
            return jsonify({
                'success': False,
                'message': 'Directory supporti/resistenze non trovata',
                'levels': []
            })
        
        all_levels = []
        
        # Leggi tutti i file CSV dei livelli
        for csv_file in levels_dir.glob("*_SR.csv"):
            try:
                df = pd.read_csv(csv_file, parse_dates=['date'])
                
                # Converti NaN in valori gestibili
                df = df.replace({np.nan: None})
                
                # Ottieni prezzo corrente per calcolare distanza
                ticker = csv_file.stem.replace('_SR', '')
                current_price = get_current_price(ticker)
                
                # Aggiungi ogni livello alla lista
                for _, row in df.iterrows():
                    level_value = float(row['level']) if pd.notna(row['level']) else 0
                    distance_pct = ((level_value - current_price) / current_price * 100) if current_price > 0 else 0
                    
                    level_data = {
                        'id': f"{ticker}_{row['type']}_{len(all_levels)}",
                        'ticker': ticker,
                        'date': row['date'].strftime('%Y-%m-%d') if pd.notna(row['date']) else None,
                        'type': row['type'],
                        'level': level_value,
                        'strength': float(row['strength']) if pd.notna(row['strength']) else 1.0,
                        'touches': int(row.get('touches', 1)) if pd.notna(row.get('touches', 1)) else 1,
                        'distance_pct': distance_pct,
                        'days_old': int(row.get('days_old', 0)) if pd.notna(row.get('days_old', 0)) else 0
                    }
                    all_levels.append(level_data)
                    
            except Exception as e:
                print(f"Errore lettura file {csv_file}: {e}")
                continue
        
        # Ordina per strength decrescente
        all_levels.sort(key=lambda x: -x['strength'])
        
        return jsonify({
            'success': True,
            'levels': all_levels,
            'total_count': len(all_levels),
            'support_count': len([l for l in all_levels if l['type'] == 'Support']),
            'resistance_count': len([l for l in all_levels if l['type'] == 'Resistance'])
        })
        
    except Exception as e:
        print(f"Errore API livelli S/R: {e}")
        return jsonify({
            'success': False,
            'message': f'Errore interno: {str(e)}',
            'levels': []
        }), 500

@app.route('/api/technical-analysis/ticker/<ticker>')
def api_technical_ticker_analysis(ticker):
    """API per ottenere analisi tecnica di un ticker specifico"""
    try:
        analysis_type = request.args.get('type', 'both')
        data = technical_manager.get_ticker_analysis_data(ticker, analysis_type)
        return jsonify(data)
    except Exception as e:
        logger.error(f"Errore API analisi ticker {ticker}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/technical-analysis/chart/<ticker>')
def api_technical_chart_data(ticker):
    """API per dati grafico con analisi tecnica"""
    try:
        days = request.args.get('days', 100, type=int)
        include_analysis = request.args.get('include_analysis', 'true').lower() == 'true'
        
        data = technical_manager.get_ticker_chart_data(ticker, days, include_analysis)
        return jsonify(data)
    except Exception as e:
        logger.error(f"Errore API chart data {ticker}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/technical-analysis/set-data-source', methods=['POST'])
def api_technical_set_data_source():
    """API per cambiare fonte dati (adjusted vs notAdjusted)"""
    try:
        data = request.get_json()
        use_adjusted = data.get('use_adjusted', True)
        
        technical_manager.set_data_source(use_adjusted)
        
        return jsonify({
            'status': 'success',
            'message': f'Fonte dati impostata: {"ADJUSTED" if use_adjusted else "NOT ADJUSTED"}',
            'use_adjusted': use_adjusted
        })
    except Exception as e:
        logger.error(f"Errore API set data source: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/technical-analysis/chart-plotly/<ticker>')
def api_technical_chart_plotly(ticker):
    """API per grafico Plotly"""
    try:
        days = request.args.get('days', 100, type=int)
        include_analysis = request.args.get('include_analysis', 'true').lower() == 'true'
        
        logger.info(f"Richiesta grafico Plotly per {ticker}, {days} giorni")
        
        chart_data = technical_manager.generate_plotly_chart(ticker, days, include_analysis)
        
        logger.info(f"Grafico Plotly generato per {ticker}: {chart_data['data_info']}")
        
        return jsonify(chart_data)
        
    except Exception as e:
        logger.error(f"Errore API Plotly chart {ticker}: {e}")
        return jsonify({
            'error': str(e),
            'message': f'Errore nella generazione del grafico per {ticker}'
        }), 500

# ===== API ENDPOINTS DEBUG =====

@app.route('/api/debug/stats')
def api_debug_stats():
    """Debug endpoint per verificare calcolo statistiche"""
    try:
        config = ticker_manager.load_ticker_config()
        ticker_status = ticker_manager.get_ticker_status()
        
        debug_info = {
            'config_tickers_count': len(config.get('tickers', [])),
            'status_tickers_count': len(ticker_status),
            'tickers_detail': []
        }
        
        for ticker in ticker_status:
            debug_info['tickers_detail'].append({
                'ticker': ticker.get('ticker', 'N/A'),
                'needs_update': ticker.get('needs_update', True),
                'has_files': ticker.get('files_exist', {}),
                'total_records': ticker.get('total_records', 0),
                'last_close_date': ticker.get('last_close_date', 'N/A')
            })
        
        # Calcola statistiche con logica corretta
        updated_count = sum(1 for t in ticker_status if not t.get('needs_update', True))
        pending_count = sum(1 for t in ticker_status if t.get('needs_update', True))
        
        debug_info['calculated_stats'] = {
            'updated_tickers': updated_count,
            'pending_tickers': pending_count
        }
        
        return jsonify(debug_info)
        
    except Exception as e:
        logger.error(f"Errore debug stats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/debug/smart-comparison')
def api_debug_smart_comparison():
    """Confronta metodo statico vs SmartStatus"""
    try:
        ticker_status = ticker_manager.get_ticker_status()
        
        comparison = {
            'smart_status_method': {'updated': 0, 'pending': 0},
            'static_method': {'updated': 0, 'pending': 0},
            'ticker_details': []
        }
        
        for ticker in ticker_status:
            ticker_name = ticker.get('ticker', 'N/A')
            last_close_date = ticker.get('last_close_date')
            static_needs_update = ticker.get('needs_update', True)
            
            # Calcola con SmartStatus
            smart_result = smart_status.calculate_smart_status(last_close_date)
            smart_needs_update = smart_result['needs_update']
            
            # Conta per metodo statico
            if static_needs_update:
                comparison['static_method']['pending'] += 1
            else:
                comparison['static_method']['updated'] += 1
            
            # Conta per SmartStatus
            if smart_needs_update:
                comparison['smart_status_method']['pending'] += 1
            else:
                comparison['smart_status_method']['updated'] += 1
            
            # Dettagli ticker
            comparison['ticker_details'].append({
                'ticker': ticker_name,
                'last_close_date': last_close_date,
                'static_needs_update': static_needs_update,
                'smart_needs_update': smart_needs_update,
                'smart_status_text': smart_result['status_text'],
                'match': static_needs_update == smart_needs_update
            })
        
        return jsonify(comparison)
        
    except Exception as e:
        logger.error(f"Errore debug smart comparison: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/debug/smart-status/<ticker>')
def api_debug_smart_status(ticker):
    """Test SmartStatus per un ticker specifico"""
    try:
        meta = ticker_manager.load_ticker_meta(ticker)
        if not meta:
            return jsonify({'error': f'Ticker {ticker} non trovato'}), 404
        
        last_close_date = meta.get('last_close_date')
        smart_result = smart_status.calculate_smart_status(last_close_date)
        
        return jsonify({
            'ticker': ticker,
            'last_close_date': last_close_date,
            'last_expected_market_day': smart_status.get_last_expected_market_day().strftime('%Y-%m-%d'),
            'is_today_market_day': smart_status.is_market_day(datetime.now()),
            'smart_status': smart_result
        })
        
    except Exception as e:
        logger.error(f"Errore debug smart status {ticker}: {e}")
        return jsonify({'error': str(e)}), 500

# ===== ERROR HANDLERS =====

@app.errorhandler(404)
def not_found_error(error):
    return render_template('errors/404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('errors/500.html'), 500

# ===== CONTEXT PROCESSOR =====

@app.context_processor
def inject_globals():
    return {
        'app_name': 'My Dashboard',
        'current_year': datetime.now().year
    }

# ===== FUNZIONI TEST =====

def test_stats_consistency():
    """Test per verificare consistenza tra dashboard e data page"""
    try:
        # Get stats come li calcola il dashboard
        dashboard_stats = get_real_dashboard_stats()
        
        # Get stats come li calcola data.html
        ticker_status = ticker_manager.get_ticker_status()
        data_page_updated = sum(1 for t in ticker_status if not t.get('needs_update', True))
        data_page_pending = sum(1 for t in ticker_status if t.get('needs_update', True))
        
        print(f"🔍 VERIFICA CONSISTENZA:")
        print(f"Dashboard - Aggiornati: {dashboard_stats['updated_tickers']}, Da aggiornare: {dashboard_stats.get('pending_tickers', 'N/A')}")
        print(f"Data Page - Aggiornati: {data_page_updated}, Da aggiornare: {data_page_pending}")
        
        if dashboard_stats['updated_tickers'] == data_page_updated:
            print("✅ CONSISTENZA OK!")
            return True
        else:
            print("❌ DISCREPANZA RILEVATA!")
            return False
            
    except Exception as e:
        print(f"❌ Errore test: {e}")
        return False

# ===== MAIN =====

if __name__ == '__main__':
    # Crea le directory necessarie se non esistono
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('templates/errors', exist_ok=True)
    
    # Il ticker_manager inizializza le sue directory automaticamente
    
    app.run(debug=True, host='0.0.0.0', port=5000)