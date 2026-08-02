import time
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import estrai_cdc

URL_BASE = "https://www.istruzionesavona.gov.it/pagine/interpelli-sv---as-2024-2025-2"

def run(url_visti):
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    print(f"📡 [LIGURIA] Connessione a Savona...")
    
    try:
        risposta = requests.get(URL_BASE, headers=headers, timeout=15)
        if risposta.status_code != 200: return []
            
        soup = BeautifulSoup(risposta.text, 'html.parser')
        tabella = soup.find('table')
        if not tabella: return []

        for riga in tabella.find_all('tr'):
            cols = riga.find_all(['td', 'th'])
            
            if len(cols) < 5: 
                continue 
            
            cdc_raw = cols[0].get_text(strip=True)
            
            # FILTRO ANTI-BUROCRAZIA: Salta i titoli e le righe legali (es. "Art. 13...")
            if 'CDC' in cdc_raw.upper() or 'ART.' in cdc_raw.upper(): 
                continue
                
            nome_scuola = cols[3].get_text(strip=True) if len(cols) > 3 else "Scuola"
            
            if not nome_scuola or 'DENOMINAZIONE' in nome_scuola.upper() or 'A.S.' in nome_scuola.upper():
                continue

            link_col = cols[-1]
            link_tag = link_col.find('a', href=True)
            testo_link = link_col.get_text(strip=True)
            
            cdc_per_link = cdc_raw.replace(' ', '_').replace('/', '-')
            id_univoco = f"{cdc_per_link}-{len(nuovi_interpelli)}"
            
            if link_tag:
                url_avviso = link_tag['href']
                if not url_avviso.startswith('http') and not url_avviso.startswith('mailto:'):
                    url_avviso = "https://www.istruzionesavona.gov.it" + url_avviso
                url_avviso += f"#{id_univoco}" 
            elif '@' in testo_link:
                url_avviso = f"mailto:{testo_link}?subject=Interpello {cdc_raw}"
            elif testo_link.lower().startswith('www.') or testo_link.lower().startswith('http'):
                url_avviso = (testo_link if testo_link.startswith('http') else 'https://' + testo_link) + f"#{id_univoco}"
            else:
                url_avviso = f"{URL_BASE}#no-link-{id_univoco}"
            
            if url_avviso in url_visti: 
                continue
            
            # SUPER RADAR PER LE DATE
            data_pulita = datetime.today().strftime('%Y-%m-%d')
            for cell in reversed(cols):
                testo_cella = cell.get_text(strip=True)
                match_dt = re.search(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4}|\d{2})', testo_cella)
                
                if match_dt:
                    giorno = match_dt.group(1).zfill(2)
                    mese = match_dt.group(2).zfill(2)
                    anno = match_dt.group(3)
                    
                    if len(anno) == 2:
                        anno = "20" + anno
                        
                    data_pulita = f"{anno}-{mese}-{giorno}"
                    break 
                    
            cdc_pulite = estrai_cdc(cdc_raw)
            
            print(f"    🎯 Trovato: {nome_scuola} (Data estratta: {data_pulita})")
            
            nuovi_interpelli.append({
                "regione": "Liguria", "provincia": "Savona", "titolo": nome_scuola,
                "data": data_pulita, "cdc": cdc_pulite, "url": url_avviso,
                "pdf_links": [url_avviso] if '.pdf' in url_avviso.lower() else [], 
                "form_links": [], "data_rilevamento": datetime.now().isoformat()
            })
            url_visti.add(url_avviso)
            
    except Exception as e: 
        print(f"  ❌ Errore critico su Savona: {e}")
        
    return nuovi_interpelli
