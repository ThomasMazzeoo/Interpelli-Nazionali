import time
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

URL_BASE = "https://www.istruzionegenova.gov.it/pagine/interpelli-ge---as-2026-2027"

def run(url_visti):
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    print(f"📡 [LIGURIA] Connessione a Genova...")
    
    try:
        risposta = requests.get(URL_BASE, headers=headers, timeout=15)
        if risposta.status_code != 200: return []
            
        soup = BeautifulSoup(risposta.text, 'html.parser')
        tabella = soup.find('table')
        if not tabella: return []

        for riga in tabella.find_all('tr'):
            cols = riga.find_all(['td', 'th'])
            if len(cols) < 11: continue 
            
            cdc_raw = cols[0].get_text(strip=True)
            nome_scuola = cols[3].get_text(strip=True)
            
            if not nome_scuola or 'DENOMINAZIONE' in nome_scuola.upper() or 'A.S.' in nome_scuola.upper() or 'CDC' in cdc_raw.upper():
                continue

            codice_mecc = cols[2].get_text(strip=True)
            dal_raw = cols[4].get_text(strip=True).replace('/', '-').replace('.', '-')
            al_raw = cols[5].get_text(strip=True).replace('/', '-').replace('.', '-')
            dettaglio_ore = cols[7].get_text(strip=True).replace('\n', ' ')
            
            data_raw = cols[9].get_text(strip=True) 
            testo_link = cols[10].get_text(strip=True) 
            link_tag = cols[10].find('a', href=True)
            
            cdc_per_link = cdc_raw.replace(' ', '_').replace('/', '-')
            ore_per_link = dettaglio_ore.replace(' ', '_')
            id_univoco = f"{cdc_per_link}-{ore_per_link}-dal_{dal_raw}-al_{al_raw}"
            
            # =========================================================
            # LOGICA SMART LINK (Reindirizzamento Intelligente)
            # =========================================================
            if link_tag:
                url_avviso = link_tag['href']
                if not url_avviso.startswith('http') and not url_avviso.startswith('mailto:'):
                    url_avviso = "https://www.istruzionegenova.gov.it" + url_avviso
                    
                if url_avviso.startswith('http'):
                    u_low = url_avviso.lower()
                    # Se è un link "pigro" (solo dominio, senza PDF o portali), mandalo alla tabella USP!
                    if u_low.count('/') <= 3 and '?' not in u_low and not u_low.endswith('.pdf') and 'albo' not in u_low and 'interpell' not in u_low:
                        url_avviso = f"{URL_BASE}#tabella-usp-{id_univoco}"
                    else:
                        url_avviso += f"#{id_univoco}"
                        
            elif '@' in testo_link:
                # Precompila l'email!
                url_avviso = f"mailto:{testo_link}?subject=Interpello {cdc_raw} ({dettaglio_ore})"
                
            elif testo_link.lower().startswith('www.') or testo_link.lower().startswith('http'):
                base_link = testo_link if testo_link.startswith('http') else 'https://' + testo_link
                u_low = base_link.lower()
                # Se il testo incollato è un link "pigro" (es. WWW.SCUOLAGENOVA.IT), mandalo alla tabella USP!
                if u_low.count('/') <= 3 and '?' not in u_low and not u_low.endswith('.pdf') and 'albo' not in u_low and 'interpell' not in u_low:
                    url_avviso = f"{URL_BASE}#tabella-usp-{id_univoco}"
                else:
                    url_avviso = f"{base_link}#{id_univoco}"
            else:
                # Nessun link: mandalo alla tabella ufficiale
                url_avviso = f"{URL_BASE}#tabella-usp-{codice_mecc}-{id_univoco}"
            
            if url_avviso in url_visti: continue
            
            match_dt = re.search(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})', data_raw)
            data_pulita = f"{match_dt.group(3)}-{match_dt.group(2).zfill(2)}-{match_dt.group(1).zfill(2)}" if match_dt else converti_data_italiana(data_raw)
                
            cdc_pulite = estrai_cdc(cdc_raw)
            
            nuovi_interpelli.append({
                "regione": "Liguria", "provincia": "Genova", "titolo": nome_scuola,
                "data": data_pulita, "cdc": cdc_pulite, "url": url_avviso,
                "pdf_links": [url_avviso] if '.pdf' in url_avviso.lower() else [], 
                "form_links": [], "data_rilevamento": datetime.now().isoformat()
            })
            url_visti.add(url_avviso)
            
    except Exception as e: print(f"  ❌ Errore critico su Genova: {e}")
    return nuovi_interpelli
