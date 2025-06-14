# ===== FILE: TechnicalAnalysisManager.py =====
"""
Manager principale per l'analisi tecnica integrato nella dashboard.
Combina supporti/resistenze classici e zone Skorupinski.
"""

import json
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Union
import uuid

# Import dei moduli esistenti (da copiare nella root del progetto)
from moduls.TechnicalAnalysis.SupportResistanceManager import SupportResistanceManager
from moduls.TechnicalAnalysis.SkorupinkiZoneManager import SkorupinkiZoneManager
from moduls.TechnicalAnalysis.ImprovedSkorupinkiPatterns import ImprovedSkorupinkiPatterns

class TechnicalAnalysisManager:
    """
    Manager principale per tutta l'analisi tecnica.
    Combina supporti/resistenze classici e zone Skorupinski.
    """
    
    def __init__(self, base_dir='resources'):
        """
        Inizializza il manager dell'analisi tecnica.
        
        Args:
            base_dir: directory base del progetto
        """
        self.base_dir = Path(base_dir)
        
        # Directory setup
        self.data_dir = self.base_dir / 'data' / 'daily'
        self.data_dir_not_adj = self.base_dir / 'data' / 'daily_notAdjusted'
        self.config_file = self.base_dir / 'config' / 'tickers.json'
        
        # Output directories per analisi tecnica
        self.analysis_dir = self.base_dir / 'analysis'
        self.sr_output_dir = self.analysis_dir / 'support_resistance'
        self.skorupinski_output_dir = self.analysis_dir / 'skorupinski_zones'
        
        # File stato per tracking elaborazioni
        self.sr_state_file = self.analysis_dir / 'sr_state.json'
        self.skorupinski_state_file = self.analysis_dir / 'skorupinski_state.json'
        
        # Crea directory se non esistono
        self._ensure_directories()
        
        # Inizializza i manager specifici
        self._initialize_managers()
    
    def _ensure_directories(self):
        """Crea tutte le directory necessarie."""
        directories = [
            self.analysis_dir,
            self.sr_output_dir,
            self.skorupinski_output_dir
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
        
        print(f"📁 Directory analisi tecnica inizializzate: {self.analysis_dir}")
    
    def _initialize_managers(self):
        """Inizializza i manager specifici per ogni tipo di analisi."""
        # Manager per supporti/resistenze classici
        self.sr_manager = SupportResistanceManager(
            input_file=self.sr_state_file,
            input_folder_prices=self.data_dir,  # Usa adjusted di default
            output_folder=self.sr_output_dir,
            min_distance_factor=0.5,
            touch_tolerance_factor=0.1,
            max_years_lookback=5
        )
        
        # Manager per zone Skorupinski
        self.skorupinski_manager = SkorupinkiZoneManager(
            input_file=self.skorupinski_state_file,
            input_folder_prices=self.data_dir,  # Usa adjusted di default
            output_folder=self.skorupinski_output_dir,
            min_pullback_pct=2.0,
            zone_thickness_pct=0.3,
            max_lookback_bars=60,
            min_zone_strength=1,
            max_years_lookback=5,
            min_impulse_pct=1.2,
            max_base_bars=10
        )
        
        # Inizializza file di stato se non esistono
        self._initialize_state_files()
    
    def _initialize_state_files(self):
        """Inizializza i file di stato per tracking elaborazioni."""
        # Carica ticker configurati
        ticker_config = self._load_ticker_config()
        tickers = ticker_config.get('tickers', [])
        
        # Inizializza stato S/R se non esiste
        if not self.sr_state_file.exists():
            sr_state = {}
            for ticker in tickers:
                sr_state[ticker] = "1900-01-01T00:00:00"  # Data molto vecchia per forzare primo calcolo
            
            with open(self.sr_state_file, 'w') as f:
                json.dump(sr_state, f, indent=2)
            print(f"📝 Inizializzato file stato S/R con {len(tickers)} ticker")
        
        # Inizializza stato Skorupinski se non esiste
        if not self.skorupinski_state_file.exists():
            skorupinski_state = {}
            for ticker in tickers:
                skorupinski_state[ticker] = "1900-01-01T00:00:00"
            
            with open(self.skorupinski_state_file, 'w') as f:
                json.dump(skorupinski_state, f, indent=2)
            print(f"📝 Inizializzato file stato Skorupinski con {len(tickers)} ticker")
    
    def _load_ticker_config(self) -> Dict:
        """Carica la configurazione dei ticker."""
        if not self.config_file.exists():
            return {'tickers': []}
        
        with open(self.config_file, 'r') as f:
            return json.load(f)
    
    def set_data_source(self, use_adjusted: bool = True):
        """
        Cambia la fonte dati per l'analisi.
        
        Args:
            use_adjusted: True per dati adjusted, False per notAdjusted
        """
        if use_adjusted:
            input_folder = self.data_dir
            print("📊 Impostata fonte dati: ADJUSTED (per splits e dividendi)")
        else:
            input_folder = self.data_dir_not_adj
            print("📊 Impostata fonte dati: NOT ADJUSTED (prezzi originali)")
        
        # Aggiorna i manager
        self.sr_manager.input_folder_prices = input_folder
        self.skorupinski_manager.input_folder_prices = input_folder
    
    def run_support_resistance_analysis(self) -> Dict[str, bool]:
        """Esegue l'analisi di supporti e resistenze classici."""
        print("\n🔧 ===== ANALISI SUPPORTI E RESISTENZE CLASSICI =====")
        return self.sr_manager.run()
    
    def run_skorupinski_analysis(self) -> Dict[str, bool]:
        """Esegue l'analisi delle zone Skorupinski."""
        print("\n🎯 ===== ANALISI ZONE SKORUPINSKI =====")
        return self.skorupinski_manager.run()
    
    def run_full_analysis(self, use_adjusted: bool = True) -> Dict[str, Dict[str, bool]]:
        """
        Esegue l'analisi tecnica completa.
        
        Args:
            use_adjusted: tipo di dati da utilizzare
            
        Returns:
            Dict con risultati di entrambe le analisi
        """
        print(f"\n🚀 ===== ANALISI TECNICA COMPLETA =====")
        
        # Imposta fonte dati
        self.set_data_source(use_adjusted)
        
        # Esegui entrambe le analisi
        sr_results = self.run_support_resistance_analysis()
        skorupinski_results = self.run_skorupinski_analysis()
        
        return {
            'support_resistance': sr_results,
            'skorupinski_zones': skorupinski_results
        }
    
    def get_ticker_analysis_data(self, ticker: str, analysis_type: str = 'both') -> Dict:
        """
        Ottiene i dati di analisi per un ticker specifico.
        
        Args:
            ticker: simbolo del ticker
            analysis_type: 'sr', 'skorupinski', or 'both'
            
        Returns:
            Dict con i dati di analisi
        """
        result = {'ticker': ticker}
        
        if analysis_type in ['sr', 'both']:
            # Carica supporti e resistenze
            sr_data = self.sr_manager.get_levels_summary(ticker)
            if sr_data is not None and not sr_data.empty:
                result['support_resistance'] = sr_data.to_dict('records')
            else:
                result['support_resistance'] = []
        
        if analysis_type in ['skorupinski', 'both']:
            # Carica zone Skorupinski
            skorupinski_file = self.skorupinski_output_dir / f"{ticker}_SkorupinkiZones.csv"
            if skorupinski_file.exists():
                skorupinski_data = pd.read_csv(skorupinski_file, parse_dates=['date'])
                result['skorupinski_zones'] = skorupinski_data.to_dict('records')
            else:
                result['skorupinski_zones'] = []
        
        return result
    
    def get_analysis_summary(self) -> Dict:
        """Ottiene un riassunto di tutte le analisi."""
        ticker_config = self._load_ticker_config()
        tickers = ticker_config.get('tickers', [])
        
        summary = {
            'total_tickers': len(tickers),
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
        
        # Conta analisi supporti/resistenze
        for ticker in tickers:
            sr_file = self.sr_output_dir / f"{ticker}_SR.csv"
            if sr_file.exists():
                summary['support_resistance']['analyzed'] += 1
                sr_data = pd.read_csv(sr_file)
                summary['support_resistance']['total_levels'] += len(sr_data)
        
        # Conta zone Skorupinski
        for ticker in tickers:
            sz_file = self.skorupinski_output_dir / f"{ticker}_SkorupinkiZones.csv"
            if sz_file.exists():
                summary['skorupinski_zones']['analyzed'] += 1
                sz_data = pd.read_csv(sz_file)
                summary['skorupinski_zones']['total_zones'] += len(sz_data)
                summary['skorupinski_zones']['supply_zones'] += len(sz_data[sz_data['type'] == 'Supply'])
                summary['skorupinski_zones']['demand_zones'] += len(sz_data[sz_data['type'] == 'Demand'])
        
        return summary
    
    def get_ticker_chart_data(self, ticker: str, days: int = 100, include_analysis: bool = True) -> Dict:
        """
        Ottiene dati per grafico di un ticker con analisi tecnica.
        
        Args:
            ticker: simbolo del ticker
            days: numero di giorni di storico
            include_analysis: se includere supporti/resistenze e zone
            
        Returns:
            Dict con dati OHLC e analisi tecnica
        """
        # Carica dati prezzi (usa la fonte attualmente configurata)
        try:
            if self.sr_manager.input_folder_prices == self.data_dir:
                price_file = self.data_dir / f"{ticker}.csv"
                data_type = "adjusted"
            else:
                price_file = self.data_dir_not_adj / f"{ticker}_notAdjusted.csv"
                data_type = "notAdjusted"
            
            if not price_file.exists():
                raise FileNotFoundError(f"File dati non trovato: {price_file}")
            
            # Carica e filtra dati
            df = pd.read_csv(price_file, parse_dates=['Date'])
            df = df.tail(days).copy()  # Ultimi N giorni
            
            result = {
                'ticker': ticker,
                'data_type': data_type,
                'price_data': [],
                'support_resistance': [],
                'skorupinski_zones': []
            }
            
            # Converti dati prezzi in formato compatibile con grafici
            for _, row in df.iterrows():
                result['price_data'].append({
                    'date': row['Date'].strftime('%Y-%m-%d'),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row.get('Volume', 0))
                })
            
            if include_analysis:
                # Aggiungi supporti e resistenze
                sr_data = self.sr_manager.get_current_levels(ticker, max_days_old=60, min_strength=1.5)
                if sr_data is not None and not sr_data.empty:
                    result['support_resistance'] = sr_data.to_dict('records')
                
                # Aggiungi zone Skorupinski
                analysis_data = self.get_ticker_analysis_data(ticker, 'skorupinski')
                result['skorupinski_zones'] = analysis_data.get('skorupinski_zones', [])
            
            return result
            
        except Exception as e:
            print(f"❌ Errore nel caricamento dati grafico per {ticker}: {str(e)}")
            return {
                'ticker': ticker,
                'error': str(e),
                'price_data': [],
                'support_resistance': [],
                'skorupinski_zones': []
            }
