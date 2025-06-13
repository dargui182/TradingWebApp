#!/usr/bin/env python3
"""
Script per debuggare problemi con Yahoo Finance
"""

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import requests

def test_internet_connection():
    """Test connessione internet"""
    print("🌐 Test connessione internet...")
    try:
        response = requests.get('https://www.google.com', timeout=5)
        if response.status_code == 200:
            print("✅ Connessione internet OK")
            return True
        else:
            print(f"❌ Problema connessione: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Errore connessione: {e}")
        return False

def test_yahoo_finance_website():
    """Test accesso a Yahoo Finance"""
    print("\n📊 Test accesso Yahoo Finance...")
    try:
        response = requests.get('https://finance.yahoo.com', timeout=10)
        if response.status_code == 200:
            print("✅ Yahoo Finance raggiungibile")
            return True
        else:
            print(f"❌ Yahoo Finance non raggiungibile: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Errore accesso Yahoo Finance: {e}")
        return False

def test_yfinance_simple():
    """Test semplice yfinance"""
    print("\n🔍 Test semplice yfinance...")
    
    try:
        # Test con un ticker molto semplice
        ticker = yf.Ticker("AAPL")
        print(f"📈 Oggetto ticker creato per AAPL: {type(ticker)}")
        
        # Prova a ottenere info di base
        print("📋 Tentativo di ottenere info...")
        info = ticker.info
        print(f"📊 Info ottenute: {len(info)} campi")
        
        # Mostra alcuni campi importanti
        important_fields = ['longName', 'symbol', 'sector', 'country', 'currency']
        for field in important_fields:
            value = info.get(field, 'N/A')
            print(f"   {field}: {value}")
        
        return True
        
    except Exception as e:
        print(f"❌ Errore yfinance semplice: {e}")
        print(f"   Tipo errore: {type(e).__name__}")
        return False

def test_yfinance_history():
    """Test download storico"""
    print("\n📈 Test download dati storici...")
    
    try:
        ticker = yf.Ticker("AAPL")
        
        # Scarica ultimi 5 giorni
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        print(f"📅 Periodo: {start_date.strftime('%Y-%m-%d')} - {end_date.strftime('%Y-%m-%d')}")
        
        hist = ticker.history(start=start_date.strftime('%Y-%m-%d'), 
                             end=end_date.strftime('%Y-%m-%d'))
        
        if not hist.empty:
            print(f"✅ Dati scaricati: {len(hist)} righe")
            print(f"📊 Colonne: {list(hist.columns)}")
            print(f"📅 Primo record: {hist.index[0]}")
            print(f"📅 Ultimo record: {hist.index[-1]}")
            print(f"💰 Ultimo prezzo close: ${hist['Close'].iloc[-1]:.2f}")
            return True
        else:
            print("❌ Nessun dato storico ottenuto")
            return False
            
    except Exception as e:
        print(f"❌ Errore download storico: {e}")
        print(f"   Tipo errore: {type(e).__name__}")
        return False

def test_multiple_tickers():
    """Test con ticker multipli"""
    print("\n🔢 Test ticker multipli...")
    
    test_tickers = ['AAPL', 'MSFT', 'GOOGL', 'META', 'TSLA']
    
    for symbol in test_tickers:
        try:
            print(f"\n🔍 Testing {symbol}...")
            ticker = yf.Ticker(symbol)
            
            # Prova solo a ottenere il nome
            info = ticker.info
            name = info.get('longName', 'Nome non disponibile')
            sector = info.get('sector', 'N/A')
            
            if name and name != 'Nome non disponibile':
                print(f"✅ {symbol}: {name} ({sector})")
            else:
                print(f"⚠️  {symbol}: Info limitata - {info.keys()}")
                
        except Exception as e:
            print(f"❌ {symbol}: Errore - {e}")

def test_user_agent():
    """Test con User-Agent personalizzato"""
    print("\n🤖 Test con User-Agent personalizzato...")
    
    try:
        # Prova con headers personalizzati
        import yfinance as yf
        
        # Crea una sessione con headers
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        ticker = yf.Ticker("AAPL", session=session)
        info = ticker.info
        
        name = info.get('longName', 'N/A')
        print(f"✅ Con User-Agent: AAPL = {name}")
        return True
        
    except Exception as e:
        print(f"❌ Errore con User-Agent: {e}")
        return False

def test_alternative_method():
    """Test metodo alternativo per ottenere dati"""
    print("\n🔧 Test metodo alternativo...")
    
    try:
        # Usa yfinance.download invece di Ticker
        data = yf.download("AAPL", period="1mo", progress=False)
        
        if not data.empty:
            print(f"✅ yf.download funziona: {len(data)} righe")
            print(f"💰 Ultimo close: ${data['Close'].iloc[-1]:.2f}")
            return True
        else:
            print("❌ yf.download non ha restituito dati")
            return False
            
    except Exception as e:
        print(f"❌ Errore yf.download: {e}")
        return False

def main():
    """Esegue tutti i test"""
    print("🚀 DIAGNOSI YAHOO FINANCE")
    print("=" * 50)
    
    tests = [
        ("Connessione Internet", test_internet_connection),
        ("Accesso Yahoo Finance", test_yahoo_finance_website),
        ("yfinance Semplice", test_yfinance_simple),
        ("Download Storico", test_yfinance_history),
        ("Ticker Multipli", test_multiple_tickers),
        ("User-Agent Personalizzato", test_user_agent),
        ("Metodo Alternativo", test_alternative_method)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            print(f"\n{'='*20} {test_name} {'='*20}")
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ ERRORE FATALE in {test_name}: {e}")
            results.append((test_name, False))
    
    # Riepilogo
    print("\n" + "=" * 50)
    print("📋 RIEPILOGO DIAGNOSI")
    print("=" * 50)
    
    for test_name, result in results:
        status = "✅ OK" if result else "❌ ERRORE"
        print(f"{status} - {test_name}")
    
    # Suggerimenti
    print("\n💡 SUGGERIMENTI:")
    
    passed_tests = sum(1 for _, result in results if result)
    total_tests = len(results)
    
    if passed_tests == 0:
        print("🔥 PROBLEMA GRAVE: Nessun test passato")
        print("   - Controlla la connessione internet")
        print("   - Controlla firewall/proxy aziendale")
        print("   - Prova da una rete diversa")
        
    elif passed_tests < total_tests // 2:
        print("⚠️  PROBLEMI PARZIALI: Yahoo Finance potrebbe essere limitato")
        print("   - Prova ad aggiornare yfinance: pip install --upgrade yfinance")
        print("   - Controlla se sei dietro un proxy aziendale")
        print("   - Yahoo Finance potrebbe aver cambiato API")
        
    else:
        print("🎯 PROBLEMI MINORI: La maggior parte funziona")
        print("   - Alcuni ticker potrebbero avere simboli diversi")
        print("   - Prova con ticker alternativi")

if __name__ == "__main__":
    main()