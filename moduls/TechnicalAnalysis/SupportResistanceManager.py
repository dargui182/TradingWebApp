import json
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple

class SupportResistanceManager:
    """
    Classe dedicata al calcolo di supporti e resistenze per dati storici di prezzo.
    Legge i ticker da un file JSON di stato e salva i livelli S/R in CSV separati.
    """
    
    def __init__(self, 
                 input_file: Path, 
                 input_folder_prices: Path, 
                 output_folder: Path,
                 min_distance_factor: float = 0.5,
                 touch_tolerance_factor: float = 0.1,
                 max_years_lookback: int = 5):
        """
        Parameters:
            input_file (Path): file JSON con stato {ticker: last_timestamp}
            input_folder_prices (Path): cartella contenente i CSV dei prezzi
            output_folder (Path): cartella dove salvare i CSV dei supporti/resistenze
            min_distance_factor (float): fattore per distanza minima tra livelli (default: 0.5 * avg_range)
            touch_tolerance_factor (float): fattore per tolleranza nel conteggio tocchi (default: 0.1 * avg_range)
            max_years_lookback (int): massimo numero di anni di storico da analizzare (default: 5)
        """
        self.input_file = input_file
        self.input_folder_prices = input_folder_prices
        self.output_folder = output_folder
        self.min_distance_factor = min_distance_factor
        self.touch_tolerance_factor = touch_tolerance_factor
        self.max_years_lookback = max_years_lookback
        
        # Carica stato tickers
        self.tickers = self._load_tickers()
        
        # Assicurati che la cartella di output esista
        self.output_folder.mkdir(parents=True, exist_ok=True)
    
    def _load_tickers(self) -> Dict[str, str]:
        """Carica l'elenco dei ticker dal file JSON di stato."""
        if not self.input_file.exists():
            print(f"📝 File di stato non trovato, lo creo: {self.input_file}")
            
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
            
            print(f"✅ File di stato creato con {len(tickers)} ticker")
            return initial_state
        
        with open(self.input_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _load_price_data(self, ticker: str) -> pd.DataFrame:
        """Carica i dati storici di prezzo per un ticker."""
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
        """
        Filtra i dati per limitarli agli ultimi N anni specificati.
        
        Returns:
            pd.DataFrame: DataFrame filtrato per il periodo richiesto
        """
        if df.empty:
            return df
        
        # Calcola la data di cutoff (N anni fa dalla data più recente)
        latest_date = df['Date'].max()
        cutoff_date = latest_date - timedelta(days=365 * self.max_years_lookback)
        
        # Filtra i dati
        filtered_df = df[df['Date'] >= cutoff_date].copy()
        filtered_df.reset_index(drop=True, inplace=True)
        
        print(f"    📅 {ticker}: filtrati dati da {cutoff_date.strftime('%Y-%m-%d')} "
              f"a {latest_date.strftime('%Y-%m-%d')} ({len(filtered_df)} righe)")
        
        return filtered_df
    
    def _needs_recalculation(self, ticker: str, df: pd.DataFrame) -> bool:
        """
        Determina se è necessario ricalcolare i livelli S/R per un ticker.
        
        Parameters:
            ticker: simbolo del ticker
            df: DataFrame con i dati di prezzo
            
        Returns:
            bool: True se serve ricalcolare, False altrimenti
        """
        # Ottieni l'ultima data dal JSON di stato
        last_processed_str = self.tickers.get(ticker)
        if not last_processed_str:
            print(f"    ⚠️ {ticker}: nessuna data di ultimo aggiornamento trovata, ricalcolo necessario")
            return True
        
        try:
            # Converti la stringa in datetime
            last_processed = datetime.fromisoformat(last_processed_str.replace('Z', '+00:00'))
            if last_processed.tzinfo:
                last_processed = last_processed.replace(tzinfo=None)
        except ValueError:
            print(f"    ⚠️ {ticker}: formato data non valido ({last_processed_str}), ricalcolo necessario")
            return True
        
        # Ottieni l'ultima data disponibile nei dati
        latest_data_date = df['Date'].max()
        if pd.isna(latest_data_date):
            print(f"    ⚠️ {ticker}: nessuna data valida nei dati")
            return False
        
        # Converti in datetime se necessario
        if hasattr(latest_data_date, 'to_pydatetime'):
            latest_data_date = latest_data_date.to_pydatetime()
        
        # Confronta le date (considera solo la parte date, non time)
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
        """
        Aggiorna il timestamp per un ticker nel file JSON di stato.
        
        Parameters:
            ticker: simbolo del ticker
            latest_date: ultima data processata
        """
        try:
            # Ricarica il file JSON corrente
            with open(self.input_file, 'r', encoding='utf-8') as f:
                current_state = json.load(f)
            
            # Aggiorna il timestamp
            current_state[ticker] = latest_date.isoformat()
            
            # Salva il file aggiornato
            with open(self.input_file, 'w', encoding='utf-8') as f:
                json.dump(current_state, f, indent=2, ensure_ascii=False)
            
            print(f"    📝 {ticker}: timestamp aggiornato a {latest_date.strftime('%Y-%m-%d')}")
            
        except Exception as e:
            print(f"    ⚠️ Errore nell'aggiornamento timestamp per {ticker}: {str(e)}")
    
    def _is_support_pattern(self, df: pd.DataFrame, i: int) -> bool:
        """
        Identifica un pattern di supporto (V-shape nei minimi).
        Condizioni: Low[i] è minimo locale circondato da minimi più alti.
        """
        try:
            cond1 = df.iloc[i]['Low'] < df.iloc[i-1]['Low']
            cond2 = df.iloc[i]['Low'] < df.iloc[i+1]['Low']
            cond3 = df.iloc[i+1]['Low'] < df.iloc[i+2]['Low']
            cond4 = df.iloc[i-1]['Low'] < df.iloc[i-2]['Low']
            return cond1 and cond2 and cond3 and cond4
        except (IndexError, KeyError):
            return False
    
    def _is_resistance_pattern(self, df: pd.DataFrame, i: int) -> bool:
        """
        Identifica un pattern di resistenza (Λ-shape nei massimi).
        Condizioni: High[i] è massimo locale circondato da massimi più bassi.
        """
        try:
            cond1 = df.iloc[i]['High'] > df.iloc[i-1]['High']
            cond2 = df.iloc[i]['High'] > df.iloc[i+1]['High']
            cond3 = df.iloc[i+1]['High'] > df.iloc[i+2]['High']
            cond4 = df.iloc[i-1]['High'] > df.iloc[i-2]['High']
            return cond1 and cond2 and cond3 and cond4
        except (IndexError, KeyError):
            return False
    
    def _is_level_far_enough(self, value: float, existing_levels: List[float], min_distance: float) -> bool:
        """Verifica se un livello è sufficientemente distante dagli altri già trovati."""
        return all(abs(value - level) >= min_distance for level in existing_levels)
    
    def _count_level_touches(self, df: pd.DataFrame, level: float, tolerance: float, 
                           level_type: str, exclude_idx: int = -1) -> int:
        """
        Conta quante volte il prezzo ha 'toccato' un livello specifico.
        
        Parameters:
            df: DataFrame dei prezzi
            level: livello di prezzo da verificare
            tolerance: tolleranza per considerare un 'tocco'
            level_type: 'Support' o 'Resistance'
            exclude_idx: indice da escludere dal conteggio
        """
        touches = 0
        
        for i in range(len(df)):
            if i == exclude_idx:
                continue
            
            if level_type == 'Support':
                # Per supporti, verifica se il minimo ha toccato il livello
                if abs(df.iloc[i]['Low'] - level) <= tolerance:
                    touches += 1
            else:  # Resistance
                # Per resistenze, verifica se il massimo ha toccato il livello
                if abs(df.iloc[i]['High'] - level) <= tolerance:
                    touches += 1
        
        return touches
    
    def _calculate_level_strength(self, df: pd.DataFrame, level: float, level_type: str, 
                                level_idx: int) -> float:
        """
        Calcola la 'forza' di un livello basata su:
        - Numero di tocchi del livello
        - Volume medio nei punti di contatto (se disponibile)
        - Distanza temporale dalla formazione del livello
        
        Returns:
            float: punteggio di forza del livello
        """
        avg_range = np.mean(df['High'] - df['Low'])
        tolerance = avg_range * self.touch_tolerance_factor
        
        # Conta i tocchi
        touches = self._count_level_touches(df, level, tolerance, level_type, level_idx)
        
        # Calcola volume medio se disponibile
        volume_factor = 1.0
        if 'Volume' in df.columns:
            level_volume = df.iloc[level_idx].get('Volume', 0)
            avg_volume = df['Volume'].mean()
            volume_factor = level_volume / avg_volume if avg_volume > 0 else 1.0
        
        # Calcola fattore temporale (livelli più recenti hanno peso maggiore)
        days_from_formation = len(df) - level_idx
        recency_factor = max(0.1, 1.0 - (days_from_formation / len(df)) * 0.5)
        
        # Formula di forza: peso maggiore ai tocchi, poi volume e recency
        strength = (touches * 3.0) + (volume_factor * 1.0) + (recency_factor * 0.5)
        
        return round(strength, 2)
    
    def _find_support_resistance_levels(self, df: pd.DataFrame, ticker: str) -> List[Dict]:
        """
        Trova tutti i livelli di supporto e resistenza in un DataFrame.
        
        Returns:
            List[Dict]: lista di dizionari con informazioni sui livelli trovati
        """
        print(f"    🔍 Analisi S/R per {ticker} su {len(df)} righe di dati")
        levels_data = []
        levels_values = []
        
        # Calcola parametri dinamici
        avg_range = np.mean(df['High'] - df['Low'])
        min_distance = avg_range * self.min_distance_factor
        
        # Scansiona il DataFrame (esclude primi e ultimi 2 punti per sicurezza)
        for i in range(2, len(df) - 2):
            current_date = df.iloc[i]['Date']
            
            # Controlla pattern di supporto
            if self._is_support_pattern(df, i):
                support_level = df.iloc[i]['Low']
                
                if self._is_level_far_enough(support_level, levels_values, min_distance):
                    levels_values.append(support_level)
                    
                    strength = self._calculate_level_strength(df, support_level, 'Support', i)
                    touches = self._count_level_touches(df, support_level, 
                                                      avg_range * self.touch_tolerance_factor, 
                                                      'Support', i)
                    
                    levels_data.append({
                        'ticker': ticker,
                        'date': current_date,
                        'level': round(support_level, 4),
                        'type': 'Support',
                        'strength': strength,
                        'touches': touches,
                        'avg_range': round(avg_range, 4),
                        'days_from_end': len(df) - i - 1
                    })
            
            # Controlla pattern di resistenza
            elif self._is_resistance_pattern(df, i):
                resistance_level = df.iloc[i]['High']
                
                if self._is_level_far_enough(resistance_level, levels_values, min_distance):
                    levels_values.append(resistance_level)
                    
                    strength = self._calculate_level_strength(df, resistance_level, 'Resistance', i)
                    touches = self._count_level_touches(df, resistance_level, 
                                                      avg_range * self.touch_tolerance_factor, 
                                                      'Resistance', i)
                    
                    levels_data.append({
                        'ticker': ticker,
                        'date': current_date,
                        'level': round(resistance_level, 4),
                        'type': 'Resistance',
                        'strength': strength,
                        'touches': touches,
                        'avg_range': round(avg_range, 4),
                        'days_from_end': len(df) - i - 1
                    })
        
        # Ordina per forza decrescente
        levels_data.sort(key=lambda x: x['strength'], reverse=True)
        print(f"    📊 Trovati {len(levels_data)} livelli S/R per {ticker}")
        return levels_data
    
    def process_ticker(self, ticker: str) -> bool:
        """
        Elabora un singolo ticker per trovare supporti e resistenze.
        
        Returns:
            bool: True se elaborazione riuscita, False altrimenti
        """
        try:
            print(f"  🎯 Elaborazione {ticker}...")
            
            # Carica dati prezzi
            df = self._load_price_data(ticker)
            
            # Filtra per periodo massimo
            df_filtered = self._filter_data_by_timeframe(df, ticker)
            
            if df_filtered.empty:
                print(f"    ⚠️ {ticker}: nessun dato nel periodo richiesto")
                return False
            
            # Controlla se serve ricalcolare
            if not self._needs_recalculation(ticker, df_filtered):
                return True  # Considera come successo se non serve ricalcolare
            
            # Trova livelli S/R
            levels_data = self._find_support_resistance_levels(df_filtered, ticker)
            
            if levels_data:
                # Crea DataFrame e salva
                df_levels = pd.DataFrame(levels_data)
                output_file = self.output_folder / f"{ticker}_SR.csv"
                df_levels.to_csv(output_file, index=False, date_format='%Y-%m-%d')
                
                # Aggiorna timestamp nel file JSON
                latest_date = df_filtered['Date'].max()
                if hasattr(latest_date, 'to_pydatetime'):
                    latest_date = latest_date.to_pydatetime()
                self._update_ticker_timestamp(ticker, latest_date)
                
                print(f"    ✅ {ticker}: {len(levels_data)} livelli S/R salvati")
                return True
            else:
                print(f"    ⚠️ {ticker}: nessun livello S/R trovato")
                return False
                
        except Exception as e:
            print(f"    ❌ Errore per {ticker}: {str(e)}")
            return False
    
    def run(self) -> Dict[str, bool]:
        """
        Esegue il calcolo di supporti e resistenze per tutti i ticker.
        
        Returns:
            Dict[str, bool]: risultati elaborazione per ticker
        """
        print("▶️ START CALCOLO SUPPORTI E RESISTENZE.....")
        print(f"📅 Analisi limitata agli ultimi {self.max_years_lookback} anni")
        
        results = {}
        
        for ticker in self.tickers.keys():
            results[ticker] = self.process_ticker(ticker)
        
        successful = sum(results.values())
        total = len(results)
        
        print(f"✅ END CALCOLO SUPPORTI E RESISTENZE: {successful}/{total} ticker elaborati con successo")
        
        return results
    
    def get_levels_summary(self, ticker: str) -> Optional[pd.DataFrame]:
        """
        Carica e restituisce un riassunto dei livelli S/R per un ticker.
        
        Returns:
            pd.DataFrame: DataFrame con i livelli, None se file non esiste
        """
        file_path = self.output_folder / f"{ticker}_SR.csv"
        
        if not file_path.exists():
            return None
        
        return pd.read_csv(file_path, parse_dates=['date'])
    
    def get_current_levels(self, ticker: str, max_days_old: int = 30, min_strength: float = 2.0) -> Optional[pd.DataFrame]:
        """
        Restituisce solo i livelli S/R più recenti e significativi per un ticker.
        
        Parameters:
            ticker: simbolo del ticker
            max_days_old: massimo numero di giorni dalla formazione del livello
            min_strength: forza minima richiesta per il livello
            
        Returns:
            pd.DataFrame: livelli filtrati, None se nessun livello trovato
        """
        df = self.get_levels_summary(ticker)
        
        if df is None or df.empty:
            return None
        
        # Filtra per età e forza
        filtered = df[
            (df['days_from_end'] <= max_days_old) & 
            (df['strength'] >= min_strength)
        ]
        
        return filtered.sort_values('strength', ascending=False) if not filtered.empty else None