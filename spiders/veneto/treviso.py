import time
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime, timedelta


URL_BASE = "https://treviso.istruzioneveneto.gov.it/tabella-avvisi-finalizzati-al-reclutamento-docenti-om-88-2024-art-13-comma-23/"

def run(url_visti):
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    print("📡 [VENETO] Connessione a Treviso (Elenco Scuole)...")
    
    try:
        resp = requests.get(URL_BASE, headers=headers, timeout=15)
        if resp.status_code != 200: 
            return []
            
        soup = BeautifulSoup(resp.text, 'html.parser')
        tabella = soup.find('table')
        if not tabella: return []

        righe = tabella.find_all('tr')
        if len(righe) < 2: return []
        
        # 1. AUTO-MAPPATURA DELLE COLONNE
        idx_scuola = 1
        idx_link = 2
        
        start_row = 1
        for i, riga in enumerate(righe):
            text = riga.get_text(strip=True).lower()
            if 'denominazione' in text:
                intestazioni = [th.get_text(strip=True).lower() for th in riga.find_all(['th', 'td'])]
                for j, s in enumerate(intestazioni):
                    s_clean = s.replace('\xa0', ' ').strip()
                    if 'denominazione' in s_clean: idx_scuola = j
                    elif 'link' in s_clean or 'sezione' in s_clean: idx_link = j
                start_row = i + 1
                break
                
        conteggio = 0
        
        # 2. ESTRAZIONE DELLE PRIME 20 SCUOLE
        for riga in righe[start_row:]:
            cols = riga.find_all(['td', 'th'])
            
            # Se la riga è troppo corta, salta
            if len(cols) <= max(idx_scuola, idx_link): continue
            
            nome_scuola = cols[idx_scuola].get_text(separator=' ', strip=True)
            if not nome_scuola or 'DENOMINAZIONE' in nome_scuola.upper(): continue
            
            # Cerca il link nella colonna giusta
            link_tag = cols[idx_link].find('a', href=True)
            
            # Fallback: a volte le segreterie sbagliano e mettono il link solo nel codice meccanografico
            if not link_tag:
                link_tag = cols[0].find('a', href=True)
                
            if not link_tag: continue
            
            url_avviso = link_tag['href']
            
            # Trucco della Data Mobile: oggi + 3 giorni, così non scade mai sulla mappa!
            data_scadenza = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
            
            # Aggiungiamo un tag per far capire all'utente che è il sito della scuola
            titolo_finale = f"{nome_scuola} (Bacheca Ufficiale dell'Istituto)"
            
            # Se abbiamo già processato questo link in questa run, saltiamo
            if url_avviso in url_visti:
                continue
                
            print(f"    🎯 Trovato Treviso: {nome_scuola}")
            
            nuovi_interpelli.append({
                "regione": "Veneto",
                "provincia": "Treviso",
                "titolo": titolo_finale,
                "data": data_scadenza,
                # Inseriamo un badge palese al posto della Classe di Concorso
                "cdc": ["DA VERIFICARE SUL SITO"], 
                "url": url_avviso,
                "pdf_links": [],
                "form_links": [],
                "data_rilevamento": datetime.now().isoformat()
            })
            
            url_visti.add(url_avviso)
            conteggio += 1
            
            # Ci fermiamo esattamente a 20 come richiesto
            if conteggio >= 20:
                break
                
    except Exception as e:
        print(f"  ❌ Errore critico su Treviso: {e}")
        
    return nuovi_interpelli
