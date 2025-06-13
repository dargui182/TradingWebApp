#!/usr/bin/env python3
"""
TickerDataManager.py

Modulo per la gestione completa dei dati finanziari da Yahoo Finance.
Gestisce download, salvataggio, aggiornamento e metadati dei ticker.

Funzionalità:
- Download storico completo
- Due versioni per ticker: adjusted e notAdjusted
- Aggiornamenti incrementali
- Gestione metadati
- Configurazione ticker
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import logging
from pathlib import Path
import requests

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TickerDataManager:
    """Gestore completo per dati ticker Yahoo Finance"""
    
    def __init__(self, base_dir='resources'):
        """
        Inizializza il manager
        
        Args:
            base_dir (str): Directory base per salvare i dati
        """
        self.base_dir = Path(base_dir)
        self.data_dir = self.base_dir / 'data' / 'daily'
        self.data_dir_not_adj = self.base_dir / 'data' / 'daily_notAdjusted'
        self.config_file = self.base_dir / 'config' / 'tickers.json'
        self.meta_dir = self.base_dir / 'meta'
        
        # Assicura che le directory esistano
        self._ensure_directories()
        
        # Setup sessione con headers personalizzati
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def _ensure_directories(self):
        """Crea le directory necessarie se non esistono"""
        directories = [
            self.data_dir,
            self.data_dir_not_adj,
            self.config_file.parent,
            self.meta_dir
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            
        logger.info(f"Directory inizializzate: {self.base_dir}")
    
    def load_ticker_config(self):
        """Carica la configurazione dei ticker con gestione errori migliorata"""
        try:
            if self.config_file.exists() and self.config_file.stat().st_size > 0:
                with open(self.config_file, 'r') as f:
                    content = f.read().strip()
                    if content:
                        return json.loads(content)
                    else:
                        logger.warning(f"File configurazione vuoto: {self.config_file}")
                        return {'tickers': [], 'last_updated': None}
            else:
                logger.info(f"File configurazione non esistente o vuoto: {self.config_file}")
                return {'tickers': [], 'last_updated': None}
                
        except json.JSONDecodeError as e:
            logger.error(f"Errore nel parsing JSON del file configurazione: {e}")
            logger.info("Creazione backup del file corrotto e inizializzazione nuovo file")
            
            # Crea backup del file corrotto
            backup_file = self.config_file.with_suffix('.json.backup')
            try:
                if self.config_file.exists():
                    self.config_file.rename(backup_file)
                    logger.info(f"Backup creato: {backup_file}")
            except Exception as backup_error:
                logger.error(f"Errore durante creazione backup: {backup_error}")
            
            # Ritorna configurazione di default
            default_config = {'tickers': [], 'last_updated': None}
            
            # Salva subito la configurazione di default
            try:
                self.save_ticker_config(default_config)
                logger.info("Nuova configurazione di default salvata")
            except Exception as save_error:
                logger.error(f"Errore nel salvare configurazione di default: {save_error}")
            
            return default_config
            
        except Exception as e:
            logger.error(f"Errore generale nel caricamento configurazione: {e}")
            return {'tickers': [], 'last_updated': None}
    
    def save_ticker_config(self, config):
            """Salva la configurazione dei ticker con gestione errori"""
            try:
                # Assicura che la directory esista
                self.config_file.parent.mkdir(parents=True, exist_ok=True)
                
                config['last_updated'] = datetime.now().isoformat()
                
                # Scrivi in un file temporaneo prima
                temp_file = self.config_file.with_suffix('.json.tmp')
                
                with open(temp_file, 'w') as f:
                    json.dump(config, f, indent=2)
                
                # Sposta il file temporaneo su quello finale (operazione atomica)
                temp_file.replace(self.config_file)
                
                logger.info(f"Configurazione salvata con successo: {len(config.get('tickers', []))} ticker")
                
            except Exception as e:
                logger.error(f"Errore nel salvare configurazione: {e}")
                # Rimuovi il file temporaneo se esiste
                temp_file = self.config_file.with_suffix('.json.tmp')
                if temp_file.exists():
                    try:
                        temp_file.unlink()
                    except:
                        pass
                raise
    
    def load_ticker_meta(self, ticker):
        """Carica i metadati di un ticker con gestione errori migliorata"""
        meta_file = self.meta_dir / f"{ticker}.json"
        try:
            if meta_file.exists() and meta_file.stat().st_size > 0:
                with open(meta_file, 'r') as f:
                    content = f.read().strip()
                    if content:
                        return json.loads(content)
                    else:
                        logger.warning(f"File metadati vuoto per {ticker}")
                        return None
            else:
                return None
                
        except json.JSONDecodeError as e:
            logger.error(f"Errore nel parsing JSON metadati per {ticker}: {e}")
            # Crea backup del file corrotto
            backup_file = meta_file.with_suffix('.json.backup')
            try:
                meta_file.rename(backup_file)
                logger.info(f"Backup metadati corrotti creato: {backup_file}")
            except Exception:
                pass
            return None
            
        except Exception as e:
            logger.error(f"Errore generale nel caricamento metadati per {ticker}: {e}")
            return None
        
    def save_ticker_meta(self, ticker, meta_data):
        """Salva i metadati di un ticker con gestione errori"""
        meta_file = self.meta_dir / f"{ticker}.json"
        try:
            # Assicura che la directory esista
            self.meta_dir.mkdir(parents=True, exist_ok=True)
            
            # Scrivi in un file temporaneo prima
            temp_file = meta_file.with_suffix('.json.tmp')
            
            with open(temp_file, 'w') as f:
                json.dump(meta_data, f, indent=2)
            
            # Sposta il file temporaneo su quello finale
            temp_file.replace(meta_file)
            
            logger.debug(f"Metadati salvati per {ticker}")
            
        except Exception as e:
            logger.error(f"Errore nel salvare metadati per {ticker}: {e}")
            # Rimuovi il file temporaneo se esiste
            temp_file = meta_file.with_suffix('.json.tmp')
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except:
                    pass
            raise
    
    def get_ticker_info(self, ticker):
        """Ottiene informazioni base su un ticker da Yahoo Finance"""
        try:
            logger.info(f"Tentativo di ottenere info per {ticker}")
            
            # Non usare sessione personalizzata - yfinance gestisce la propria
            stock = yf.Ticker(ticker)
            
            # Test rapido per verificare che il ticker esista
            try:
                test_data = stock.history(period="1d")
                if test_data.empty:
                    logger.warning(f"Nessun dato storico per {ticker} - ticker potrebbe non esistere")
                    return None
            except Exception as e:
                logger.warning(f"Errore nel test dati storici per {ticker}: {e}")
            
            info = stock.info
            logger.info(f"Info ottenute per {ticker}: {len(info)} campi")
            
            if not info or len(info) < 5:
                logger.warning(f"Info insufficienti per {ticker}: {info}")
                return None
            
            result = {
                'symbol': ticker,
                'name': info.get('longName') or info.get('shortName') or ticker,
                'sector': info.get('sector', 'N/A'),
                'industry': info.get('industry', 'N/A'),
                'currency': info.get('currency', 'USD'),
                'exchange': info.get('exchange', 'N/A'),
                'country': info.get('country', 'N/A')
            }
            
            logger.info(f"Info estratte per {ticker}: {result['name']}")
            return result
            
        except Exception as e:
            logger.error(f"Errore nel recuperare info per {ticker}: {e}")
            
            # Metodo alternativo - solo download dati
            try:
                logger.info(f"Tentativo metodo alternativo per {ticker}")
                test_download = yf.download(ticker, period="5d", progress=False, auto_adjust=False)
                
                if not test_download.empty:
                    logger.info(f"Metodo alternativo funziona per {ticker}")
                    return {
                        'symbol': ticker,
                        'name': f"{ticker} (verificato)",
                        'sector': 'N/A',
                        'industry': 'N/A',
                        'currency': 'USD',
                        'exchange': 'N/A',
                        'country': 'N/A'
                    }
                else:
                    return None
                    
            except Exception as e2:
                logger.error(f"Metodo alternativo fallito per {ticker}: {e2}")
                return None
    
    def download_ticker_data(self, ticker, start_date=None, end_date=None):
        """Scarica dati di un ticker da Yahoo Finance"""
        try:
            logger.info(f"Download dati per {ticker}, periodo: {start_date} - {end_date}")
            
            # Prova prima con yf.download (più affidabile)
            # IMPORTANTE: auto_adjust=False per avere sia Close che Adj Close
            try:
                if start_date is None:
                    logger.info(f"Download completo storico per {ticker}")
                    data = yf.download(ticker, period="max", progress=False, auto_adjust=False)
                else:
                    logger.info(f"Download incrementale per {ticker} dal {start_date}")
                    data = yf.download(ticker, start=start_date, end=end_date, progress=False, auto_adjust=False)
                
                if not data.empty:
                    logger.info(f"yf.download funziona per {ticker}: {len(data)} record")
                    # Reset index per avere Date come colonna
                    data.reset_index(inplace=True)
                    data['Date'] = data['Date'].dt.strftime('%Y-%m-%d')
                    
                    # IMPORTANTE: Gestisci MultiIndex nelle colonne
                    if isinstance(data.columns, pd.MultiIndex):
                        logger.info(f"Rilevato MultiIndex nelle colonne per {ticker}")
                        # Appiattisci le colonne mantenendo solo il primo livello
                        data.columns = [col[0] if col[0] != '' else col[1] for col in data.columns]
                        logger.info(f"Colonne appiattite per {ticker}: {list(data.columns)}")
                    
                    # Log colonne disponibili per debug
                    logger.info(f"Colonne disponibili per {ticker}: {list(data.columns)}")
                    
                    return data
                else:
                    logger.warning(f"yf.download non ha restituito dati per {ticker}")
                    
            except Exception as e:
                logger.warning(f"yf.download fallito per {ticker}: {e}, provo metodo Ticker...")
            
            # Fallback al metodo Ticker
            # Non usare sessione personalizzata - yfinance gestisce la propria
            stock = yf.Ticker(ticker)
            
            if start_date is None:
                start_date = "1900-01-01"
                logger.info(f"Download storico completo per {ticker} dal {start_date}")
            
            if end_date is None:
                end_date = datetime.now().strftime("%Y-%m-%d")
                
            logger.info(f"Usando Ticker.history per {ticker}: {start_date} - {end_date}")
            
            # auto_adjust=False per avere sia Close che Adj Close
            data = stock.history(start=start_date, end=end_date, auto_adjust=False)
            
            if data.empty:
                logger.warning(f"Nessun dato trovato per {ticker}")
                return None
                
            # Reset index per avere Date come colonna
            data.reset_index(inplace=True)
            data['Date'] = data['Date'].dt.strftime('%Y-%m-%d')
            
            # IMPORTANTE: Gestisci MultiIndex nelle colonne
            if isinstance(data.columns, pd.MultiIndex):
                logger.info(f"Rilevato MultiIndex nelle colonne per {ticker} (Ticker.history)")
                # Appiattisci le colonne mantenendo solo il primo livello
                data.columns = [col[0] if col[0] != '' else col[1] for col in data.columns]
                logger.info(f"Colonne appiattite per {ticker}: {list(data.columns)}")
            
            # Log colonne per debug
            logger.info(f"Colonne Ticker.history per {ticker}: {list(data.columns)}")
            
            logger.info(f"Dati scaricati per {ticker}: {len(data)} record, dal {data['Date'].iloc[0]} al {data['Date'].iloc[-1]}")
            return data
            
        except Exception as e:
            logger.error(f"Errore completo nel download dati per {ticker}: {e}")
            return None
    
    def process_ticker_data(self, data, ticker):
        """
        Processa i dati del ticker creando due versioni:
        1. notAdjusted: prezzi originali
        2. adjusted: tutti i prezzi OHLC aggiustati usando il rapporto Adj Close/Close
        
        Args:
            data (DataFrame): Dati grezzi da Yahoo Finance
            ticker (str): Simbolo del ticker
            
        Returns:
            tuple: (data_not_adjusted, data_adjusted)
        """
        try:
            logger.info(f"Processamento dati per {ticker}: {len(data)} record")
            logger.info(f"Colonne disponibili: {list(data.columns)}")
            
            # Crea copia per versione non aggiustata
            data_not_adjusted = data.copy()
            
            # Crea versione aggiustata
            data_adjusted = data.copy()
            
            # Controlla se abbiamo la colonna Adj Close
            # Prima verifica se abbiamo MultiIndex e gestiscilo
            if isinstance(data.columns, pd.MultiIndex):
                logger.info(f"Rilevato MultiIndex nelle colonne durante processamento per {ticker}")
                # Appiattisci le colonne mantenendo solo il primo livello
                data.columns = [col[0] if col[0] != '' else col[1] for col in data.columns]
                logger.info(f"Colonne appiattite durante processamento: {list(data.columns)}")
            
            # Aggiorna le copie dopo l'eventuale appiattimento
            data_not_adjusted = data.copy()
            data_adjusted = data.copy()
            
            if 'Adj Close' in data.columns:
                logger.info(f"Trovata colonna 'Adj Close' per {ticker} - procedo con aggiustamento")
                
                # Verifica che non ci siano valori nulli in Close o Adj Close
                close_nulls = data['Close'].isnull().sum()
                adj_close_nulls = data['Adj Close'].isnull().sum()
                
                # Converti in scalare se necessario (gestisce casi MultiIndex residui)
                if hasattr(close_nulls, 'iloc'):
                    close_nulls = close_nulls.iloc[0] if len(close_nulls) > 0 else close_nulls
                if hasattr(adj_close_nulls, 'iloc'):
                    adj_close_nulls = adj_close_nulls.iloc[0] if len(adj_close_nulls) > 0 else adj_close_nulls
                
                logger.info(f"Valori nulli trovati in {ticker}: Close={close_nulls}, Adj Close={adj_close_nulls}")
                
                if close_nulls > 0:
                    logger.warning(f"Trovati {close_nulls} valori nulli in Close per {ticker}")
                    # Riempi valori nulli con il valore precedente (nuovo metodo pandas)
                    data_adjusted['Close'] = data_adjusted['Close'].ffill()
                    data_not_adjusted['Close'] = data_not_adjusted['Close'].ffill()
                
                if adj_close_nulls > 0:
                    logger.warning(f"Trovati {adj_close_nulls} valori nulli in Adj Close per {ticker}")
                    data_adjusted['Adj Close'] = data_adjusted['Adj Close'].ffill()
                
                # Evita divisione per zero
                close_zero = (data_adjusted['Close'] == 0).sum()
                
                # Converti in scalare se necessario
                if hasattr(close_zero, 'iloc'):
                    close_zero = close_zero.iloc[0] if len(close_zero) > 0 else close_zero
                
                if close_zero > 0:
                    logger.warning(f"Trovati {close_zero} valori zero in Close per {ticker}")
                    # Sostituisci zero con un valore molto piccolo
                    data_adjusted['Close'] = data_adjusted['Close'].replace(0, 0.0001)
                
                # Calcola il rapporto di aggiustamento
                # rapporto = Adj Close / Close
                adjustment_ratio = data_adjusted['Adj Close'] / data_adjusted['Close']
                
                # Controlla se ci sono rapporti anomali (probabilmente errori nei dati)
                anomal_ratios = ((adjustment_ratio < 0.01) | (adjustment_ratio > 100)).sum()
                
                # Converti in scalare se necessario
                if hasattr(anomal_ratios, 'iloc'):
                    anomal_ratios = anomal_ratios.iloc[0] if len(anomal_ratios) > 0 else anomal_ratios
                
                if anomal_ratios > 0:
                    logger.warning(f"Trovati {anomal_ratios} rapporti di aggiustamento anomali per {ticker}")
                    # Limita i rapporti estremi
                    adjustment_ratio = adjustment_ratio.clip(0.01, 100)
                
                # Aggiusta tutti i prezzi OHLC usando il rapporto
                price_columns = ['Open', 'High', 'Low']
                for col in price_columns:
                    if col in data_adjusted.columns:
                        data_adjusted[col] = data_adjusted[col] * adjustment_ratio
                
                # Close diventa Adj Close
                data_adjusted['Close'] = data_adjusted['Adj Close']
                
                logger.info(f"Aggiustamento completato per {ticker}")
                
            else:
                logger.warning(f"Colonna 'Adj Close' NON trovata per {ticker}")
                logger.info(f"Assumo che i prezzi siano già raw (non aggiustati)")
                
                # Se non c'è Adj Close, creiamo comunque due versioni
                # La versione "adjusted" sarà identica alla "not adjusted"
                # Aggiungiamo una colonna Adj Close fittizia uguale a Close
                data_adjusted['Adj Close'] = data_adjusted['Close'].copy()
                
                logger.info(f"Creata colonna Adj Close fittizia per {ticker}")
            
            # Per la versione non aggiustata, rimuovi Adj Close per chiarezza
            if 'Adj Close' in data_not_adjusted.columns:
                data_not_adjusted = data_not_adjusted.drop(columns=['Adj Close'])
            
            # IMPORTANTE: NON arrotondare i prezzi per mantenere massima precisione
            # I prezzi finanziari devono essere precisi per calcoli accurati
            # Yahoo Finance fornisce già la precisione corretta
            
            # Gestisci Volume come intero se presente
            if 'Volume' in data_adjusted.columns:
                data_adjusted['Volume'] = data_adjusted['Volume'].astype('int64')
            if 'Volume' in data_not_adjusted.columns:
                data_not_adjusted['Volume'] = data_not_adjusted['Volume'].astype('int64')
            
            logger.info(f"Dati processati per {ticker}:")
            logger.info(f"  - NotAdjusted: {len(data_not_adjusted)} record, colonne: {list(data_not_adjusted.columns)}")
            logger.info(f"  - Adjusted: {len(data_adjusted)} record, colonne: {list(data_adjusted.columns)}")
            
            # Verifica finale: controllo coerenza dati
            if len(data_not_adjusted) != len(data_adjusted):
                logger.error(f"ERRORE: Numero record diverso tra versioni per {ticker}")
                return None, None
            
            # Controlla che le date siano identiche
            if not data_not_adjusted['Date'].equals(data_adjusted['Date']):
                logger.error(f"ERRORE: Date non coerenti tra versioni per {ticker}")
                return None, None
            
            logger.info(f"✅ Processamento completato con successo per {ticker}")
            return data_not_adjusted, data_adjusted
            
        except Exception as e:
            logger.error(f"Errore nel processamento dati per {ticker}: {e}")
            logger.error(f"Tipo errore: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None, None
    
    def save_ticker_files(self, ticker, data_not_adjusted, data_adjusted, is_append=False):
        """
        Salva i due file per il ticker
        
        Args:
            ticker (str): Simbolo del ticker
            data_not_adjusted (DataFrame): Dati non aggiustati
            data_adjusted (DataFrame): Dati aggiustati
            is_append (bool): Se True, appende ai file esistenti
        """
        try:
            # Percorsi file
            file_not_adj = self.data_dir_not_adj / f"{ticker}_notAdjusted.csv"
            file_adj = self.data_dir / f"{ticker}.csv"
            
            mode = 'a' if is_append else 'w'
            header = not is_append
            
            # Salva versione non aggiustata
            data_not_adjusted.to_csv(file_not_adj, mode=mode, header=header, index=False)
            logger.info(f"Salvato {ticker}_notAdjusted.csv: {len(data_not_adjusted)} record ({'appeso' if is_append else 'nuovo'})")
            
            # Salva versione aggiustata
            data_adjusted.to_csv(file_adj, mode=mode, header=header, index=False)
            logger.info(f"Salvato {ticker}.csv: {len(data_adjusted)} record ({'appeso' if is_append else 'nuovo'})")
            
            return True
            
        except Exception as e:
            logger.error(f"Errore nel salvataggio file per {ticker}: {e}")
            return False
    
    def update_ticker_data(self, ticker):
        """Aggiorna i dati di un ticker (download completo o incrementale)"""
        try:
            file_adj = self.data_dir / f"{ticker}.csv"
            file_not_adj = self.data_dir_not_adj / f"{ticker}_notAdjusted.csv"
            meta = self.load_ticker_meta(ticker)
            
            # Se è la prima volta, scarica tutto lo storico
            if meta is None or not file_adj.exists():
                logger.info(f"Primo download per {ticker}")
                
                # Scarica dati grezzi
                raw_data = self.download_ticker_data(ticker)
                if raw_data is None:
                    return {'status': 'error', 'message': f'Errore nel download di {ticker}'}
                
                # Processa i dati (crea versioni adjusted e notAdjusted)
                data_not_adj, data_adj = self.process_ticker_data(raw_data, ticker)
                if data_not_adj is None or data_adj is None:
                    return {'status': 'error', 'message': f'Errore nel processamento dati di {ticker}'}
                
                # Salva i file
                if not self.save_ticker_files(ticker, data_not_adj, data_adj, is_append=False):
                    return {'status': 'error', 'message': f'Errore nel salvataggio file di {ticker}'}
                
                # Ottieni info ticker per metadati
                ticker_info = self.get_ticker_info(ticker)
                
                # Salva metadati
                meta_data = {
                    'ticker': ticker,
                    'info': ticker_info,
                    'last_close_date': data_adj['Date'].iloc[-1],
                    'total_records': len(data_adj),
                    'first_date': data_adj['Date'].iloc[0],
                    'last_updated': datetime.now().isoformat(),
                    'files': {
                        'adjusted': str(file_adj),
                        'not_adjusted': str(file_not_adj)
                    }
                }
                self.save_ticker_meta(ticker, meta_data)
                
                return {
                    'status': 'success',
                    'message': f'Scaricati {len(data_adj)} record per {ticker} (2 versioni salvate)',
                    'records': len(data_adj)
                }
            
            # Controllo se serve aggiornamento
            last_close_date = datetime.strptime(meta['last_close_date'], '%Y-%m-%d')
            today = datetime.now().date()
            
            if last_close_date.date() >= today:
                return {'status': 'info', 'message': f'{ticker} già aggiornato', 'records': 0}
            
            # Aggiornamento incrementale
            start_date = (last_close_date + timedelta(days=1)).strftime('%Y-%m-%d')
            logger.info(f"Aggiornamento incrementale per {ticker} dal {start_date}")
            
            # Scarica nuovi dati
            new_raw_data = self.download_ticker_data(ticker, start_date=start_date)
            if new_raw_data is None or new_raw_data.empty:
                return {'status': 'info', 'message': f'Nessun nuovo dato per {ticker}', 'records': 0}
            
            # Processa i nuovi dati
            new_data_not_adj, new_data_adj = self.process_ticker_data(new_raw_data, ticker)
            if new_data_not_adj is None or new_data_adj is None:
                return {'status': 'error', 'message': f'Errore processamento nuovi dati per {ticker}'}
            
            # Appendi ai file esistenti
            if not self.save_ticker_files(ticker, new_data_not_adj, new_data_adj, is_append=True):
                return {'status': 'error', 'message': f'Errore aggiornamento file per {ticker}'}
            
            # Aggiorna metadati
            meta['last_close_date'] = new_data_adj['Date'].iloc[-1]
            meta['total_records'] += len(new_data_adj)
            meta['last_updated'] = datetime.now().isoformat()
            self.save_ticker_meta(ticker, meta)
            
            return {
                'status': 'success',
                'message': f'Aggiunti {len(new_data_adj)} nuovi record per {ticker} (2 versioni aggiornate)',
                'records': len(new_data_adj)
            }
            
        except Exception as e:
            logger.error(f"Errore nell'aggiornamento di {ticker}: {e}")
            return {'status': 'error', 'message': f'Errore: {str(e)}'}
    
    def get_ticker_status(self):
        """Ottiene lo stato di tutti i ticker configurati"""
        config = self.load_ticker_config()
        status_list = []
        
        for ticker in config['tickers']:
            meta = self.load_ticker_meta(ticker)
            file_adj = self.data_dir / f"{ticker}.csv"
            file_not_adj = self.data_dir_not_adj / f"{ticker}_notAdjusted.csv"
            
            if meta:
                # Calcola dimensioni file
                adj_size = f"{file_adj.stat().st_size / 1024:.1f} KB" if file_adj.exists() else "0 KB"
                not_adj_size = f"{file_not_adj.stat().st_size / 1024:.1f} KB" if file_not_adj.exists() else "0 KB"
                
                # Estrai info CSV se disponibili
                csv_info = None
                if 'csv_import' in meta:
                    csv_info = {
                        'company': meta['csv_import'].get('company', ''),
                        'sector': meta['csv_import'].get('sector', ''),
                        'industry': meta['csv_import'].get('industry', ''),
                        'imported_at': meta['csv_import'].get('imported_at', '')
                    }
                
                # Calcola needs_update con gestione sicura di last_close_date
                last_close_date = meta.get('last_close_date')
                needs_update = True  # Default: assume che serve aggiornamento
                
                if last_close_date and isinstance(last_close_date, str):
                    try:
                        last_date = datetime.strptime(last_close_date, '%Y-%m-%d').date()
                        needs_update = last_date < datetime.now().date()
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Errore nel parsing della data per {ticker}: {last_close_date}, errore: {e}")
                        needs_update = True
                else:
                    logger.debug(f"last_close_date mancante o non valido per {ticker}: {last_close_date}")
                    needs_update = True
                
                status = {
                    'ticker': ticker,
                    'name': meta['info']['name'] if meta.get('info') else ticker,
                    'last_close_date': last_close_date,
                    'first_date': meta.get('first_date', None),
                    'total_records': meta.get('total_records', 0),
                    'files_exist': {
                        'adjusted': file_adj.exists(),
                        'not_adjusted': file_not_adj.exists()
                    },
                    'file_sizes': {
                        'adjusted': adj_size,
                        'not_adjusted': not_adj_size
                    },
                    'last_updated': meta.get('last_updated'),
                    'needs_update': needs_update,
                    'csv_info': csv_info
                }
            else:
                # Metadati non esistenti - ticker probabilmente appena aggiunto
                status = {
                    'ticker': ticker,
                    'name': ticker,
                    'last_close_date': None,
                    'first_date': None,
                    'total_records': 0,
                    'files_exist': {
                        'adjusted': file_adj.exists(),
                        'not_adjusted': file_not_adj.exists()
                    },
                    'file_sizes': {
                        'adjusted': f"{file_adj.stat().st_size / 1024:.1f} KB" if file_adj.exists() else "0 KB",
                        'not_adjusted': f"{file_not_adj.stat().st_size / 1024:.1f} KB" if file_not_adj.exists() else "0 KB"
                    },
                    'last_updated': None,
                    'needs_update': True,  # Sempre True se non ci sono metadati
                    'csv_info': None
                }
            
            status_list.append(status)
        
        return status_list
    
    def add_ticker(self, ticker):
        """Aggiunge un nuovo ticker alla configurazione"""
        ticker = ticker.upper().strip()
        
        if not ticker:
            return {'status': 'error', 'message': 'Ticker non valido'}
        
        # Verifica che il ticker esista su Yahoo Finance
        ticker_info = self.get_ticker_info(ticker)
        if ticker_info is None:
            return {'status': 'error', 'message': f'Ticker {ticker} non trovato su Yahoo Finance'}
        
        config = self.load_ticker_config()
        
        if ticker in config['tickers']:
            return {'status': 'warning', 'message': f'Ticker {ticker} già presente'}
        
        config['tickers'].append(ticker)
        self.save_ticker_config(config)
        
        return {
            'status': 'success',
            'message': f'Ticker {ticker} aggiunto con successo',
            'ticker_info': ticker_info
        }
    
    def remove_ticker(self, ticker):
        """Rimuove un ticker dalla configurazione e cancella i file"""
        ticker = ticker.upper()
        config = self.load_ticker_config()
        
        if ticker not in config['tickers']:
            return {'status': 'error', 'message': f'Ticker {ticker} non trovato'}
        
        config['tickers'].remove(ticker)
        self.save_ticker_config(config)
        
        # Rimuovi file
        files_to_remove = [
            self.data_dir / f"{ticker}.csv",
            self.data_dir_not_adj / f"{ticker}_notAdjusted.csv",
            self.meta_dir / f"{ticker}.json"
        ]
        
        files_removed = []
        for file_path in files_to_remove:
            if file_path.exists():
                file_path.unlink()
                files_removed.append(file_path.name)
        
        return {
            'status': 'success',
            'message': f'Ticker {ticker} rimosso con successo',
            'files_removed': files_removed
        }
    
    def test_connection(self):
        """Testa la connessione a Yahoo Finance"""
        try:
            import requests
            
            # Test connessione internet
            try:
                requests.get('https://www.google.com', timeout=5)
                internet_ok = True
            except:
                internet_ok = False
            
            # Test Yahoo Finance
            try:
                requests.get('https://finance.yahoo.com', timeout=10)
                yahoo_ok = True
            except:
                yahoo_ok = False
            
            # Test yfinance con ticker semplice
            yfinance_ok = False
            test_data = None
            try:
                data = yf.download("AAPL", period="1d", progress=False)
                if not data.empty:
                    yfinance_ok = True
                    test_data = f"AAPL: ${data['Close'].iloc[-1]:.2f}"
            except Exception as e:
                test_data = str(e)
            
            return {
                'status': 'success' if (internet_ok and yahoo_ok and yfinance_ok) else 'warning',
                'tests': {
                    'internet': internet_ok,
                    'yahoo_finance': yahoo_ok,
                    'yfinance_library': yfinance_ok
                },
                'test_data': test_data,
                'message': 'Tutti i test OK' if (internet_ok and yahoo_ok and yfinance_ok) else 'Alcuni test falliti'
            }
            
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Errore nel test: {str(e)}'
            }
    
    def process_csv_upload(self, file, download_data=False, replace_existing=False):
        """
        Processa un file CSV caricato con ticker e informazioni aziendali
        
        Args:
            file: File CSV caricato
            download_data (bool): Se scaricare automaticamente i dati
            replace_existing (bool): Se sostituire ticker esistenti
            
        Returns:
            dict: Risultato del processamento
        """
        try:
            logger.info("Inizio processamento CSV upload")
            
            # Leggi il contenuto del file
            file.seek(0)  # Assicurati di essere all'inizio del file
            csv_content = file.read().decode('utf-8')
            
            if not csv_content.strip():
                return {'status': 'error', 'message': 'File CSV vuoto'}
            
            lines = csv_content.split('\n')
            lines = [line.strip() for line in lines if line.strip()]  # Rimuovi righe vuote
            
            if len(lines) < 2:
                return {'status': 'error', 'message': 'File CSV troppo corto (meno di 2 righe)'}
            
            # Parse header
            header_line = lines[0]
            headers = [col.strip().strip('"') for col in header_line.split(',')]
            
            logger.info(f"Headers trovati: {headers}")
            
            # Verifica colonne richieste
            required_columns = ['Ticker', 'Company', 'Sector', 'Industry']
            missing_columns = [col for col in required_columns if col not in headers]
            
            if missing_columns:
                return {
                    'status': 'error', 
                    'message': f'Colonne mancanti nel CSV: {", ".join(missing_columns)}'
                }
            
            # Trova indici delle colonne
            try:
                ticker_idx = headers.index('Ticker')
                company_idx = headers.index('Company')
                sector_idx = headers.index('Sector')
                industry_idx = headers.index('Industry')
            except ValueError as e:
                return {'status': 'error', 'message': f'Errore nell\'identificare le colonne: {str(e)}'}
            
            # Processa le righe di dati
            data_lines = lines[1:]
            
            if not data_lines:
                return {'status': 'error', 'message': 'Nessun dato trovato nel CSV'}
            
            logger.info(f"Processamento {len(data_lines)} ticker dal CSV")
            
            # Carica configurazione esistente con protezione
            try:
                config = self.load_ticker_config()
                if config is None:
                    config = {'tickers': [], 'last_updated': None}
            except Exception as e:
                logger.error(f"Errore caricamento configurazione: {e}")
                config = {'tickers': [], 'last_updated': None}
            
            # Crea una copia di backup della configurazione
            original_tickers = config['tickers'][:]
            
            results = []
            added_count = 0
            updated_count = 0
            skipped_count = 0
            error_count = 0
            
            for line_num, line in enumerate(data_lines, 2):  # Start from line 2
                try:
                    # Parse CSV line manualmente per gestire virgole nei campi
                    cells = []
                    current_cell = ""
                    in_quotes = False
                    
                    for char in line:
                        if char == '"':
                            in_quotes = not in_quotes
                        elif char == ',' and not in_quotes:
                            cells.append(current_cell.strip().strip('"'))
                            current_cell = ""
                        else:
                            current_cell += char
                    
                    # Aggiungi l'ultima cella
                    cells.append(current_cell.strip().strip('"'))
                    
                    if len(cells) < len(required_columns):
                        results.append({
                            'ticker': f'Line {line_num}',
                            'status': 'error',
                            'message': f'Riga incompleta: {len(cells)} colonne invece di {len(required_columns)}'
                        })
                        error_count += 1
                        continue
                    
                    ticker = cells[ticker_idx].upper().strip()
                    company = cells[company_idx].strip()
                    sector = cells[sector_idx].strip()
                    industry = cells[industry_idx].strip()
                    
                    if not ticker:
                        results.append({
                            'ticker': f'Line {line_num}',
                            'status': 'error',
                            'message': 'Ticker vuoto'
                        })
                        error_count += 1
                        continue
                    
                    # Crea info ticker dal CSV
                    csv_ticker_info = {
                        'symbol': ticker,
                        'name': company or ticker,
                        'sector': sector or 'N/A',
                        'industry': industry or 'N/A',
                        'currency': 'USD',
                        'exchange': 'N/A',
                        'country': 'N/A',
                        'source': 'CSV'  # Indica che viene dal CSV
                    }
                    
                    # Verifica se il ticker esiste già
                    ticker_exists = ticker in config['tickers']
                    
                    if ticker_exists and not replace_existing:
                        results.append({
                            'ticker': ticker,
                            'status': 'warning',
                            'message': 'Ticker già presente (saltato)'
                        })
                        skipped_count += 1
                        continue
                    
                    # Aggiungi o aggiorna ticker
                    if not ticker_exists:
                        config['tickers'].append(ticker)
                        added_count += 1
                        action = 'aggiunto'
                    else:
                        updated_count += 1
                        action = 'aggiornato'
                    
                    # Salva/aggiorna metadati con info CSV
                    meta_data = {
                        'ticker': ticker,
                        'info': csv_ticker_info,
                        'last_close_date': None,
                        'first_date': None,
                        'total_records': 0,
                        'last_updated': datetime.now().isoformat(),
                        'csv_import': {
                            'imported_at': datetime.now().isoformat(),
                            'company': company,
                            'sector': sector,
                            'industry': industry
                        },
                        'files': {
                            'adjusted': str(self.data_dir / f"{ticker}.csv"),
                            'not_adjusted': str(self.data_dir_not_adj / f"{ticker}_notAdjusted.csv")
                        }
                    }
                    
                    # Salva metadati
                    try:
                        self.save_ticker_meta(ticker, meta_data)
                    except Exception as meta_error:
                        logger.error(f"Errore salvando metadati per {ticker}: {meta_error}")
                        # Non bloccare per errori metadati
                    
                    results.append({
                        'ticker': ticker,
                        'status': 'success',
                        'message': f'Ticker {action}: {company}'
                    })
                    
                except Exception as e:
                    logger.error(f"Errore processamento riga {line_num}: {e}")
                    results.append({
                        'ticker': f'Line {line_num}',
                        'status': 'error',
                        'message': f'Errore: {str(e)}'
                    })
                    error_count += 1
            
            # Salva configurazione aggiornata solo se non ci sono stati errori critici
            try:
                if added_count > 0 or updated_count > 0:
                    self.save_ticker_config(config)
                    logger.info(f"Configurazione salvata con successo")
                else:
                    logger.info("Nessuna modifica alla configurazione")
            except Exception as save_error:
                logger.error(f"Errore nel salvare configurazione: {save_error}")
                # Ripristina la configurazione originale
                config['tickers'] = original_tickers
                return {
                    'status': 'error',
                    'message': f'Errore nel salvare la configurazione: {str(save_error)}'
                }
            
            # Prepara risultato
            summary = {
                'total_tickers': len(data_lines),
                'added_tickers': added_count,
                'updated_tickers': updated_count,
                'skipped_tickers': skipped_count,
                'error_count': error_count
            }
            
            logger.info(f"CSV processato: {added_count} aggiunti, {updated_count} aggiornati, {skipped_count} saltati, {error_count} errori")
            
            message = f"CSV importato con successo: {added_count} ticker aggiunti"
            if updated_count > 0:
                message += f", {updated_count} aggiornati"
            if skipped_count > 0:
                message += f", {skipped_count} saltati"
            if error_count > 0:
                message += f", {error_count} errori"
            
            return {
                'status': 'success',
                'message': message,
                'summary': summary,
                'details': results
            }
            
        except Exception as e:
            logger.error(f"Errore processamento CSV: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                'status': 'error',
                'message': f'Errore processamento CSV: {str(e)}'
            }