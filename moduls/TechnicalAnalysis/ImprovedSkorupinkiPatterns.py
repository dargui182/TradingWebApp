import pandas as pd
import numpy as np
from typing import List, Dict, Optional, Tuple

class ImprovedSkorupinkiPatterns:
    """
    Versione migliorata per identificare correttamente i pattern Supply/Demand
    secondo la metodologia Skorupinski autentica.
    """
    
    def __init__(self, min_impulse_pct: float = 1.5, max_base_bars: int = 10):
        """
        Parameters:
            min_impulse_pct: movimento minimo % per considerare una candela come impulso forte
            max_base_bars: massimo numero di candele che possono formare una base
        """
        self.min_impulse_pct = min_impulse_pct
        self.max_base_bars = max_base_bars
    
    def _is_strong_impulse_candle(self, candle: pd.Series, prev_candle: pd.Series, direction: str) -> bool:
        """
        Identifica se una candela rappresenta un impulso forte (leg-in o leg-out).
        
        Args:
            candle: candela da analizzare
            prev_candle: candela precedente per contesto
            direction: 'bullish' per Rise, 'bearish' per Drop
        
        Returns:
            bool: True se è un impulso forte
        """
        if prev_candle is None:
            return False
        
        # Calcola il movimento percentuale del corpo della candela
        body_move_pct = abs(candle['Close'] - candle['Open']) / candle['Open'] * 100
        
        # Calcola il range della candela
        candle_range = candle['High'] - candle['Low']
        prev_range = prev_candle['High'] - prev_candle['Low']
        
        # Criteri per impulso forte:
        # 1. Movimento del corpo superiore alla soglia minima
        has_strong_body = body_move_pct >= self.min_impulse_pct
        
        # 2. Corpo rappresenta almeno il 60% del range totale
        body_ratio = abs(candle['Close'] - candle['Open']) / candle_range if candle_range > 0 else 0
        has_dominant_body = body_ratio >= 0.6
        
        # 3. Range superiore alla media con la candela precedente
        avg_range = (candle_range + prev_range) / 2
        has_significant_range = candle_range >= avg_range * 0.8
        
        # 4. Direzione corretta
        if direction == 'bullish':
            correct_direction = candle['Close'] > candle['Open']
        else:  # bearish
            correct_direction = candle['Close'] < candle['Open']
        
        # Deve soddisfare almeno 3 criteri su 4
        criteria_met = sum([
            has_strong_body,
            has_dominant_body, 
            has_significant_range,
            correct_direction
        ])
        
        return criteria_met >= 3
    
    def _identify_base_zone(self, df: pd.DataFrame, start_idx: int, max_bars: int = None) -> Optional[Dict]:
        """
        Identifica una zona di base (consolidamento/lateralizzazione).
        
        Args:
            df: DataFrame con i dati OHLC
            start_idx: indice di inizio ricerca
            max_bars: massimo numero di barre da considerare
            
        Returns:
            Dict con info sulla base o None se non trovata
        """
        if max_bars is None:
            max_bars = self.max_base_bars
            
        end_limit = min(start_idx + max_bars, len(df))
        
        # Raccogli candele consecutive che formano la base
        base_candles = []
        base_highs = []
        base_lows = []
        
        for i in range(start_idx, end_limit):
            if i >= len(df):
                break
                
            candle = df.iloc[i]
            prev_candle = df.iloc[i-1] if i > 0 else None
            
            # Una candela è parte della base se:
            # 1. Ha range limitato rispetto alla media
            # 2. Non è un impulso forte in nessuna direzione
            candle_range = candle['High'] - candle['Low']
            
            if prev_candle is not None:
                prev_range = prev_candle['High'] - prev_candle['Low']
                avg_range = (candle_range + prev_range) / 2
                
                # Criteri per candela di base:
                is_small_range = candle_range <= avg_range * 1.2
                is_not_strong_bull = not self._is_strong_impulse_candle(candle, prev_candle, 'bullish')
                is_not_strong_bear = not self._is_strong_impulse_candle(candle, prev_candle, 'bearish')
                
                if is_small_range and is_not_strong_bull and is_not_strong_bear:
                    base_candles.append(i)
                    base_highs.append(candle['High'])
                    base_lows.append(candle['Low'])
                else:
                    # Se troviamo una candela che non è base, fermiamo la ricerca
                    break
            else:
                # Prima candela, assumiamo sia base
                base_candles.append(i)
                base_highs.append(candle['High'])
                base_lows.append(candle['Low'])
        
        # Valida la base: deve avere almeno 1 candela e range contenuto
        if len(base_candles) >= 1:
            base_high = max(base_highs)
            base_low = min(base_lows)
            base_range = base_high - base_low
            
            # La base è valida se il range totale non è eccessivo
            avg_individual_range = np.mean([h - l for h, l in zip(base_highs, base_lows)])
            is_tight_range = base_range <= avg_individual_range * (len(base_candles) * 0.8)
            
            if is_tight_range:
                return {
                    'start_idx': start_idx,
                    'end_idx': base_candles[-1],
                    'candle_count': len(base_candles),
                    'high': base_high,
                    'low': base_low,
                    'range': base_range,
                    'center': (base_high + base_low) / 2
                }
        
        return None
    
    def _find_rbd_pattern(self, df: pd.DataFrame, current_idx: int) -> Optional[Dict]:
        """
        Trova pattern RBD: Rise (leg-in) → Base → Drop (leg-out)
        Identifica zone di SUPPLY.
        """
        # Cerchiamo indietro dal current_idx
        for lookback in range(3, min(15, current_idx)):
            leg_out_idx = current_idx
            base_end_idx = current_idx - 1
            
            # 1. Verifica LEG-OUT (Drop forte)
            leg_out_candle = df.iloc[leg_out_idx]
            leg_out_prev = df.iloc[leg_out_idx - 1]
            
            if not self._is_strong_impulse_candle(leg_out_candle, leg_out_prev, 'bearish'):
                continue
            
            # 2. Cerca BASE prima del leg-out
            # La base deve finire prima del leg-out
            max_base_start = max(0, base_end_idx - self.max_base_bars)
            
            base_found = None
            for base_start in range(max_base_start, base_end_idx):
                base_info = self._identify_base_zone(df, base_start, base_end_idx - base_start + 1)
                if base_info and base_info['end_idx'] == base_end_idx:
                    base_found = base_info
                    break
            
            if not base_found:
                continue
            
            # 3. Verifica LEG-IN (Rise forte) prima della base
            leg_in_idx = base_found['start_idx'] - 1
            if leg_in_idx < 1:
                continue
                
            leg_in_candle = df.iloc[leg_in_idx]
            leg_in_prev = df.iloc[leg_in_idx - 1]
            
            if self._is_strong_impulse_candle(leg_in_candle, leg_in_prev, 'bullish'):
                # PATTERN RBD TROVATO!
                zone_low = min(base_found['low'], leg_in_candle['Low'])
                zone_high = max(base_found['high'], leg_in_candle['High'])
                
                return {
                    'pattern': 'RBD',
                    'type': 'Supply',
                    'leg_in_idx': leg_in_idx,
                    'base_start_idx': base_found['start_idx'],
                    'base_end_idx': base_found['end_idx'],
                    'leg_out_idx': leg_out_idx,
                    'zone_low': zone_low,
                    'zone_high': zone_high,
                    'zone_center': (zone_low + zone_high) / 2,
                    'base_candle_count': base_found['candle_count'],
                    'formation_date': df.iloc[base_found['start_idx']]['Date']
                }
        
        return None
    
    def _find_dbd_pattern(self, df: pd.DataFrame, current_idx: int) -> Optional[Dict]:
        """
        Trova pattern DBD: Drop (leg-in) → Base → Drop (leg-out)  
        Identifica zone di SUPPLY.
        """
        for lookback in range(3, min(15, current_idx)):
            leg_out_idx = current_idx
            base_end_idx = current_idx - 1
            
            # 1. Verifica LEG-OUT (Drop forte)
            leg_out_candle = df.iloc[leg_out_idx]
            leg_out_prev = df.iloc[leg_out_idx - 1]
            
            if not self._is_strong_impulse_candle(leg_out_candle, leg_out_prev, 'bearish'):
                continue
            
            # 2. Cerca BASE
            max_base_start = max(0, base_end_idx - self.max_base_bars)
            
            base_found = None
            for base_start in range(max_base_start, base_end_idx):
                base_info = self._identify_base_zone(df, base_start, base_end_idx - base_start + 1)
                if base_info and base_info['end_idx'] == base_end_idx:
                    base_found = base_info
                    break
            
            if not base_found:
                continue
            
            # 3. Verifica LEG-IN (Drop forte) prima della base
            leg_in_idx = base_found['start_idx'] - 1
            if leg_in_idx < 1:
                continue
                
            leg_in_candle = df.iloc[leg_in_idx]
            leg_in_prev = df.iloc[leg_in_idx - 1]
            
            if self._is_strong_impulse_candle(leg_in_candle, leg_in_prev, 'bearish'):
                # PATTERN DBD TROVATO!
                zone_low = min(base_found['low'], leg_in_candle['Low'])
                zone_high = max(base_found['high'], leg_in_candle['High'])
                
                return {
                    'pattern': 'DBD',
                    'type': 'Supply',
                    'leg_in_idx': leg_in_idx,
                    'base_start_idx': base_found['start_idx'],
                    'base_end_idx': base_found['end_idx'],
                    'leg_out_idx': leg_out_idx,
                    'zone_low': zone_low,
                    'zone_high': zone_high,
                    'zone_center': (zone_low + zone_high) / 2,
                    'base_candle_count': base_found['candle_count'],
                    'formation_date': df.iloc[base_found['start_idx']]['Date']
                }
        
        return None
    
    def _find_dbr_pattern(self, df: pd.DataFrame, current_idx: int) -> Optional[Dict]:
        """
        Trova pattern DBR: Drop (leg-in) → Base → Rise (leg-out)
        Identifica zone di DEMAND.
        """
        for lookback in range(3, min(15, current_idx)):
            leg_out_idx = current_idx
            base_end_idx = current_idx - 1
            
            # 1. Verifica LEG-OUT (Rise forte)
            leg_out_candle = df.iloc[leg_out_idx]
            leg_out_prev = df.iloc[leg_out_idx - 1]
            
            if not self._is_strong_impulse_candle(leg_out_candle, leg_out_prev, 'bullish'):
                continue
            
            # 2. Cerca BASE
            max_base_start = max(0, base_end_idx - self.max_base_bars)
            
            base_found = None
            for base_start in range(max_base_start, base_end_idx):
                base_info = self._identify_base_zone(df, base_start, base_end_idx - base_start + 1)
                if base_info and base_info['end_idx'] == base_end_idx:
                    base_found = base_info
                    break
            
            if not base_found:
                continue
            
            # 3. Verifica LEG-IN (Drop forte) prima della base
            leg_in_idx = base_found['start_idx'] - 1
            if leg_in_idx < 1:
                continue
                
            leg_in_candle = df.iloc[leg_in_idx]
            leg_in_prev = df.iloc[leg_in_idx - 1]
            
            if self._is_strong_impulse_candle(leg_in_candle, leg_in_prev, 'bearish'):
                # PATTERN DBR TROVATO!
                zone_low = min(base_found['low'], leg_in_candle['Low'])
                zone_high = max(base_found['high'], leg_in_candle['High'])
                
                return {
                    'pattern': 'DBR',
                    'type': 'Demand',
                    'leg_in_idx': leg_in_idx,
                    'base_start_idx': base_found['start_idx'],
                    'base_end_idx': base_found['end_idx'],
                    'leg_out_idx': leg_out_idx,
                    'zone_low': zone_low,
                    'zone_high': zone_high,
                    'zone_center': (zone_low + zone_high) / 2,
                    'base_candle_count': base_found['candle_count'],
                    'formation_date': df.iloc[base_found['start_idx']]['Date']
                }
        
        return None
    
    def _find_rbr_pattern(self, df: pd.DataFrame, current_idx: int) -> Optional[Dict]:
        """
        Trova pattern RBR: Rise (leg-in) → Base → Rise (leg-out)
        Identifica zone di DEMAND.
        """
        for lookback in range(3, min(15, current_idx)):
            leg_out_idx = current_idx
            base_end_idx = current_idx - 1
            
            # 1. Verifica LEG-OUT (Rise forte)
            leg_out_candle = df.iloc[leg_out_idx]
            leg_out_prev = df.iloc[leg_out_idx - 1]
            
            if not self._is_strong_impulse_candle(leg_out_candle, leg_out_prev, 'bullish'):
                continue
            
            # 2. Cerca BASE
            max_base_start = max(0, base_end_idx - self.max_base_bars)
            
            base_found = None
            for base_start in range(max_base_start, base_end_idx):
                base_info = self._identify_base_zone(df, base_start, base_end_idx - base_start + 1)
                if base_info and base_info['end_idx'] == base_end_idx:
                    base_found = base_info
                    break
            
            if not base_found:
                continue
            
            # 3. Verifica LEG-IN (Rise forte) prima della base
            leg_in_idx = base_found['start_idx'] - 1
            if leg_in_idx < 1:
                continue
                
            leg_in_candle = df.iloc[leg_in_idx]
            leg_in_prev = df.iloc[leg_in_idx - 1]
            
            if self._is_strong_impulse_candle(leg_in_candle, leg_in_prev, 'bullish'):
                # PATTERN RBR TROVATO!
                zone_low = min(base_found['low'], leg_in_candle['Low'])
                zone_high = max(base_found['high'], leg_in_candle['High'])
                
                return {
                    'pattern': 'RBR',
                    'type': 'Demand',
                    'leg_in_idx': leg_in_idx,
                    'base_start_idx': base_found['start_idx'],
                    'base_end_idx': base_found['end_idx'],
                    'leg_out_idx': leg_out_idx,
                    'zone_low': zone_low,
                    'zone_high': zone_high,
                    'zone_center': (zone_low + zone_high) / 2,
                    'base_candle_count': base_found['candle_count'],
                    'formation_date': df.iloc[base_found['start_idx']]['Date']
                }
        
        return None
    
    def find_all_patterns(self, df: pd.DataFrame, max_lookback: int = 100) -> List[Dict]:
        """
        Trova tutti i pattern Supply/Demand in un DataFrame.
        
        Args:
            df: DataFrame con colonne Date, Open, High, Low, Close
            max_lookback: numero massimo di barre da analizzare
            
        Returns:
            List[Dict]: lista di pattern trovati
        """
        patterns = []
        
        if len(df) < 5:
            return patterns
        
        # Analizza le ultime max_lookback barre
        start_idx = max(5, len(df) - max_lookback)
        
        for i in range(start_idx, len(df)):
            # Cerca tutti i tipi di pattern
            pattern_methods = [
                self._find_rbd_pattern,
                self._find_dbd_pattern,
                self._find_dbr_pattern,
                self._find_rbr_pattern
            ]
            
            for method in pattern_methods:
                pattern = method(df, i)
                if pattern:
                    patterns.append(pattern)
        
        return patterns
    
    def print_pattern_analysis(self, df: pd.DataFrame, pattern: Dict):
        """
        Stampa un'analisi dettagliata di un pattern trovato.
        """
        print(f"\n🎯 PATTERN {pattern['pattern']} ({pattern['type']}) TROVATO:")
        print(f"📅 Data formazione: {pattern['formation_date']}")
        print(f"🏗️  Struttura:")
        
        # Leg-in
        leg_in = df.iloc[pattern['leg_in_idx']]
        print(f"   LEG-IN ({pattern['leg_in_idx']}): {leg_in['Date']} | "
              f"O:{leg_in['Open']:.4f} H:{leg_in['High']:.4f} L:{leg_in['Low']:.4f} C:{leg_in['Close']:.4f}")
        
        # Base
        print(f"   BASE ({pattern['base_start_idx']}-{pattern['base_end_idx']}): "
              f"{pattern['base_candle_count']} candele")
        for idx in range(pattern['base_start_idx'], pattern['base_end_idx'] + 1):
            base_candle = df.iloc[idx]
            print(f"     {idx}: {base_candle['Date']} | "
                  f"O:{base_candle['Open']:.4f} H:{base_candle['High']:.4f} L:{base_candle['Low']:.4f} C:{base_candle['Close']:.4f}")
        
        # Leg-out
        leg_out = df.iloc[pattern['leg_out_idx']]
        print(f"   LEG-OUT ({pattern['leg_out_idx']}): {leg_out['Date']} | "
              f"O:{leg_out['Open']:.4f} H:{leg_out['High']:.4f} L:{leg_out['Low']:.4f} C:{leg_out['Close']:.4f}")
        
        print(f"🎯 ZONA {pattern['type'].upper()}: {pattern['zone_low']:.4f} - {pattern['zone_high']:.4f}")
        print(f"📍 Centro zona: {pattern['zone_center']:.4f}")


# Integrazione completa nel SkorupinkiZoneManager
class IntegrationExample:
    """
    Esempio di come integrare tutti e 4 i pattern migliorati nel tuo codice esistente.
    """
    
    def __init__(self):
        # Inizializza l'analyzer migliorato
        self.improved_analyzer = ImprovedSkorupinkiPatterns(
            min_impulse_pct=1.2,  # Minimo 1.2% per impulsi forti
            max_base_bars=10      # Massimo 10 candele per la base
        )
    
    def _find_all_patterns_improved(self, df: pd.DataFrame, index: int) -> List[Dict]:
        """
        Sostituisce tutti i metodi pattern del tuo codice originale.
        Trova tutti i 4 pattern: RBD, DBD, DBR, RBR
        """
        patterns_found = []
        
        # Cerca tutti i pattern usando i metodi migliorati
        pattern_methods = [
            ('RBD', self.improved_analyzer._find_rbd_pattern),  # Supply
            ('DBD', self.improved_analyzer._find_dbd_pattern),  # Supply  
            ('DBR', self.improved_analyzer._find_dbr_pattern),  # Demand
            ('RBR', self.improved_analyzer._find_rbr_pattern)   # Demand
        ]
        
        for pattern_name, method in pattern_methods:
            try:
                pattern = method(df, index)
                if pattern:
                    # Converti nel formato compatibile con il tuo codice esistente
                    compatible_pattern = {
                        'pattern': pattern['pattern'],
                        'type': pattern['type'],
                        'zone_bottom': pattern['zone_low'],
                        'zone_top': pattern['zone_high'],
                        'zone_center': pattern['zone_center'],
                        'date': pattern['formation_date'],
                        'index': pattern['base_start_idx'],  # Usa l'inizio della base come indice
                        'formation_candles': [],  # Potresti popolare questo se necessario
                        'leg_in_idx': pattern['leg_in_idx'],
                        'leg_out_idx': pattern['leg_out_idx'],
                        'base_candle_count': pattern['base_candle_count']
                    }
                    patterns_found.append(compatible_pattern)
                    
            except Exception as e:
                print(f"    ⚠️ Errore nella ricerca pattern {pattern_name}: {str(e)}")
        
        return patterns_found
    
    def integrate_into_skorupinski_manager(self, skorupinski_manager):
        """
        Mostra come sostituire i metodi nel tuo SkorupinkiZoneManager esistente.
        """
        # Sostituisci il metodo principale di ricerca pattern
        def new_find_skorupinski_zones(df, ticker):
            print(f"    🎯 Analisi zone Skorupinski MIGLIORATA v2.0 per {ticker}")
            zones = []
            
            if len(df) < 6:
                print(f"    ⚠️ {ticker}: dati insufficienti per l'analisi")
                return zones
            
            current_price = df.iloc[-1]['Close']
            current_idx = len(df) - 1
            start_idx = max(0, current_idx - skorupinski_manager.max_lookback_bars)
            
            print(f"    💰 Prezzo attuale: {current_price:.4f}")
            print(f"    📊 Analisi da indice {start_idx} a {current_idx}")
            
            # Usa il nuovo metodo per trovare tutti i pattern
            for i in range(start_idx + 6, len(df)):
                patterns_at_index = self._find_all_patterns_improved(df, i)
                
                for zone in patterns_at_index:
                    if zone is None:
                        continue
                    
                    print(f"    🔍 PATTERN {zone['pattern']} ({zone['type']}) trovato @ index {zone['index']}")
                    
                    # Applica gli stessi filtri del codice originale
                    if not skorupinski_manager._is_zone_valid(df, zone, zone['index'], current_price):
                        print(f"    ❌ Zona {zone['pattern']} invalidata (zona non valida)")
                        continue
                    
                    pullback_info = skorupinski_manager._has_pullback(df, zone, zone['index'])
                    if not pullback_info['has_pullback']:
                        print(f"    ❌ Zona {zone['pattern']} invalidata (pullback insufficiente)")
                        continue
                    
                    test_count = skorupinski_manager._count_zone_tests(df, zone, zone['index'])
                    if test_count < skorupinski_manager.min_zone_strength:
                        print(f"    ❌ Zona {zone['pattern']} invalidata (forza insufficiente)")
                        continue
                    
                    # Calcola metriche finali
                    days_ago = current_idx - zone['index']
                    distance_from_current = (
                        ((current_price - zone['zone_center']) / current_price * 100) 
                        if zone['type'] == 'Demand' 
                        else ((zone['zone_center'] - current_price) / current_price * 100)
                    )
                    
                    # Crea zona finale con info aggiuntive
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
                        'strength_score': skorupinski_manager._calculate_zone_strength(zone, pullback_info, test_count, days_ago),
                        'virgin_zone': test_count == 1,
                        'zone_thickness': round(zone['zone_top'] - zone['zone_bottom'], 4),
                        'zone_thickness_pct': round((zone['zone_top'] - zone['zone_bottom']) / zone['zone_center'] * 100, 2),
                        # Info aggiuntive specifiche dei pattern migliorati
                        'leg_in_idx': zone.get('leg_in_idx'),
                        'leg_out_idx': zone.get('leg_out_idx'),
                        'base_candle_count': zone.get('base_candle_count', 1),
                        'formation_type': 'improved_skorupinski'
                    }
                    
                    print(f"    ✅ {zone['pattern']} ({zone['type']}): "
                          f"{zone['date'].strftime('%Y-%m-%d') if hasattr(zone['date'], 'strftime') else zone['date']} | "
                          f"{zone['zone_bottom']:.4f}-{zone['zone_top']:.4f} | "
                          f"Base: {zone.get('base_candle_count', 1)} candele | "
                          f"Score: {final_zone['strength_score']:.2f}")
                    
                    zones.append(final_zone)
            
            return zones
        
        # Sostituisci il metodo nel manager esistente
        skorupinski_manager._find_skorupinski_zones = new_find_skorupinski_zones
        return skorupinski_manager


# Test con tutti e 4 i pattern
def test_all_patterns():
    """
    Test completo con esempi di tutti e 4 i pattern.
    """
    import datetime
    
    print("🧪 TEST COMPLETO - Tutti e 4 i pattern Skorupinski")
    
    # Test RBD (Supply): Rise → Base → Drop
    print("\n" + "="*60)
    print("🔴 TEST PATTERN RBD (SUPPLY)")
    dates_rbd = [datetime.date(2024, 1, i) for i in range(1, 16)]
    data_rbd = {
        'Date': dates_rbd,
        'Open': [100, 100.5, 101, 103, 106, 108.5, 108.2, 108.4, 108.1, 108.3, 108.0, 108.2, 107, 105, 102],
        'High': [100.5, 101, 102, 104, 107, 109, 108.8, 109, 108.7, 108.9, 108.6, 108.8, 107.5, 105.5, 102.5],
        'Low':  [99.5, 100, 100.5, 102.5, 105.5, 108, 107.8, 108, 107.7, 107.9, 107.6, 107.8, 106, 104, 101],
        'Close':[100.2, 100.8, 101.5, 103.5, 106.5, 108.8, 108.1, 108.5, 108.0, 108.4, 107.9, 108.1, 106.5, 104.5, 101.5]
    }
    
    df_rbd = pd.DataFrame(data_rbd)
    df_rbd['Date'] = pd.to_datetime(df_rbd['Date'])
    
    analyzer = ImprovedSkorupinkiPatterns(min_impulse_pct=1.0, max_base_bars=8)
    patterns_rbd = analyzer.find_all_patterns(df_rbd)
    
    for pattern in patterns_rbd:
        analyzer.print_pattern_analysis(df_rbd, pattern)
    
    # Test DBR (Demand): Drop → Base → Rise  
    print("\n" + "="*60)
    print("🟢 TEST PATTERN DBR (DEMAND)")
    dates_dbr = [datetime.date(2024, 2, i) for i in range(1, 16)]
    data_dbr = {
        'Date': dates_dbr,
        'Open': [110, 109.5, 108, 105, 102, 101.5, 101.8, 101.6, 101.9, 101.7, 102.0, 101.8, 103, 105, 108],
        'High': [110.5, 109.8, 108.5, 105.5, 102.5, 102, 102.2, 102, 102.3, 102.1, 102.4, 102.2, 103.5, 105.5, 108.5],
        'Low':  [109, 108.5, 107, 104, 101, 101, 101.3, 101.1, 101.4, 101.2, 101.5, 101.3, 102, 104, 107],
        'Close':[109.2, 108.2, 107.5, 104.5, 101.5, 101.2, 101.9, 101.3, 102.0, 101.4, 102.1, 101.5, 102.5, 104.5, 107.5]
    }
    
    df_dbr = pd.DataFrame(data_dbr)
    df_dbr['Date'] = pd.to_datetime(df_dbr['Date'])
    
    patterns_dbr = analyzer.find_all_patterns(df_dbr)
    
    for pattern in patterns_dbr:
        analyzer.print_pattern_analysis(df_dbr, pattern)
    
    print(f"\n📊 RIASSUNTO TEST:")
    print(f"   RBD (Supply) patterns: {len([p for p in patterns_rbd if p['pattern'] == 'RBD'])}")
    print(f"   DBR (Demand) patterns: {len([p for p in patterns_dbr if p['pattern'] == 'DBR'])}")
    print(f"   Totale pattern trovati: {len(patterns_rbd) + len(patterns_dbr)}")

if __name__ == "__main__":
    test_all_patterns()