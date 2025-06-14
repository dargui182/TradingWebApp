import json
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Union
import uuid

class SkorupinkiZoneManager:
    """
    Classe dedicata al calcolo di zone Supply/Demand usando l'algoritmo Skorupinski.
    Versione corretta con tutti i metodi al posto giusto.
    """
    
    def __init__(self, 
                 input_file: Path, 
                 input_folder_prices: Path, 
                 output_folder: Path,
                 min_pullback_pct: float = 2.0,
                 zone_thickness_pct: float = 0.3,
                 max_lookback_bars: int = 60,
                 min_zone_strength: int = 1,
                 max_years_lookback: int = 5,
                 min_impulse_pct: float = 1.2,
                 max_base_bars: int = 10):
        """
        Inizializza il manager delle zone Skorupinski.
        """
        self.input_file = input_file
        self.input_folder_prices = input_folder_prices
        self.output_folder = output_folder
        self.min_pullback_pct = min_pullback_pct
        self.zone_thickness_pct = zone_thickness_pct
        self.max_lookback_bars = max_lookback_bars
        self.min_zone_strength = min_zone_strength
        self.max_years_lookback = max_years_lookback
        self.min_impulse_pct = min_impulse_pct
        self.max_base_bars = max_base_bars
        
        # Carica stato tickers
        self.tickers = self._load_tickers()
        
        # Assicurati che la cartella di output esista
        self.output_folder.mkdir(parents=True, exist_ok=True)
    
    def _load_tickers(self) -> Dict[str, Union[str, Dict]]:
        """Carica ticker con supporto parametri personalizzati."""
        if not self.input_file.exists():
            print(f"📝 File di stato Skorupinski non trovato, lo creo: {self.input_file}")
            
            # Crea directory se non esiste
            self.input_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Carica ticker dal file di configurazione principale
            config_file = Path('resources/config/tickers.json')
            tickers = []
            
            if config_file.exists():
                with open(config_file, 'r') as f:
                    config = json.load(f)
                    tickers = config.get('tickers', [])
            
            # Crea file di stato iniziale
            initial_state = {}
            for ticker in tickers:
                initial_state[ticker] = "1900-01-01T00:00:00"
            
            with open(self.input_file, 'w', encoding='utf-8') as f:
                json.dump(initial_state, f, indent=2, ensure_ascii=False)
            
            print(f"✅ File di stato Skorupinski creato con {len(tickers)} ticker")
            
            # Converti in formato normalizzato
            normalized_tickers = {}
            for ticker in tickers:
                normalized_tickers[ticker] = {
                    'timestamp': "1900-01-01T00:00:00",
                    'custom_params': {}
                }
            
            return normalized_tickers
        
        # Resto del codice originale per caricare file esistente...
        with open(self.input_file, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
        
        # (mantieni il resto del metodo originale)
        
        # Analizza formato e normalizza
        normalized_tickers = {}
        legacy_count = 0
        enhanced_count = 0
        
        for ticker, config in raw_data.items():
            if isinstance(config, str):
                # Formato LEGACY: ticker -> timestamp
                normalized_tickers[ticker] = {
                    'timestamp': config,
                    'custom_params': {}
                }
                legacy_count += 1
            elif isinstance(config, dict):
                # Formato ENHANCED: ticker -> {timestamp, params...}
                if 'timestamp' not in config:
                    raise ValueError(f"Ticker {ticker}: manca campo 'timestamp' nella configurazione")
                
                timestamp = config.pop('timestamp')  # Rimuovi timestamp dai parametri
                custom_params = config  # Tutti gli altri sono parametri custom
                
                normalized_tickers[ticker] = {
                    'timestamp': timestamp,
                    'custom_params': custom_params
                }
                enhanced_count += 1
            else:
                raise ValueError(f"Ticker {ticker}: formato configurazione non valido")
        
        print(f"📂 Caricati {len(normalized_tickers)} ticker dal JSON:")
        print(f"   📜 Legacy format: {legacy_count} ticker")
        print(f"   🎛️ Enhanced format: {enhanced_count} ticker")
        
        return normalized_tickers
    
    def _get_ticker_parameters(self, ticker: str) -> Dict[str, float]:
        """Ottiene parametri finali per un ticker (default + custom override)."""
        # Parametri di default dalla classe
        default_params = {
            'min_pullback_pct': self.min_pullback_pct,
            'zone_thickness_pct': self.zone_thickness_pct,
            'max_lookback_bars': self.max_lookback_bars,
            'min_zone_strength': self.min_zone_strength,
            'max_years_lookback': self.max_years_lookback,
            'min_impulse_pct': self.min_impulse_pct,
            'max_base_bars': self.max_base_bars
        }
        
        # Parametri custom dal JSON (se presenti)
        ticker_config = self.tickers.get(ticker, {})
        custom_params = ticker_config.get('custom_params', {})
        
        # Merge: custom sovrascrive default
        final_params = default_params.copy()
        final_params.update(custom_params)
        
        return final_params
    
    def _get_ticker_timestamp(self, ticker: str) -> str:
        """Ottiene timestamp per un ticker dal formato normalizzato."""
        ticker_config = self.tickers.get(ticker, {})
        return ticker_config.get('timestamp', '')
    
    def _load_price_data(self, ticker: str) -> pd.DataFrame:
        """🔧 FIX: Carica i dati storici di prezzo per un ticker."""
        file_path = self.input_folder_prices / f"{ticker}.csv"
        
        if not file_path.exists():
            raise FileNotFoundError(f"Dati prezzi non trovati per {ticker}: {file_path}")
        
        df = pd.read_csv(file_path, parse_dates=['Date'])
        df.sort_values('Date', inplace=True)
        df.reset_index(drop=True, inplace=True)
        
        # Normalizza nomi colonne
        df.columns = df.columns.str.capitalize()
        
        # Verifica colonne necessarie
        required_cols = ['Date', 'Open', 'High', 'Low', 'Close']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Colonne mancanti per {ticker}: {missing_cols}")
        
        return df
    
    def _filter_data_by_timeframe(self, df: pd.DataFrame, ticker: str) -> pd.DataFrame:
        """Filtra i dati per limitarli agli ultimi N anni specificati."""
        if df.empty:
            return df
        
        latest_date = df['Date'].max()
        cutoff_date = latest_date - timedelta(days=365 * self.max_years_lookback)
        
        filtered_df = df[df['Date'] >= cutoff_date].copy()
        filtered_df.reset_index(drop=True, inplace=True)
        
        print(f"    📅 {ticker}: filtrati dati da {cutoff_date.strftime('%Y-%m-%d')} "
              f"a {latest_date.strftime('%Y-%m-%d')} ({len(filtered_df)} righe)")
        
        return filtered_df
    
    def _needs_recalculation(self, ticker: str, df: pd.DataFrame) -> bool:
        """🔧 FIX: Determina se è necessario ricalcolare le zone per un ticker."""
        last_processed_str = self._get_ticker_timestamp(ticker)
        if not last_processed_str:
            print(f"    ⚠️ {ticker}: nessuna data di ultimo aggiornamento trovata, ricalcolo necessario")
            return True
        
        try:
            last_processed = datetime.fromisoformat(last_processed_str.replace('Z', '+00:00'))
            if last_processed.tzinfo:
                last_processed = last_processed.replace(tzinfo=None)
        except ValueError:
            print(f"    ⚠️ {ticker}: formato data non valido ({last_processed_str}), ricalcolo necessario")
            return True
        
        latest_data_date = df['Date'].max()
        if pd.isna(latest_data_date):
            print(f"    ⚠️ {ticker}: nessuna data valida nei dati")
            return False
        
        if hasattr(latest_data_date, 'to_pydatetime'):
            latest_data_date = latest_data_date.to_pydatetime()
        
        last_processed_date = last_processed.date()
        latest_data_date = latest_data_date.date()
        
        needs_update = latest_data_date > last_processed_date
        
        if needs_update:
            print(f"    🔄 {ticker}: nuovi dati disponibili (ultimo processato: {last_processed_date}, "
                  f"ultimo disponibile: {latest_data_date})")
        else:
            print(f"    ✅ {ticker}: nessun nuovo dato (ultimo: {latest_data_date}), "
                  f"ricalcolo non necessario")
        
        return needs_update
    
    def _update_ticker_timestamp(self, ticker: str, latest_date: datetime):
        """Aggiorna il timestamp per un ticker nel file JSON di stato."""
        try:
            with open(self.input_file, 'r', encoding='utf-8') as f:
                current_state = json.load(f)
            
            # Preserva formato: se era dict mantieni dict, se era string mantieni string
            current_config = current_state.get(ticker)
            new_timestamp = latest_date.isoformat()
            
            if isinstance(current_config, dict):
                # Formato enhanced: aggiorna solo timestamp
                current_config['timestamp'] = new_timestamp
            else:
                # Formato legacy: aggiorna direttamente
                current_state[ticker] = new_timestamp
            
            with open(self.input_file, 'w', encoding='utf-8') as f:
                json.dump(current_state, f, indent=2, ensure_ascii=False)
            
            print(f"    📝 {ticker}: timestamp aggiornato a {latest_date.strftime('%Y-%m-%d')}")
            
        except Exception as e:
            print(f"    ⚠️ Errore nell'aggiornamento timestamp per {ticker}: {str(e)}")
    
    def _load_existing_zones(self, ticker: str) -> pd.DataFrame:
        """Carica le zone esistenti con gestione completa colonne mancanti."""
        file_path = self.output_folder / f"{ticker}_SkorupinkiZones.csv"
        
        if not file_path.exists():
            return pd.DataFrame()
        
        try:
            df = pd.read_csv(file_path, parse_dates=['date'])
            
            # Assicura che tutte le colonne necessarie esistano
            required_columns = {
                'visibility': True,
                'source': 'auto', 
                'description': '',
                'zone_id': lambda: str(uuid.uuid4()),
                'created_at': lambda: datetime.now().isoformat(),
                'last_modified': lambda: datetime.now().isoformat(),
                'formation_type': 'legacy',
                'algorithm_version': '1.0'
            }
            
            missing_columns = []
            for col, default_value in required_columns.items():
                if col not in df.columns:
                    missing_columns.append(col)
                    if callable(default_value):
                        df[col] = [default_value() for _ in range(len(df))]
                    else:
                        df[col] = default_value
            
            if missing_columns:
                print(f"    🔧 {ticker}: aggiunte colonne mancanti: {missing_columns}")
                # Salva il CSV aggiornato con le nuove colonne
                output_file = self.output_folder / f"{ticker}_SkorupinkiZones.csv"
                df.to_csv(output_file, index=False, date_format='%Y-%m-%d')
                print(f"    💾 {ticker}: CSV aggiornato con colonne complete")
            
            print(f"    📂 {ticker}: caricate {len(df)} zone esistenti con {len(df.columns)} colonne")
            return df
            
        except Exception as e:
            print(f"    ⚠️ {ticker}: errore nel caricamento zone esistenti: {str(e)}")
            return pd.DataFrame()
    
    def _ensure_all_columns_in_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Assicura che il DataFrame abbia tutte le colonne necessarie."""
        expected_columns = [
            'ticker', 'date', 'pattern', 'type', 'zone_bottom', 'zone_top', 
            'zone_center', 'index', 'distance_from_current', 'pullback_strength',
            'pullback_direction', 'test_count', 'days_ago', 'strength_score',
            'virgin_zone', 'zone_thickness', 'zone_thickness_pct', 
            'base_candle_count', 'compression_bars', 'formation_type',
            'algorithm_version', 'leg_in_idx', 'leg_out_idx',
            'zone_id', 'visibility', 'source', 'description', 
            'created_at', 'last_modified'
        ]
        
        # Aggiungi colonne mancanti con valori di default
        for col in expected_columns:
            if col not in df.columns:
                if col == 'zone_id':
                    df[col] = [str(uuid.uuid4()) for _ in range(len(df))]
                elif col == 'visibility':
                    df[col] = True
                elif col == 'source':
                    df[col] = 'auto'
                elif col == 'description':
                    df[col] = ''
                elif col in ['created_at', 'last_modified']:
                    df[col] = datetime.now().isoformat()
                elif col == 'virgin_zone':
                    df[col] = True
                else:
                    df[col] = 0 if col in ['index', 'test_count', 'days_ago'] else None
        
        return df
    
    def _zones_overlap(self, zone1: Dict, zone2: Dict, overlap_threshold: float = 0.05) -> bool:
        """Verifica se due zone si sovrappongono."""
        # Solo zone dello stesso tipo possono sovrapporsi
        if zone1['type'] != zone2['type']:
            return False
        
        # Calcola range e tolerance
        zone1_range = zone1['zone_top'] - zone1['zone_bottom']
        zone2_range = zone2['zone_top'] - zone2['zone_bottom']
        min_range = min(zone1_range, zone2_range)
        
        if min_range <= 0:
            return False
        
        tolerance = min_range * overlap_threshold
        
        # Verifica overlap
        return (
            (zone1['zone_top'] >= zone2['zone_bottom'] - tolerance and 
             zone1['zone_top'] <= zone2['zone_top'] + tolerance) or
            (zone1['zone_bottom'] >= zone2['zone_bottom'] - tolerance and 
             zone1['zone_bottom'] <= zone2['zone_top'] + tolerance) or
            (zone1['zone_bottom'] <= zone2['zone_bottom'] and 
             zone1['zone_top'] >= zone2['zone_top'])
        )
    
    def _filter_new_zones_against_existing(self, new_zones: List[Dict], existing_zones: pd.DataFrame) -> List[Dict]:
        """Filtra le nuove zone per evitare overlap con quelle esistenti."""
        if existing_zones.empty:
            return new_zones
        
        filtered_zones = []
        existing_zones_list = existing_zones.to_dict('records')
        
        for new_zone in new_zones:
            overlaps = False
            
            for existing_zone in existing_zones_list:
                if self._zones_overlap(new_zone, existing_zone):
                    overlaps = True
                    print(f"    🔄 Zona {new_zone['pattern']} @ {new_zone['zone_center']:.4f} "
                          f"sovrapposta a zona esistente, ignorata")
                    break
            
            if not overlaps:
                filtered_zones.append(new_zone)
                print(f"    ✅ Zona {new_zone['pattern']} @ {new_zone['zone_center']:.4f} aggiunta")
        
        return filtered_zones
    
    def _prepare_zone_for_save(self, zone: Dict, source: str = 'auto') -> Dict:
        """Prepara una zona per il salvataggio aggiungendo metadati."""
        enhanced_zone = zone.copy()
        enhanced_zone.update({
            'zone_id': str(uuid.uuid4()),
            'visibility': True,
            'source': source,
            'created_at': datetime.now().isoformat(),
            'last_modified': datetime.now().isoformat()
        })
        return enhanced_zone
    
    
    def _find_skorupinski_zones(self, df: pd.DataFrame, ticker: str, custom_params: Dict[str, float] = None) -> List[Dict]:
        """
        🔧 FIX: Implementazione REALE per trovare zone Skorupinski.
        Sostituisce il placeholder vuoto.
        """
        from moduls.TechnicalAnalysis.ImprovedSkorupinkiPatterns import ImprovedSkorupinkiPatterns
        
        print(f"    🎯 Analisi zone Skorupinski REALE per {ticker}")
        zones = []
        
        if len(df) < 6:
            print(f"    ⚠️ {ticker}: dati insufficienti per l'analisi")
            return zones
        
        # Inizializza l'analyzer migliorato
        improved_analyzer = ImprovedSkorupinkiPatterns(
            min_impulse_pct=self.min_impulse_pct,
            max_base_bars=self.max_base_bars
        )
        
        current_price = df.iloc[-1]['Close']
        current_idx = len(df) - 1
        start_idx = max(0, current_idx - self.max_lookback_bars)
        
        print(f"    💰 Prezzo attuale: {current_price:.4f}")
        print(f"    📊 Analisi da indice {start_idx} a {current_idx}")
        
        # Cerca tutti i pattern usando l'implementazione reale
        pattern_methods = [
            ('RBD', improved_analyzer._find_rbd_pattern),  # Supply
            ('DBD', improved_analyzer._find_dbd_pattern),  # Supply  
            ('DBR', improved_analyzer._find_dbr_pattern),  # Demand
            ('RBR', improved_analyzer._find_rbr_pattern)   # Demand
        ]
        
        # Scansiona tutto il range di dati
        for i in range(start_idx + 6, len(df)):
            for pattern_name, method in pattern_methods:
                try:
                    pattern = method(df, i)
                    if pattern:
                        print(f"    🔍 PATTERN {pattern['pattern']} ({pattern['type']}) trovato @ index {i}")
                        
                        # Converti nel formato compatibile
                        zone = {
                            'pattern': pattern['pattern'],
                            'type': pattern['type'],
                            'zone_bottom': pattern['zone_low'],
                            'zone_top': pattern['zone_high'],
                            'zone_center': pattern['zone_center'],
                            'date': pattern['formation_date'],
                            'index': pattern['base_start_idx'],
                            'leg_in_idx': pattern.get('leg_in_idx'),
                            'leg_out_idx': pattern.get('leg_out_idx'),
                            'base_candle_count': pattern.get('base_candle_count', 1),
                            'formation_candles': []
                        }
                        
                        # Applica validazioni esistenti
                        if not self._is_zone_valid(df, zone, zone['index'], current_price):
                            print(f"    ❌ Zona {zone['pattern']} invalidata (zona non valida)")
                            continue
                        
                        pullback_info = self._has_pullback(df, zone, zone['index'])
                        if not pullback_info['has_pullback']:
                            print(f"    ❌ Zona {zone['pattern']} invalidata (pullback insufficiente)")
                            continue
                        
                        test_count = self._count_zone_tests(df, zone, zone['index'])
                        if test_count < self.min_zone_strength:
                            print(f"    ❌ Zona {zone['pattern']} invalidata (forza insufficiente)")
                            continue
                        
                        # Calcola metriche finali
                        days_ago = current_idx - zone['index']
                        distance_from_current = (
                            ((current_price - zone['zone_center']) / current_price * 100) 
                            if zone['type'] == 'Demand' 
                            else ((zone['zone_center'] - current_price) / current_price * 100)
                        )
                        
                        # Crea zona finale con tutte le info
                        final_zone = {
                            'ticker': ticker,
                            'date': zone['date'],
                            'pattern': zone['pattern'],
                            'type': zone['type'],
                            'zone_bottom': round(zone['zone_bottom'], 4),
                            'zone_top': round(zone['zone_top'], 4),
                            'zone_center': round(zone['zone_center'], 4),
                            'index': zone['index'],
                            'distance_from_current': round(distance_from_current, 2),
                            'pullback_strength': round(pullback_info['pullback_strength'], 2),
                            'pullback_direction': pullback_info['pullback_direction'],
                            'test_count': test_count,
                            'days_ago': days_ago,
                            'strength_score': self._calculate_zone_strength(zone, pullback_info, test_count, days_ago),
                            'virgin_zone': test_count == 1,
                            'zone_thickness': round(zone['zone_top'] - zone['zone_bottom'], 4),
                            'zone_thickness_pct': round((zone['zone_top'] - zone['zone_bottom']) / zone['zone_center'] * 100, 2),
                            'leg_in_idx': zone.get('leg_in_idx'),
                            'leg_out_idx': zone.get('leg_out_idx'),
                            'base_candle_count': zone.get('base_candle_count', 1),
                            'formation_type': 'improved_skorupinski'
                        }
                        
                        print(f"    ✅ {zone['pattern']} ({zone['type']}): "
                            f"{zone['date']} | "
                            f"{zone['zone_bottom']:.4f}-{zone['zone_top']:.4f} | "
                            f"Base: {zone.get('base_candle_count', 1)} candele | "
                            f"Score: {final_zone['strength_score']:.2f}")
                        
                        zones.append(final_zone)
                        
                except Exception as e:
                    print(f"    ⚠️ Errore nella ricerca pattern {pattern_name}: {str(e)}")
        
        print(f"    📊 Trovate {len(zones)} zone Skorupinski per {ticker}")
        return zones


    # Aggiungi anche questi metodi mancanti se non esistono già:

    def _is_zone_valid(self, df: pd.DataFrame, zone: Dict, zone_index: int, current_price: float) -> bool:
        """Verifica se una zona è valida."""
        try:
            # Verifica che la zona non sia troppo vicina al prezzo attuale
            zone_center = zone['zone_center']
            distance_pct = abs(current_price - zone_center) / current_price * 100
            
            # Deve essere almeno 0.5% distante dal prezzo attuale
            return distance_pct >= 0.5
        except:
            return False

    def _has_pullback(self, df: pd.DataFrame, zone: Dict, zone_index: int) -> Dict:
        """Verifica se c'è stato un pullback dalla zona."""
        try:
            zone_center = zone['zone_center']
            zone_type = zone['type']
            
            # Cerca pullback nelle candele successive
            pullback_strength = 0.0
            pullback_direction = 'none'
            
            for i in range(zone_index + 1, min(zone_index + 20, len(df))):
                current_close = df.iloc[i]['Close']
                
                if zone_type == 'Demand':
                    # Per zone demand, cerco movimento verso l'alto
                    move_pct = (current_close - zone_center) / zone_center * 100
                    if move_pct > pullback_strength:
                        pullback_strength = move_pct
                        pullback_direction = 'up'
                else:  # Supply
                    # Per zone supply, cerco movimento verso il basso  
                    move_pct = (zone_center - current_close) / zone_center * 100
                    if move_pct > pullback_strength:
                        pullback_strength = move_pct
                        pullback_direction = 'down'
            
            has_pullback = pullback_strength >= self.min_pullback_pct
            
            return {
                'has_pullback': has_pullback,
                'pullback_strength': pullback_strength,
                'pullback_direction': pullback_direction
            }
        except:
            return {'has_pullback': False, 'pullback_strength': 0.0, 'pullback_direction': 'none'}

    def _count_zone_tests(self, df: pd.DataFrame, zone: Dict, zone_index: int) -> int:
        """Conta quante volte il prezzo ha testato la zona."""
        try:
            zone_bottom = zone['zone_bottom']
            zone_top = zone['zone_top']
            tests = 0
            
            # Conta i test nelle candele successive alla formazione
            for i in range(zone_index + 1, len(df)):
                candle_low = df.iloc[i]['Low']
                candle_high = df.iloc[i]['High']
                
                # Verifica se il prezzo ha toccato la zona
                if (candle_low <= zone_top and candle_high >= zone_bottom):
                    tests += 1
            
            return max(1, tests)  # Almeno 1 test (la formazione stessa)
        except:
            return 1

    def _calculate_zone_strength(self, zone: Dict, pullback_info: Dict, test_count: int, days_ago: int) -> float:
        """Calcola il punteggio di forza della zona."""
        try:
            # Punteggio base dal pullback
            pullback_score = min(pullback_info['pullback_strength'] / 5.0, 2.0)
            
            # Punteggio dai test (più test = più forte)
            test_score = min(test_count * 0.5, 2.0)
            
            # Punteggio temporale (zone più recenti sono più rilevanti)
            recency_score = max(0.1, 2.0 - (days_ago / 100.0))
            
            # Punteggio spessore zona (zone più sottili sono migliori)
            thickness_pct = zone.get('zone_thickness_pct', 1.0)
            thickness_score = max(0.1, 2.0 - thickness_pct)
            
            total_score = pullback_score + test_score + recency_score + thickness_score
            return round(total_score, 2)
        except:
            return 1.0
        """
        🔧 FIX: Implementazione REALE per trovare zone Skorupinski.
        Sostituisce il placeholder vuoto.
        """
        from moduls.TechnicalAnalysis.ImprovedSkorupinkiPatterns import ImprovedSkorupinkiPatterns
        
        print(f"    🎯 Analisi zone Skorupinski REALE per {ticker}")
        zones = []
        
        if len(df) < 6:
            print(f"    ⚠️ {ticker}: dati insufficienti per l'analisi")
            return zones
        
        # Inizializza l'analyzer migliorato
        improved_analyzer = ImprovedSkorupinkiPatterns(
            min_impulse_pct=self.min_impulse_pct,
            max_base_bars=self.max_base_bars
        )
        
        current_price = df.iloc[-1]['Close']
        current_idx = len(df) - 1
        start_idx = max(0, current_idx - self.max_lookback_bars)
        
        print(f"    💰 Prezzo attuale: {current_price:.4f}")
        print(f"    📊 Analisi da indice {start_idx} a {current_idx}")
        
        # Cerca tutti i pattern usando l'implementazione reale
        pattern_methods = [
            ('RBD', improved_analyzer._find_rbd_pattern),  # Supply
            ('DBD', improved_analyzer._find_dbd_pattern),  # Supply  
            ('DBR', improved_analyzer._find_dbr_pattern),  # Demand
            ('RBR', improved_analyzer._find_rbr_pattern)   # Demand
        ]
        
        # Scansiona tutto il range di dati
        for i in range(start_idx + 6, len(df)):
            for pattern_name, method in pattern_methods:
                try:
                    pattern = method(df, i)
                    if pattern:
                        print(f"    🔍 PATTERN {pattern['pattern']} ({pattern['type']}) trovato @ index {i}")
                        
                        # Converti nel formato compatibile
                        zone = {
                            'pattern': pattern['pattern'],
                            'type': pattern['type'],
                            'zone_bottom': pattern['zone_low'],
                            'zone_top': pattern['zone_high'],
                            'zone_center': pattern['zone_center'],
                            'date': pattern['formation_date'],
                            'index': pattern['base_start_idx'],
                            'leg_in_idx': pattern.get('leg_in_idx'),
                            'leg_out_idx': pattern.get('leg_out_idx'),
                            'base_candle_count': pattern.get('base_candle_count', 1),
                            'formation_candles': []
                        }
                        
                        # Applica validazioni esistenti
                        if not self._is_zone_valid(df, zone, zone['index'], current_price):
                            print(f"    ❌ Zona {zone['pattern']} invalidata (zona non valida)")
                            continue
                        
                        pullback_info = self._has_pullback(df, zone, zone['index'])
                        if not pullback_info['has_pullback']:
                            print(f"    ❌ Zona {zone['pattern']} invalidata (pullback insufficiente)")
                            continue
                        
                        test_count = self._count_zone_tests(df, zone, zone['index'])
                        if test_count < self.min_zone_strength:
                            print(f"    ❌ Zona {zone['pattern']} invalidata (forza insufficiente)")
                            continue
                        
                        # Calcola metriche finali
                        days_ago = current_idx - zone['index']
                        distance_from_current = (
                            ((current_price - zone['zone_center']) / current_price * 100) 
                            if zone['type'] == 'Demand' 
                            else ((zone['zone_center'] - current_price) / current_price * 100)
                        )
                        
                        # Crea zona finale con tutte le info
                        final_zone = {
                            'ticker': ticker,
                            'date': zone['date'],
                            'pattern': zone['pattern'],
                            'type': zone['type'],
                            'zone_bottom': round(zone['zone_bottom'], 4),
                            'zone_top': round(zone['zone_top'], 4),
                            'zone_center': round(zone['zone_center'], 4),
                            'index': zone['index'],
                            'distance_from_current': round(distance_from_current, 2),
                            'pullback_strength': round(pullback_info['pullback_strength'], 2),
                            'pullback_direction': pullback_info['pullback_direction'],
                            'test_count': test_count,
                            'days_ago': days_ago,
                            'strength_score': self._calculate_zone_strength(zone, pullback_info, test_count, days_ago),
                            'virgin_zone': test_count == 1,
                            'zone_thickness': round(zone['zone_top'] - zone['zone_bottom'], 4),
                            'zone_thickness_pct': round((zone['zone_top'] - zone['zone_bottom']) / zone['zone_center'] * 100, 2),
                            'leg_in_idx': zone.get('leg_in_idx'),
                            'leg_out_idx': zone.get('leg_out_idx'),
                            'base_candle_count': zone.get('base_candle_count', 1),
                            'formation_type': 'improved_skorupinski'
                        }
                        
                        print(f"    ✅ {zone['pattern']} ({zone['type']}): "
                            f"{zone['date']} | "
                            f"{zone['zone_bottom']:.4f}-{zone['zone_top']:.4f} | "
                            f"Base: {zone.get('base_candle_count', 1)} candele | "
                            f"Score: {final_zone['strength_score']:.2f}")
                        
                        zones.append(final_zone)
                        
                except Exception as e:
                    print(f"    ⚠️ Errore nella ricerca pattern {pattern_name}: {str(e)}")
        
        print(f"    📊 Trovate {len(zones)} zone Skorupinski per {ticker}")
        return zones


        
    def process_ticker(self, ticker: str) -> bool:
            """🔧 FIX: Elabora un ticker con parametri personalizzati."""
            try:
                print(f"  🎯 Elaborazione {ticker}...")
                
                # Ottieni parametri specifici per questo ticker
                ticker_params = self._get_ticker_parameters(ticker)
                
                # Carica dati prezzi usando il metodo corretto
                df = self._load_price_data(ticker)
                
                # Filtra per periodo massimo usando il metodo corretto
                df_filtered = self._filter_data_by_timeframe(df, ticker)
                
                if df_filtered.empty:
                    print(f"    ⚠️ {ticker}: nessun dato nel periodo richiesto")
                    return False
                
                # Controlla se serve ricalcolare
                if not self._needs_recalculation(ticker, df_filtered):
                    return True
                
                # Carica zone esistenti PRIMA di calcolare quelle nuove
                existing_zones = self._load_existing_zones(ticker)
                
                # Trova nuove zone con parametri personalizzati
                new_zones_data = self._find_skorupinski_zones(df_filtered, ticker, ticker_params)
                
                if new_zones_data:
                    # Filtra nuove zone per evitare overlap con esistenti
                    if not existing_zones.empty:
                        print(f"    🔄 Filtro {len(new_zones_data)} nuove zone contro {len(existing_zones)} esistenti...")
                        new_zones_data = self._filter_new_zones_against_existing(new_zones_data, existing_zones)
                    
                    # Prepara nuove zone per il salvataggio
                    enhanced_new_zones = [self._prepare_zone_for_save(zone, 'auto') for zone in new_zones_data]
                    
                    # Combina zone esistenti e nuove
                    if not existing_zones.empty:
                        existing_zones_list = existing_zones.to_dict('records')
                        all_zones = existing_zones_list + enhanced_new_zones
                        print(f"    🔗 Combinate {len(existing_zones)} zone esistenti + {len(enhanced_new_zones)} nuove = {len(all_zones)} totali")
                    else:
                        all_zones = enhanced_new_zones
                        print(f"    ✨ Prime {len(enhanced_new_zones)} zone per {ticker}")
                    
                    # Crea DataFrame e salva
                    df_zones = pd.DataFrame(all_zones)
                    
                    # Assicura che tutte le colonne siano presenti
                    df_zones = self._ensure_all_columns_in_dataframe(df_zones)
                    
                    # Ordina per forza decrescente
                    df_zones = df_zones.sort_values('strength_score', ascending=False)
                    
                    output_file = self.output_folder / f"{ticker}_SkorupinkiZones.csv"
                    df_zones.to_csv(output_file, index=False, date_format='%Y-%m-%d')
                    
                    # Aggiorna timestamp nel file JSON
                    latest_date = df_filtered['Date'].max()
                    if hasattr(latest_date, 'to_pydatetime'):
                        latest_date = latest_date.to_pydatetime()
                    self._update_ticker_timestamp(ticker, latest_date)
                    
                    print(f"    ✅ {ticker}: {len(all_zones)} zone totali salvate")
                    return True
                else:
                    print(f"    ⚠️ {ticker}: nessuna nuova zona trovata")
                    # Anche se non ci sono nuove zone, aggiorna il timestamp
                    latest_date = df_filtered['Date'].max()
                    if hasattr(latest_date, 'to_pydatetime'):
                        latest_date = latest_date.to_pydatetime()
                    self._update_ticker_timestamp(ticker, latest_date)
                    return True
                    
            except Exception as e:
                print(f"    ❌ Errore per {ticker}: {str(e)}")
                return False
        
    def run(self) -> Dict[str, bool]:
            """Esegue il calcolo con parametri personalizzati per ticker."""
            print("🔧▶️ START CALCOLO ZONE SKORUPINSKI - VERSIONE CORRETTA")
            
            results = {}
            
            for ticker in self.tickers.keys():
                results[ticker] = self.process_ticker(ticker)
            
            successful = sum(results.values())
            total = len(results)
            
            print(f"🔧✅ END CALCOLO ZONE SKORUPINSKI: {successful}/{total} ticker elaborati")
            
            return results