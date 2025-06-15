# ===== FILE: moduls/TechnicalAnalysis/TechnicalAnalysisManager.py =====
"""
Manager principale per l'analisi tecnica integrato nella dashboard.
Combina supporti/resistenze classici e zone Skorupinski con prezzi centrali.
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

# Setup logging
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
        try:
            # Supporti e Resistenze Manager
            self.sr_manager = SupportResistanceManager(
                input_folder_prices=self.data_dir,
                output_folder=self.sr_output_dir,
                state_file=self.sr_state_file
            )
            
            # Skorupinski Zone Manager
            self.skorupinski_manager = SkorupinkiZoneManager(
                input_folder_prices=self.data_dir,
                output_folder=self.skorupinski_output_dir,
                state_file=self.skorupinski_state_file
            )
            
            print("✅ Manager analisi tecnica inizializzati")
            
        except Exception as e:
            logger.error(f"Errore inizializzazione manager: {e}")
            # Inizializza con valori None per evitare crash
            self.sr_manager = None
            self.skorupinski_manager = None
    
    def _load_ticker_config(self):
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
        if self.sr_manager:
            self.sr_manager.input_folder_prices = input_folder
        if self.skorupinski_manager:
            self.skorupinski_manager.input_folder_prices = input_folder
    
    def run_support_resistance_analysis(self) -> Dict[str, bool]:
        """Esegue l'analisi di supporti e resistenze classici."""
        print("\n🔧 ===== ANALISI SUPPORTI E RESISTENZE CLASSICI =====")
        if self.sr_manager:
            return self.sr_manager.run()
        else:
            logger.error("SupportResistanceManager non inizializzato")
            return {}
    
    def run_skorupinski_analysis(self) -> Dict[str, bool]:
        """Esegue l'analisi delle zone Skorupinski."""
        print("\n🎯 ===== ANALISI ZONE SKORUPINSKI =====")
        if self.skorupinski_manager:
            return self.skorupinski_manager.run()
        else:
            logger.error("SkorupinkiZoneManager non inizializzato")
            return {}
    
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
            analysis_type: 'sr', 'skorupinski', o 'both'
            
        Returns:
            Dict con i dati di analisi
        """
        result = {'ticker': ticker}
        
        try:
            # Supporti e resistenze
            if analysis_type in ['sr', 'both']:
                sr_file = self.sr_output_dir / f"{ticker}_SR.csv"
                if sr_file.exists():
                    sr_data = pd.read_csv(sr_file)
                    result['support_resistance'] = sr_data.to_dict('records')
                else:
                    result['support_resistance'] = []
            
            # Zone Skorupinski
            if analysis_type in ['skorupinski', 'both']:
                sz_file = self.skorupinski_output_dir / f"{ticker}_SkorupinkiZones.csv"
                if sz_file.exists():
                    sz_data = pd.read_csv(sz_file)
                    result['skorupinski_zones'] = sz_data.to_dict('records')
                else:
                    result['skorupinski_zones'] = []
            
            return result
            
        except Exception as e:
            logger.error(f"Errore nel recuperare dati analisi per {ticker}: {e}")
            return result
    
    def load_ticker_price_data(self, ticker: str, days: int = 100) -> Optional[pd.DataFrame]:
        """
        Carica i dati di prezzo per un ticker.
        
        Args:
            ticker: simbolo del ticker
            days: numero di giorni di storico
            
        Returns:
            DataFrame con i dati di prezzo o None se non trovato
        """
        try:
            # Prova prima con dati adjusted
            file_path = self.data_dir / f"{ticker}.csv"
            
            if not file_path.exists():
                # Fallback a dati non adjusted
                file_path = self.data_dir_not_adj / f"{ticker}_notAdjusted.csv"
            
            if not file_path.exists():
                logger.warning(f"File dati non trovato per {ticker}")
                return None
            
            # Carica i dati
            df = pd.read_csv(file_path)
            
            # Converti la colonna Date
            df['Date'] = pd.to_datetime(df['Date'])
            
            # Ordina per data (più recenti alla fine)
            df = df.sort_values('Date')
            
            # Prendi gli ultimi N giorni
            if days > 0:
                df = df.tail(days)
            
            logger.info(f"Caricati {len(df)} record per {ticker} (ultimi {days} giorni)")
            return df
            
        except Exception as e:
            logger.error(f"Errore nel caricare dati per {ticker}: {e}")
            return None
    
    def get_ticker_chart_data(self, ticker: str, days: int = 100, include_analysis: bool = True) -> Dict:
        """
        Ottiene tutti i dati necessari per il grafico di un ticker.
        
        Args:
            ticker: simbolo del ticker
            days: giorni di storico
            include_analysis: se includere i dati di analisi tecnica
            
        Returns:
            Dict con price_data, support_resistance, skorupinski_zones
        """
        try:
            result = {'ticker': ticker, 'days': days}
            
            # Carica dati di prezzo
            price_df = self.load_ticker_price_data(ticker, days)
            if price_df is None:
                return result
            
            # Converti a formato JSON serializzabile
            price_data = []
            for _, row in price_df.iterrows():
                price_record = {
                    'date': row['Date'].strftime('%Y-%m-%d'),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close'])
                }
                
                # Aggiungi volume se presente
                if 'Volume' in row and pd.notna(row['Volume']):
                    price_record['volume'] = int(row['Volume'])
                
                # Aggiungi Adj Close se presente (per dati adjusted)
                if 'Adj Close' in row and pd.notna(row['Adj Close']):
                    price_record['adj_close'] = float(row['Adj Close'])
                
                price_data.append(price_record)
            
            result['price_data'] = price_data
            
            # Includi analisi tecnica se richiesta
            if include_analysis:
                analysis_data = self.get_ticker_analysis_data(ticker, 'both')
                result.update(analysis_data)
            
            return result
            
        except Exception as e:
            logger.error(f"Errore nel preparare dati grafico per {ticker}: {e}")
            return {'ticker': ticker, 'days': days, 'error': str(e)}
    
    def generate_plotly_chart(self, ticker, days=100, include_analysis=True):
        """
        Genera un grafico Plotly con candlestick e analisi tecnica con zone Skorupinski migliorate
        """
        try:
            logger.info(f"Generazione grafico Plotly per {ticker}, {days} giorni")
            
            # Ottieni dati usando il metodo esistente
            data = self.get_ticker_chart_data(ticker, days, include_analysis)
            
            if not data or 'price_data' not in data or not data['price_data']:
                raise ValueError(f"Nessun dato disponibile per {ticker}")
            
            logger.info(f"Dati caricati per {ticker}: {len(data['price_data'])} punti prezzo")
            
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
                fig = make_subplots(
                    rows=1, cols=1,
                    subplot_titles=(f'{ticker} - Analisi Tecnica',)
                )
            
            # Prepara dati per candlestick
            dates = [item['date'] for item in data['price_data']]
            opens = [item['open'] for item in data['price_data']]
            highs = [item['high'] for item in data['price_data']]
            lows = [item['low'] for item in data['price_data']]
            closes = [item['close'] for item in data['price_data']]
            volumes = [item.get('volume', 0) for item in data['price_data']]
            
            # Candlestick chart
            candlestick = go.Candlestick(
                x=dates,
                open=opens,
                high=highs,
                low=lows,
                close=closes,
                name=ticker,
                increasing_line_color='#00C851',
                decreasing_line_color='#FF4444'
            )
            fig.add_trace(candlestick, row=1, col=1)
            
            # Volume chart se disponibile
            if has_volume:
                volume_colors = ['#00C851' if close >= open else '#FF4444' 
                               for close, open in zip(closes, opens)]
                
                volume_chart = go.Bar(
                    x=dates,
                    y=volumes,
                    name='Volume',
                    marker_color=volume_colors,
                    opacity=0.7
                )
                fig.add_trace(volume_chart, row=2, col=1)
            
            # Contatori per zone
            demand_count = 0
            supply_count = 0
            
            # ===== SUPPORTI E RESISTENZE =====
            if include_analysis and data.get('support_resistance'):
                logger.info("Aggiungendo supporti e resistenze")
                for level in data['support_resistance']:
                    level_value = level.get('level')
                    if level_value is None:
                        continue
                        
                    color = '#28a745' if level.get('type') == 'Support' else '#dc3545'
                    
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
            
            # ===== ZONE SKORUPINSKI CON PREZZI CENTRALI =====
            zone_legend_data = []  # Per la leggenda interattiva
            
            if include_analysis and data.get('skorupinski_zones'):
                skorupinski_data = data['skorupinski_zones']
                
                logger.info("Aggiungendo zone Skorupinski con prezzi centrali")
                
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
                    
                    # Aggiorna contatori
                    demand_count = len(demand_zones)
                    supply_count = len(supply_zones)
                    
                    # Aggiungi zone di domanda con prezzi centrali
                    for i, zone in enumerate(demand_zones):
                        zone_bottom = zone.get('zone_bottom') or zone.get('bottom') or zone.get('low')
                        zone_top = zone.get('zone_top') or zone.get('top') or zone.get('high')
                        zone_center = zone.get('zone_center')
                        
                        # Calcola il centro se non disponibile
                        if zone_center is None and zone_bottom is not None and zone_top is not None:
                            zone_center = (zone_bottom + zone_top) / 2
                        
                        if zone_bottom is not None and zone_top is not None and zone_center is not None:
                            # Crea etichetta con prezzo centrale
                            zone_label = f"Demand ${zone_center:.2f}"
                            zone_id = f"demand_{i}"
                            
                            # Aggiungi dati per la leggenda
                            zone_legend_data.append({
                                'id': zone_id,
                                'type': 'Demand',
                                'center': zone_center,
                                'label': zone_label,
                                'visible': zone.get('visibility', True),
                                'color': 'rgba(40, 167, 69, 0.8)',
                                'strength': zone.get('strength_score', 0),
                                'distance': zone.get('distance_from_current', 0)
                            })
                            
                            if has_volume:
                                fig.add_hrect(
                                    y0=zone_bottom,
                                    y1=zone_top,
                                    fillcolor="rgba(40, 167, 69, 0.2)",
                                    line_color="rgba(40, 167, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=zone_label,
                                    annotation_position="top left",
                                    row=1, col=1,
                                    name=f"demand_zone_{i}"
                                )
                            else:
                                fig.add_hrect(
                                    y0=zone_bottom,
                                    y1=zone_top,
                                    fillcolor="rgba(40, 167, 69, 0.2)",
                                    line_color="rgba(40, 167, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=zone_label,
                                    annotation_position="top left",
                                    name=f"demand_zone_{i}"
                                )
                    
                    # Aggiungi zone di offerta con prezzi centrali
                    for i, zone in enumerate(supply_zones):
                        zone_bottom = zone.get('zone_bottom') or zone.get('bottom') or zone.get('low')
                        zone_top = zone.get('zone_top') or zone.get('top') or zone.get('high')
                        zone_center = zone.get('zone_center')
                        
                        # Calcola il centro se non disponibile
                        if zone_center is None and zone_bottom is not None and zone_top is not None:
                            zone_center = (zone_bottom + zone_top) / 2
                        
                        if zone_bottom is not None and zone_top is not None and zone_center is not None:
                            # Crea etichetta con prezzo centrale
                            zone_label = f"Supply ${zone_center:.2f}"
                            zone_id = f"supply_{i}"
                            
                            # Aggiungi dati per la leggenda
                            zone_legend_data.append({
                                'id': zone_id,
                                'type': 'Supply',
                                'center': zone_center,
                                'label': zone_label,
                                'visible': zone.get('visibility', True),
                                'color': 'rgba(220, 53, 69, 0.8)',
                                'strength': zone.get('strength_score', 0),
                                'distance': zone.get('distance_from_current', 0)
                            })
                            
                            if has_volume:
                                fig.add_hrect(
                                    y0=zone_bottom,
                                    y1=zone_top,
                                    fillcolor="rgba(220, 53, 69, 0.2)",
                                    line_color="rgba(220, 53, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=zone_label,
                                    annotation_position="top left",
                                    row=1, col=1,
                                    name=f"supply_zone_{i}"
                                )
                            else:
                                fig.add_hrect(
                                    y0=zone_bottom,
                                    y1=zone_top,
                                    fillcolor="rgba(220, 53, 69, 0.2)",
                                    line_color="rgba(220, 53, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=zone_label,
                                    annotation_position="top left",
                                    name=f"supply_zone_{i}"
                                )
                    
                    logger.info(f"Zone aggiunte: {len(demand_zones)} demand, {len(supply_zones)} supply")
                    
                elif isinstance(skorupinski_data, dict):
                    # Formato: dizionario con demand_zones e supply_zones
                    logger.info("Processando zone Skorupinski (formato dizionario)")
                    
                    # Zone di domanda
                    if skorupinski_data.get('demand_zones'):
                        demand_count = len(skorupinski_data['demand_zones'])
                        for i, zone in enumerate(skorupinski_data['demand_zones']):
                            zone_center = zone.get('zone_center')
                            if zone_center is None:
                                zone_center = (zone['zone_bottom'] + zone['zone_top']) / 2
                            
                            zone_label = f"Demand ${zone_center:.2f}"
                            zone_id = f"demand_{i}"
                            
                            zone_legend_data.append({
                                'id': zone_id,
                                'type': 'Demand',
                                'center': zone_center,
                                'label': zone_label,
                                'visible': zone.get('visibility', True),
                                'color': 'rgba(40, 167, 69, 0.8)',
                                'strength': zone.get('strength_score', 0),
                                'distance': zone.get('distance_from_current', 0)
                            })
                            
                            if has_volume:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(40, 167, 69, 0.2)",
                                    line_color="rgba(40, 167, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=zone_label,
                                    annotation_position="top left",
                                    row=1, col=1,
                                    name=f"demand_zone_{i}"
                                )
                            else:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(40, 167, 69, 0.2)",
                                    line_color="rgba(40, 167, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=zone_label,
                                    annotation_position="top left",
                                    name=f"demand_zone_{i}"
                                )
                    
                    # Zone di offerta
                    if skorupinski_data.get('supply_zones'):
                        supply_count = len(skorupinski_data['supply_zones'])
                        for i, zone in enumerate(skorupinski_data['supply_zones']):
                            zone_center = zone.get('zone_center')
                            if zone_center is None:
                                zone_center = (zone['zone_bottom'] + zone['zone_top']) / 2
                            
                            zone_label = f"Supply ${zone_center:.2f}"
                            zone_id = f"supply_{i}"
                            
                            zone_legend_data.append({
                                'id': zone_id,
                                'type': 'Supply',
                                'center': zone_center,
                                'label': zone_label,
                                'visible': zone.get('visibility', True),
                                'color': 'rgba(220, 53, 69, 0.8)',
                                'strength': zone.get('strength_score', 0),
                                'distance': zone.get('distance_from_current', 0)
                            })
                            
                            if has_volume:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(220, 53, 69, 0.2)",
                                    line_color="rgba(220, 53, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=zone_label,
                                    annotation_position="top left",
                                    row=1, col=1,
                                    name=f"supply_zone_{i}"
                                )
                            else:
                                fig.add_hrect(
                                    y0=zone['zone_bottom'],
                                    y1=zone['zone_top'],
                                    fillcolor="rgba(220, 53, 69, 0.2)",
                                    line_color="rgba(220, 53, 69, 0.8)",
                                    line_width=1,
                                    annotation_text=zone_label,
                                    annotation_position="top left",
                                    name=f"supply_zone_{i}"
                                )
            
            # Configura layout
            fig.update_layout(
                title=f'{ticker} - Analisi Tecnica Completa',
                xaxis_title='Data',
                yaxis_title='Prezzo ($)',
                template='plotly_white',
                showlegend=True,
                legend=dict(
                    orientation="v",
                    yanchor="top",
                    y=0.99,
                    xanchor="left",
                    x=1.01
                ),
                hovermode='x unified'
            )
            
            # Rimuovi il range selector per chart più pulito
            fig.update_xaxes(rangeslider_visible=False)
            
            # Converti in JSON
            chart_json = fig.to_json()
            
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
                },
                # NUOVO: Aggiungi dati delle zone per la leggenda interattiva
                'zone_legend': zone_legend_data
            }
            
        except Exception as e:
            logger.error(f"Errore generazione grafico Plotly per {ticker}: {e}")
            import traceback
            logger.error(f"Traceback completo: {traceback.format_exc()}")
            raise
    
    def get_analysis_summary(self) -> Dict:
        """
        Ottiene un riassunto dell'analisi tecnica per tutti i ticker.
        
        Returns:
            Dict con statistiche di analisi
        """
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
                try:
                    sr_data = pd.read_csv(sr_file)
                    summary['support_resistance']['total_levels'] += len(sr_data)
                except Exception as e:
                    logger.error(f"Errore lettura file S&R per {ticker}: {e}")
        
        # Conta zone Skorupinski
        for ticker in tickers:
            sz_file = self.skorupinski_output_dir / f"{ticker}_SkorupinkiZones.csv"
            if sz_file.exists():
                summary['skorupinski_zones']['analyzed'] += 1
                try:
                    sz_data = pd.read_csv(sz_file)
                    summary['skorupinski_zones']['total_zones'] += len(sz_data)
                    summary['skorupinski_zones']['supply_zones'] += len(sz_data[sz_data['type'] == 'Supply'])
                    summary['skorupinski_zones']['demand_zones'] += len(sz_data[sz_data['type'] == 'Demand'])
                except Exception as e:
                    logger.error(f"Errore lettura file zone per {ticker}: {e}")
        
        return summary
    
    def get_all_support_resistance_levels(self) -> List[Dict]:
        """
        Ottiene tutti i livelli di supporto e resistenza.
        
        Returns:
            Lista di dizionari con i livelli
        """
        ticker_config = self._load_ticker_config()
        tickers = ticker_config.get('tickers', [])
        
        all_levels = []
        
        for ticker in tickers:
            sr_file = self.sr_output_dir / f"{ticker}_SR.csv"
            if sr_file.exists():
                try:
                    sr_data = pd.read_csv(sr_file)
                    sr_data['ticker'] = ticker  # Aggiungi ticker ai dati
                    all_levels.extend(sr_data.to_dict('records'))
                except Exception as e:
                    logger.error(f"Errore nel leggere file S&R per {ticker}: {e}")
        
        return all_levels
    
    def get_all_skorupinski_zones(self) -> List[Dict]:
        """
        Ottiene tutte le zone Skorupinski.
        
        Returns:
            Lista di dizionari con le zone
        """
        ticker_config = self._load_ticker_config()
        tickers = ticker_config.get('tickers', [])
        
        all_zones = []
        
        for ticker in tickers:
            sz_file = self.skorupinski_output_dir / f"{ticker}_SkorupinkiZones.csv"
            if sz_file.exists():
                try:
                    sz_data = pd.read_csv(sz_file)
                    sz_data['ticker'] = ticker  # Aggiungi ticker ai dati
                    all_zones.extend(sz_data.to_dict('records'))
                except Exception as e:
                    logger.error(f"Errore nel leggere file zone per {ticker}: {e}")
        
        return all_zones


# ===== FUNZIONI DI UTILITÀ =====

def get_technical_analysis_manager(base_dir='resources') -> TechnicalAnalysisManager:
    """
    Factory function per ottenere un'istanza del manager.
    
    Args:
        base_dir: directory base del progetto
        
    Returns:
        Istanza di TechnicalAnalysisManager
    """
    return TechnicalAnalysisManager(base_dir)


def run_complete_technical_analysis(base_dir='resources', use_adjusted=True) -> Dict:
    """
    Esegue un'analisi tecnica completa per tutti i ticker configurati.
    
    Args:
        base_dir: directory base del progetto
        use_adjusted: se usare dati adjusted o not adjusted
        
    Returns:
        Dict con risultati dell'analisi
    """
    manager = get_technical_analysis_manager(base_dir)
    return manager.run_full_analysis(use_adjusted)


# ===== MAIN PER TEST =====
if __name__ == "__main__":
    # Test del manager
    print("🧪 Test TechnicalAnalysisManager")
    
    manager = TechnicalAnalysisManager()
    
    # Test summary
    summary = manager.get_analysis_summary()
    print(f"📊 Summary: {summary}")
    
    # Test con ticker di esempio (se disponibile)
    ticker_config = manager._load_ticker_config()
    if ticker_config.get('tickers'):
        test_ticker = ticker_config['tickers'][0]
        print(f"\n📈 Test grafico per {test_ticker}")
        
        try:
            chart_data = manager.generate_plotly_chart(test_ticker, days=50)
            print(f"✅ Grafico generato per {test_ticker}")
            print(f"📊 Info: {chart_data.get('data_info', {})}")
            if 'zone_legend' in chart_data:
                print(f"🎯 Zone in leggenda: {len(chart_data['zone_legend'])}")
        except Exception as e:
            print(f"❌ Errore test grafico: {e}")
    
    print("✅ Test completato")