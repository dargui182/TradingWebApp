from datetime import datetime, timedelta
import calendar

class SmartStatusPython:
    """Implementazione Python della logica SmartStatus per consistenza"""
    
    def __init__(self):
        pass
    
    def is_market_day(self, date):
        """Verifica se una data è un giorno di mercato (Lun-Ven, esclude weekend)"""
        day = date.weekday()  # 0=Lunedì, 6=Domenica
        
        # Sabato=5, Domenica=6
        if day >= 5:
            return False
        
        # Aggiungi festività se necessario
        holidays = self.get_market_holidays(date.year)
        date_str = date.strftime('%Y-%m-%d')
        
        if date_str in holidays:
            return False
        
        return True
    
    def get_market_holidays(self, year):
        """Ottiene le principali festività del mercato USA per un anno"""
        return [
            f"{year}-01-01",  # New Year's Day
            f"{year}-07-04",  # Independence Day  
            f"{year}-12-25",  # Christmas Day
            # Aggiungi altre festività se necessario
        ]
    
    def get_last_expected_market_day(self):
        """Calcola l'ultimo giorno di mercato atteso"""
        now = datetime.now()
        current_hour = now.hour
        
        # Il mercato USA chiude alle 22:00 ora italiana (16:00 EST + 6 ore)
        # Se è dopo le 22:00 e oggi è un giorno di mercato, i dati di oggi potrebbero essere disponibili
        if current_hour >= 22 and self.is_market_day(now):
            return now
        
        # Altrimenti cerca l'ultimo giorno di mercato precedente
        check_date = now - timedelta(days=1)
        
        attempts = 0
        while not self.is_market_day(check_date) and attempts < 10:
            check_date -= timedelta(days=1)
            attempts += 1
        
        return check_date
    
    def calculate_smart_status(self, last_data_date_str):
        """
        Calcola lo status intelligente basato sull'ultimo dato disponibile
        Replica ESATTAMENTE la logica JavaScript
        """
        if not last_data_date_str or last_data_date_str == 'N/A':
            return {
                'needs_update': True,
                'status_text': '❌ Nessun dato',
                'tooltip': 'Nessun dato disponibile'
            }
        
        try:
            # Parsing flessibile della data (stesso del JS)
            if '/' in last_data_date_str:
                # Formato DD/MM/YYYY (italiano)
                parts = last_data_date_str.split('/')
                last_data_date = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
            elif '-' in last_data_date_str:
                # Formato YYYY-MM-DD (ISO)
                last_data_date = datetime.strptime(last_data_date_str, '%Y-%m-%d')
            else:
                raise ValueError('Formato data non riconosciuto')
            
            last_expected_day = self.get_last_expected_market_day()
            
            # Confronta solo le date (ignora l'ora)
            last_data_date_only = last_data_date.replace(hour=0, minute=0, second=0, microsecond=0)
            last_expected_day_only = last_expected_day.replace(hour=0, minute=0, second=0, microsecond=0)
            
            diff_days = (last_expected_day_only - last_data_date_only).days
            
            # Calcola quanti giorni di mercato sono passati
            market_days_diff = 0
            check_date = last_data_date_only + timedelta(days=1)
            
            while check_date <= last_expected_day_only and market_days_diff < 10:
                if self.is_market_day(check_date):
                    market_days_diff += 1
                check_date += timedelta(days=1)
            
            last_data_formatted = last_data_date.strftime('%d/%m/%Y')
            last_expected_formatted = last_expected_day.strftime('%d/%m/%Y')
            
            if diff_days <= 0:
                # Dati aggiornati
                return {
                    'needs_update': False,
                    'status_text': '✅ Aggiornato',
                    'tooltip': f'Ultimo dato: {last_data_formatted} (aggiornato)'
                }
            elif market_days_diff == 1:
                # Manca 1 giorno di mercato
                return {
                    'needs_update': True,
                    'status_text': '⏰ 1 giorno',
                    'tooltip': f'Ultimo dato: {last_data_formatted}\nAtteso: {last_expected_formatted}'
                }
            elif market_days_diff <= 3:
                # Mancano pochi giorni di mercato
                return {
                    'needs_update': True,
                    'status_text': f'⏰ {market_days_diff} giorni',
                    'tooltip': f'Ultimo dato: {last_data_formatted}\nAtteso: {last_expected_formatted}\n{market_days_diff} giorni di mercato mancanti'
                }
            else:
                # Molto in ritardo
                return {
                    'needs_update': True,
                    'status_text': f'❌ {market_days_diff} giorni',
                    'tooltip': f'Ultimo dato: {last_data_formatted}\nAtteso: {last_expected_formatted}\n{market_days_diff} giorni di mercato mancanti'
                }
                
        except Exception as error:
            logger.warning(f"Errore parsing data: {last_data_date_str}, errore: {error}")
            return {
                'needs_update': True,
                'status_text': '⚠️ Errore data',
                'tooltip': f'Errore nel parsing della data: {last_data_date_str}'
            }

# ✅ CREA istanza globale
smart_status = SmartStatusPython()