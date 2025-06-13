#!/usr/bin/env python3
"""
Script di test per verificare il funzionamento del modulo Yahoo Finance
Esegui questo script prima di avviare l'app per verificare che tutto funzioni
"""

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import json
from pathlib import Path

def test_yfinance_connection():
    """Test connessione a Yahoo Finance"""
    print("🔍 Test connessione Yahoo Finance...")
    
    try:
        # Test con un ticker famoso
        ticker = yf.Ticker("AAPL")
        info = ticker.info
        
        print(f"✅ Connessione OK - Apple: {info.get('longName', 'N/A')}")
        return True
        
    except Exception as e:
        print(f"❌ Errore connessione: {e}")
        return False

def test_data_download():
    """Test download dati"""
    print("\n📥 Test download dati...")
    
    try:
        ticker = yf.Ticker("AAPL")
        
        # Scarica ultimi 5 giorni
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        data = ticker.history(start=start_date.strftime("%Y-%m-%d"), 
                             end=end_date.strftime("%Y-%m-%d"))
        
        if not data.empty:
            print(f"✅ Download OK - {len(data)} record scaricati")
            print(f"   Periodo: {data.index[0].strftime('%Y-%m-%d')} - {data.index[-1].strftime('%Y-%m-%d')}")
            print(f"   Ultimo close: ${data['Close'].iloc[-1]:.2f}")
            return True
        else:
            print("❌ Nessun dato scaricato")
            return False
            
    except Exception as e:
        print(f"❌ Errore download: {e}")
        return False

def test_ticker_info():
    """Test recupero informazioni ticker"""
    print("\n📊 Test informazioni ticker...")
    
    test_tickers = ["AAPL", "MSFT", "GOOGL", "INVALID_TICKER"]
    
    for symbol in test_tickers:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            if 'longName' in info:
                print(f"✅ {symbol}: {info['longName']} ({info.get('sector', 'N/A')})")
            else:
                print(f"❌ {symbol}: Ticker non valido")
                
        except Exception as e:
            print(f"❌ {symbol}: Errore - {e}")

def test_directory_creation():
    """Test creazione directory"""
    print("\n📁 Test creazione directory...")
    
    directories = [
        Path('resources/config'),
        Path('resources/data/daily'),
        Path('resources/meta')
    ]
    
    for directory in directories:
        try:
            directory.mkdir(parents=True, exist_ok=True)
            print(f"✅ Directory creata: {directory}")
        except Exception as e:
            print(f"❌ Errore creazione {directory}: {e}")
            return False
    
    return True

def test_json_operations():
    """Test operazioni JSON"""
    print("\n💾 Test operazioni JSON...")
    
    try:
        # Test config ticker
        config_file = Path('resources/config/tickers.json')
        test_config = {
            'tickers': ['AAPL', 'MSFT'],
            'last_updated': datetime.now().isoformat()
        }
        
        with open(config_file, 'w') as f:
            json.dump(test_config, f, indent=2)
        
        with open(config_file, 'r') as f:
            loaded_config = json.load(f)
        
        if loaded_config['tickers'] == test_config['tickers']:
            print("✅ JSON config OK")
        else:
            print("❌ Errore JSON config")
            return False
        
        # Test meta ticker
        meta_file = Path('resources/meta/AAPL.json')
        test_meta = {
            'ticker': 'AAPL',
            'last_close_date': '2025-06-11',
            'total_records': 100,
            'last_updated': datetime.now().isoformat()
        }
        
        with open(meta_file, 'w') as f:
            json.dump(test_meta, f, indent=2)
        
        print("✅ JSON meta OK")
        return True
        
    except Exception as e:
        print(f"❌ Errore JSON: {e}")
        return False

def test_csv_operations():
    """Test operazioni CSV"""
    print("\n📄 Test operazioni CSV...")
    
    try:
        # Crea un CSV di test
        csv_file = Path('resources/data/daily/TEST.csv')
        
        test_data = pd.DataFrame({
            'Date': ['2025-06-10', '2025-06-11'],
            'Open': [100.0, 101.0],
            'High': [102.0, 103.0],
            'Low': [99.0, 100.5],
            'Close': [101.5, 102.5],
            'Adj Close': [101.5, 102.5],
            'Volume': [1000000, 1200000]
        })
        
        # Salva CSV
        test_data.to_csv(csv_file, index=False)
        
        # Rileggi CSV
        loaded_data = pd.read_csv(csv_file)
        
        if len(loaded_data) == 2 and 'Date' in loaded_data.columns:
            print("✅ CSV operations OK")
            
            # Test append
            new_data = pd.DataFrame({
                'Date': ['2025-06-12'],
                'Open': [102.0],
                'High': [104.0],
                'Low': [101.5],
                'Close': [103.0],
                'Adj Close': [103.0],
                'Volume': [1100000]
            })
            
            new_data.to_csv(csv_file, mode='a', header=False, index=False)
            
            final_data = pd.read_csv(csv_file)
            if len(final_data) == 3:
                print("✅ CSV append OK")
                return True
            else:
                print(f"❌ CSV append failed - Expected 3 rows, got {len(final_data)}")
                return False
        else:
            print("❌ CSV read failed")
            return False
            
    except Exception as e:
        print(f"❌ Errore CSV: {e}")
        return False

def cleanup_test_files():
    """Pulisci file di test"""
    print("\n🧹 Pulizia file di test...")
    
    test_files = [
        Path('resources/config/tickers.json'),
        Path('resources/meta/AAPL.json'),
        Path('resources/data/daily/TEST.csv')
    ]
    
    for file_path in test_files:
        if file_path.exists():
            file_path.unlink()
            print(f"✅ Rimosso: {file_path}")

def main():
    """Esegue tutti i test"""
    print("🚀 Avvio test modulo Yahoo Finance Dashboard")
    print("=" * 50)
    
    tests = [
        ("Connessione Yahoo Finance", test_yfinance_connection),
        ("Download dati", test_data_download), 
        ("Informazioni ticker", test_ticker_info),
        ("Creazione directory", test_directory_creation),
        ("Operazioni JSON", test_json_operations),
        ("Operazioni CSV", test_csv_operations)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Errore durante {test_name}: {e}")
            results.append((test_name, False))
    
    # Pulizia
    cleanup_test_files()
    
    # Riepilogo
    print("\n" + "=" * 50)
    print("📋 RIEPILOGO TEST")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 Risultato: {passed}/{total} test passati")
    
    if passed == total:
        print("🎉 Tutti i test sono passati! L'app è pronta per l'uso.")
        return True
    else:
        print("⚠️  Alcuni test sono falliti. Controlla le dipendenze e la connessione internet.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)