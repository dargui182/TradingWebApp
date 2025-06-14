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

import plotly.graph_objects as go
import plotly.utils
from plotly.subplots import make_subplots
import json
import logging

# Setup logging (aggiungi in cima al file se non esiste)
logger = logging.getLogger(__name__)



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

    # ===== FIX per TechnicalAnalysisManager.py =====
# Aggiungi questo metodo corretto:

    def generate_plotly_chart(self, ticker, days=100, include_analysis=True):
        """
        Genera un grafico Plotly con candlestick e analisi tecnica
        """
        try:
            logger.info(f"Generazione grafico Plotly per {ticker}, {days} giorni")
            
            # Ottieni dati usando il metodo esistente
            data = self.get_ticker_chart_data(ticker, days, include_analysis)
            
            if not data or 'price_data' not in data or not data['price_data']:
                raise ValueError(f"Nessun dato disponibile per {ticker}")
            
            logger.info(f"Dati caricati per {ticker}: {len(data['price_data'])} punti prezzo")
            
            # Debug: stampa la struttura di skorupinski_zones
            if 'skorupinski_zones' in data:
                logger.info(f"Struttura skorupinski_zones per {ticker}: {type(data['skorupinski_zones'])}")
                if isinstance(data['skorupinski_zones'], list):
                    logger.info(f"Zone Skorupinski (lista): {len(data['skorupinski_zones'])} elementi")
                    if data['skorupinski_zones']:
                        logger.info(f"Primo elemento: {data['skorupinski_zones'][0]}")
                elif isinstance(data['skorupinski_zones'], dict):
                    logger.info(f"Zone Skorupinski (dict): {list(data['skorupinski_zones'].keys())}")
            
            # Crea subplot con volume opzionale
            has_volume = len(data['price_data']) > 0 and 'volume' in data['price_data'][0]
            
            if has_volume:
                fig = make_subplots(
                    rows=2, cols=1,
                    shared_xaxes=True,
                    vertical_spacing=0.1,
                    subplot_titles=(f'{ticker} - Analisi Tecnica', 'Volume'),
                    row_heights=[0.7, 0.3]
                )
            else:
                fig = go.Figure()
            
            # ===== CANDLESTICK PRINCIPALE =====
            dates = [item['date'] for item in data['price_data']]
            opens = [item['open'] for item in data['price_data']]
            highs = [item['high'] for item in data['price_data']]
            lows = [item['low'] for item in data['price_data']]
            closes = [item['close'] for item in data['price_data']]
            
            candlestick = go.Candlestick(
                x=dates,
                open=opens,
                high=highs,
                low=lows,
                close=closes,
                name=ticker,
                increasing_line_color='#00C851',
                decreasing_line_color='#FF4444',
                increasing_line_width=2,
                decreasing_line_width=2
            )
            
            if has_volume:
                fig.add_trace(candlestick, row=1, col=1)
            else:
                fig.add_trace(candlestick)
            
            # ===== SUPPORTI E RESISTENZE =====
            if include_analysis and data.get('support_resistance'):
                sr_levels = data['support_resistance']
                logger.info(f"Aggiungendo {len(sr_levels)} livelli S&R per {ticker}")
                
                for level in sr_levels:
                    color = '#28a745' if level.get('type') == 'support' else '#dc3545'
                    level_value = level.get('level')
                    
                    if level_value is not None:
                        # Aggiungi linea orizzontale
                        if has_volume:
                            fig.add_hline(
                                y=level_value,
                                line_dash="dash",
                                line_color=color,
                                line_width=2,
                                annotation_text=f"{level.get('type', '').title()} ${level_value:.2f}",
                                annotation_position="top right",
                                row=1, col=1
                            )
                        else:
                            fig.add_hline(
                                y=level_value,
                                line_dash="dash", 
                                line_color=color,
                                line_width=2,
                                annotation_text=f"{level.get('type', '').title()} ${level_value:.2f}",
                                annotation_position="top right"
                            )
            
            # ===== ZONE SKORUPINSKI =====
            if include_analysis and data.get('skorupinski_zones'):
                skorupinski_data = data['skorupinski_zones']
                
                # Gestisci diversi formati di dati Skorupinski
                if isinstance(skorupinski_data, list):
                    # Formato: lista di zone direttamente dal CSV
                    logger.info(f"Processando {len(skorupinski_data)} zone Skorupinski (formato lista)")
                    
                    demand_zones = []
                    supply_zones = []
                    
                    for zone in skorupinski_data:
                        if isinstance(zone, dict):
                            zone_type = zone.get('type', '').lower()
                            if 'demand' in zone_type or 'support' in zone_type:
                                demand_zones.append(zone)
                            elif 'supply' in zone_type or 'resistance' in zone_type:
                                supply_zones.append(zone)
                    
                    # Aggiungi zone di domanda
                    for i, zone in enumerate(demand_zones):
                        zone_bottom = zone.get('zone_bottom') or zone.get('bottom') or zone.get('low')
                        zone_top = zone.get('zone_top') or zone.get('top') or zone.get('high')
                        
                        if zone_bottom is not None and zone_top is not None:
                            if has_volume:
                                fig.add_hrect(
                                    y0=zone_bottom,
                                    y1=zone_top,
                                    fillcolor="rgba(40, 167, 69, 0.2)",
                                    line_color="rgba(40, 167, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=f"Demand {i+1}",
                                    annotation_position="top left",
                                    row=1, col=1
                                )
                            else:
                                fig.add_hrect(
                                    y0=zone_bottom,
                                    y1=zone_top,
                                    fillcolor="rgba(40, 167, 69, 0.2)",
                                    line_color="rgba(40, 167, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=f"Demand {i+1}",
                                    annotation_position="top left"
                                )
                    
                    # Aggiungi zone di offerta
                    for i, zone in enumerate(supply_zones):
                        zone_bottom = zone.get('zone_bottom') or zone.get('bottom') or zone.get('low')
                        zone_top = zone.get('zone_top') or zone.get('top') or zone.get('high')
                        
                        if zone_bottom is not None and zone_top is not None:
                            if has_volume:
                                fig.add_hrect(
                                    y0=zone_bottom,
                                    y1=zone_top,
                                    fillcolor="rgba(220, 53, 69, 0.2)",
                                    line_color="rgba(220, 53, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=f"Supply {i+1}",
                                    annotation_position="top left",
                                    row=1, col=1
                                )
                            else:
                                fig.add_hrect(
                                    y0=zone_bottom,
                                    y1=zone_top,
                                    fillcolor="rgba(220, 53, 69, 0.2)",
                                    line_color="rgba(220, 53, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=f"Supply {i+1}",
                                    annotation_position="top left"
                                )
                    
                    logger.info(f"Zone aggiunte: {len(demand_zones)} demand, {len(supply_zones)} supply")
                    
                elif isinstance(skorupinski_data, dict):
                    # Formato: dizionario con demand_zones e supply_zones
                    logger.info("Processando zone Skorupinski (formato dizionario)")
                    
                    # Zone di domanda
                    if skorupinski_data.get('demand_zones'):
                        for i, zone in enumerate(skorupinski_data['demand_zones']):
                            if has_volume:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(40, 167, 69, 0.2)",
                                    line_color="rgba(40, 167, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=f"Demand {i+1}",
                                    annotation_position="top left",
                                    row=1, col=1
                                )
                            else:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(40, 167, 69, 0.2)",
                                    line_color="rgba(40, 167, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=f"Demand {i+1}",
                                    annotation_position="top left"
                                )
                    
                    # Zone di offerta
                    if skorupinski_data.get('supply_zones'):
                        for i, zone in enumerate(skorupinski_data['supply_zones']):
                            if has_volume:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(220, 53, 69, 0.2)",
                                    line_color="rgba(220, 53, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=f"Supply {i+1}",
                                    annotation_position="top left",
                                    row=1, col=1
                                )
                            else:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(220, 53, 69, 0.2)",
                                    line_color="rgba(220, 53, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=f"Supply {i+1}",
                                    annotation_position="top left"
                                )
            
            # ===== VOLUME (se disponibile) =====
            if has_volume:
                volumes = [item.get('volume', 0) for item in data['price_data']]
                colors = ['#00C851' if closes[i] >= opens[i] else '#FF4444' for i in range(len(closes))]
                
                volume_trace = go.Bar(
                    x=dates,
                    y=volumes,
                    name='Volume',
                    marker_color=colors,
                    opacity=0.6
                )
                fig.add_trace(volume_trace, row=2, col=1)
            
            # ===== LAYOUT E STILE =====
            fig.update_layout(
                title={
                    'text': f'{ticker} - Analisi Tecnica Completa',
                    'x': 0.5,
                    'xanchor': 'center',
                    'font': {'size': 20}
                },
                template='plotly_white',
                showlegend=True,
                height=700 if has_volume else 600,
                hovermode='x unified',
                xaxis_rangeslider_visible=False,
                margin=dict(l=50, r=50, t=80, b=50)
            )
            
            # Personalizza assi
            if has_volume:
                fig.update_xaxes(
                    type='date',
                    tickformat='%d/%m/%Y',
                    title_text='Data',
                    row=2, col=1
                )
                fig.update_yaxes(
                    title_text='Prezzo ($)',
                    row=1, col=1
                )
                fig.update_yaxes(
                    title_text='Volume',
                    row=2, col=1
                )
            else:
                fig.update_xaxes(
                    type='date',
                    tickformat='%d/%m/%Y',
                    title_text='Data'
                )
                fig.update_yaxes(
                    title_text='Prezzo ($)'
                )
            
            # Converti in JSON per il frontend
            chart_json = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
            
            logger.info(f"Grafico Plotly generato con successo per {ticker}")
            
            # Calcola statistiche zone
            demand_count = 0
            supply_count = 0
            
            if isinstance(data.get('skorupinski_zones'), list):
                for zone in data['skorupinski_zones']:
                    zone_type = zone.get('type', '').lower()
                    if 'demand' in zone_type or 'support' in zone_type:
                        demand_count += 1
                    elif 'supply' in zone_type or 'resistance' in zone_type:
                        supply_count += 1
            elif isinstance(data.get('skorupinski_zones'), dict):
                demand_count = len(data['skorupinski_zones'].get('demand_zones', []))
                supply_count = len(data['skorupinski_zones'].get('supply_zones', []))
            
            return {
                'chart_json': chart_json,
                'chart_config': {
                    'displayModeBar': True,
                    'displaylogo': False,
                    'modeBarButtonsToRemove': ['pan2d', 'lasso2d', 'select2d'],
                    'responsive': True
                },
                'data_info': {
                    'ticker': ticker,
                    'days': days,
                    'data_points': len(data['price_data']),
                    'first_date': dates[0] if dates else None,
                    'last_date': dates[-1] if dates else None,
                    'sr_levels': len(data.get('support_resistance', [])),
                    'demand_zones': demand_count,
                    'supply_zones': supply_count,
                    'has_volume': has_volume
                }
            }
            
        except Exception as e:
            logger.error(f"Errore generazione grafico Plotly per {ticker}: {e}")
            import traceback
            logger.error(f"Traceback completo: {traceback.format_exc()}")
            raise
            """
            Genera un grafico Plotly con candlestick e analisi tecnica
            """
            try:
                logger.info(f"Generazione grafico Plotly per {ticker}, {days} giorni")
                
                # Ottieni dati usando il metodo esistente
                data = self.get_ticker_chart_data(ticker, days, include_analysis)
                
                if not data or 'price_data' not in data or not data['price_data']:
                    raise ValueError(f"Nessun dato disponibile per {ticker}")
                
                # Crea subplot con volume opzionale
                has_volume = 'volume' in data['price_data'][0] if data['price_data'] else False
                
                if has_volume:
                    fig = make_subplots(
                        rows=2, cols=1,
                        shared_xaxes=True,
                        vertical_spacing=0.1,
                        subplot_titles=(f'{ticker} - Analisi Tecnica', 'Volume'),
                        row_heights=[0.7, 0.3]
                    )
                else:
                    fig = go.Figure()
                
                # ===== CANDLESTICK PRINCIPALE =====
                dates = [item['date'] for item in data['price_data']]
                opens = [item['open'] for item in data['price_data']]
                highs = [item['high'] for item in data['price_data']]
                lows = [item['low'] for item in data['price_data']]
                closes = [item['close'] for item in data['price_data']]
                
                candlestick = go.Candlestick(
                    x=dates,
                    open=opens,
                    high=highs,
                    low=lows,
                    close=closes,
                    name=ticker,
                    increasing_line_color='#00C851',
                    decreasing_line_color='#FF4444',
                    increasing_line_width=2,
                    decreasing_line_width=2
                )
                
                if has_volume:
                    fig.add_trace(candlestick, row=1, col=1)
                else:
                    fig.add_trace(candlestick)
                
                # ===== SUPPORTI E RESISTENZE =====
                if include_analysis and data.get('support_resistance'):
                    logger.info(f"Aggiungendo {len(data['support_resistance'])} livelli S&R")
                    
                    for level in data['support_resistance']:
                        color = '#28a745' if level['type'] == 'support' else '#dc3545'
                        level_value = level['level']
                        
                        # Aggiungi linea orizzontale
                        if has_volume:
                            fig.add_hline(
                                y=level_value,
                                line_dash="dash",
                                line_color=color,
                                line_width=2,
                                annotation_text=f"{level['type'].title()} ${level_value:.2f}",
                                annotation_position="top right",
                                row=1, col=1
                            )
                        else:
                            fig.add_hline(
                                y=level_value,
                                line_dash="dash", 
                                line_color=color,
                                line_width=2,
                                annotation_text=f"{level['type'].title()} ${level_value:.2f}",
                                annotation_position="top right"
                            )
                
                # ===== ZONE SKORUPINSKI =====
                if include_analysis and data.get('skorupinski_zones'):
                    logger.info("Aggiungendo zone Skorupinski")
                    
                    # Zone di domanda (support)
                    if data['skorupinski_zones'].get('demand_zones'):
                        for i, zone in enumerate(data['skorupinski_zones']['demand_zones']):
                            if has_volume:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(40, 167, 69, 0.2)",
                                    line_color="rgba(40, 167, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=f"Demand {i+1}",
                                    annotation_position="top left",
                                    row=1, col=1
                                )
                            else:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(40, 167, 69, 0.2)",
                                    line_color="rgba(40, 167, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=f"Demand {i+1}",
                                    annotation_position="top left"
                                )
                    
                    # Zone di offerta (resistance)
                    if data['skorupinski_zones'].get('supply_zones'):
                        for i, zone in enumerate(data['skorupinski_zones']['supply_zones']):
                            if has_volume:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(220, 53, 69, 0.2)",
                                    line_color="rgba(220, 53, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=f"Supply {i+1}",
                                    annotation_position="top left",
                                    row=1, col=1
                                )
                            else:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(220, 53, 69, 0.2)",
                                    line_color="rgba(220, 53, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=f"Supply {i+1}",
                                    annotation_position="top left"
                                )
                
                # ===== VOLUME (se disponibile) =====
                if has_volume:
                    volumes = [item.get('volume', 0) for item in data['price_data']]
                    colors = ['#00C851' if closes[i] >= opens[i] else '#FF4444' for i in range(len(closes))]
                    
                    volume_trace = go.Bar(
                        x=dates,
                        y=volumes,
                        name='Volume',
                        marker_color=colors,
                        opacity=0.6
                    )
                    fig.add_trace(volume_trace, row=2, col=1)
                
                # ===== LAYOUT E STILE =====
                fig.update_layout(
                    title={
                        'text': f'{ticker} - Analisi Tecnica Completa',
                        'x': 0.5,
                        'xanchor': 'center',
                        'font': {'size': 20}
                    },
                    template='plotly_white',
                    showlegend=True,
                    height=700 if has_volume else 600,
                    hovermode='x unified',
                    xaxis_rangeslider_visible=False,
                    margin=dict(l=50, r=50, t=80, b=50)
                )
                
                # Personalizza assi
                if has_volume:
                    fig.update_xaxes(
                        type='date',
                        tickformat='%d/%m/%Y',
                        title_text='Data',
                        row=2, col=1
                    )
                    fig.update_yaxes(
                        title_text='Prezzo ($)',
                        row=1, col=1
                    )
                    fig.update_yaxes(
                        title_text='Volume',
                        row=2, col=1
                    )
                else:
                    fig.update_xaxes(
                        type='date',
                        tickformat='%d/%m/%Y',
                        title_text='Data'
                    )
                    fig.update_yaxes(
                        title_text='Prezzo ($)'
                    )
                
                # Converti in JSON per il frontend
                chart_json = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
                
                logger.info(f"Grafico Plotly generato con successo per {ticker}")
                
                return {
                    'chart_json': chart_json,
                    'chart_config': {
                        'displayModeBar': True,
                        'displaylogo': False,
                        'modeBarButtonsToRemove': ['pan2d', 'lasso2d', 'select2d'],
                        'responsive': True
                    },
                    'data_info': {
                        'ticker': ticker,
                        'days': days,
                        'data_points': len(data['price_data']),
                        'first_date': dates[0] if dates else None,
                        'last_date': dates[-1] if dates else None,
                        'sr_levels': len(data.get('support_resistance', [])),
                        'demand_zones': len(data.get('skorupinski_zones', {}).get('demand_zones', [])),
                        'supply_zones': len(data.get('skorupinski_zones', {}).get('supply_zones', [])),
                        'has_volume': has_volume
                    }
                }
                
            except Exception as e:
                logger.error(f"Errore generazione grafico Plotly per {ticker}: {e}")
                raise
                """
                Genera un grafico Plotly con candlestick e analisi tecnica
                """
                try:
                    # Ottieni dati
                    data = self.get_ticker_chart_data(ticker, days, include_analysis)
                    
                    # Crea subplot con volume (opzionale)
                    fig = make_subplots(
                        rows=2, cols=1,
                        shared_xaxes=True,
                        vertical_spacing=0.1,
                        subplot_titles=(f'{ticker} - Analisi Tecnica', 'Volume'),
                        row_width=[0.7, 0.3]
                    )
                    
                    # ===== CANDLESTICK PRINCIPALE =====
                    candlestick = go.Candlestick(
                        x=[item['date'] for item in data['price_data']],
                        open=[item['open'] for item in data['price_data']],
                        high=[item['high'] for item in data['price_data']],
                        low=[item['low'] for item in data['price_data']],
                        close=[item['close'] for item in data['price_data']],
                        name=ticker,
                        increasing_line_color='#00C851',
                        decreasing_line_color='#FF4444'
                    )
                    fig.add_trace(candlestick, row=1, col=1)
                    
                    # ===== SUPPORTI E RESISTENZE =====
                    if include_analysis and data.get('support_resistance'):
                        for level in data['support_resistance']:
                            color = '#28a745' if level['type'] == 'support' else '#dc3545'
                            fig.add_hline(
                                y=level['level'],
                                line_dash="dash",
                                line_color=color,
                                annotation_text=f"{level['type'].title()} ${level['level']:.2f}",
                                annotation_position="top right",
                                row=1, col=1
                            )
                    
                    # ===== ZONE SKORUPINSKI =====
                    if include_analysis and data.get('skorupinski_zones'):
                        # Zone di domanda (support)
                        if data['skorupinski_zones'].get('demand_zones'):
                            for zone in data['skorupinski_zones']['demand_zones']:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(40, 167, 69, 0.2)",
                                    line_color="rgba(40, 167, 69, 0.8)",
                                    annotation_text=f"Demand Zone",
                                    annotation_position="top left",
                                    row=1, col=1
                                )
                        
                        # Zone di offerta (resistance)
                        if data['skorupinski_zones'].get('supply_zones'):
                            for zone in data['skorupinski_zones']['supply_zones']:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(220, 53, 69, 0.2)",
                                    line_color="rgba(220, 53, 69, 0.8)",
                                    annotation_text=f"Supply Zone",
                                    annotation_position="top left",
                                    row=1, col=1
                                )
                    
                    # ===== VOLUME (se disponibile) =====
                    if 'volume' in data['price_data'][0]:
                        volume = go.Bar(
                            x=[item['date'] for item in data['price_data']],
                            y=[item.get('volume', 0) for item in data['price_data']],
                            name='Volume',
                            marker_color='rgba(0, 123, 255, 0.6)'
                        )
                        fig.add_trace(volume, row=2, col=1)
                    
                    # ===== LAYOUT E STILE =====
                    fig.update_layout(
                        title=f'{ticker} - Analisi Tecnica Completa',
                        yaxis_title='Prezzo ($)',
                        xaxis_title='Data',
                        template='plotly_white',
                        showlegend=True,
                        height=600,
                        hovermode='x unified',
                        xaxis_rangeslider_visible=False
                    )
                    
                    # Personalizza assi
                    fig.update_xaxes(
                        type='date',
                        tickformat='%d/%m/%Y',
                        row=1, col=1
                    )
                    
                    # Converti in JSON per il frontend
                    chart_json = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
                    
                    return {
                        'chart_json': chart_json,
                        'chart_config': {
                            'displayModeBar': True,
                            'displaylogo': False,
                            'modeBarButtonsToRemove': ['pan2d', 'lasso2d', 'select2d']
                        },
                        'data_info': {
                            'ticker': ticker,
                            'days': days,
                            'data_points': len(data['price_data']),
                            'sr_levels': len(data.get('support_resistance', [])),
                            'demand_zones': len(data.get('skorupinski_zones', {}).get('demand_zones', [])),
                            'supply_zones': len(data.get('skorupinski_zones', {}).get('supply_zones', []))
                        }
                    }
                    
                except Exception as e:
                    logger.error(f"Errore generazione grafico Plotly: {e}")
                    raise