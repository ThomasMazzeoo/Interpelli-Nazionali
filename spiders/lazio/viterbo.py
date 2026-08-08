import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urljoin
from utils.helpers import converti_data_italiana, estrai_cdc
import urllib3
import re

urllib3.disable_warnings()

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Viterbo (USR Lazio - Interpelli)...")

    url_base = "https://www.provveditoratostudiviterbo.it/DOCENTI/interpelli/INTERPELLIDOC.htm"
    # L'HTML è molto vecchio (Windows-1252 / ISO-8859-1 o similare), quindi è meglio impostare un timeout e un agent base
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15, verify=False)
        resp.encoding = 'windows-1252' # o utf-8, proviamo prima questo che è standard per siti vecchi italiani
        if resp.status_code != 200:
            print(f"    ❌ Errore USR Viterbo, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Gli avvisi sono in tabelle
        tables = soup.find_all('table')

        for table in tables[:25]:
            rows = table.find_all('tr')
            if len(rows) < 2:
                continue
                
            # Cerca la data nella prima riga
            riga_data = rows[0]
            font_data = riga_data.find('font')
            if not font_data:
                continue
                
            testo_data = font_data.get_text(strip=True)
            # Potrebbero esserci caratteri spuri, puliamo un po' (spazi extra)
            testo_data = re.sub(r'\s+', ' ', testo_data).strip()
            
            data_pulita = converti_data_italiana(testo_data)
            if not data_pulita:
                # Se non è una data, forse non è una tabella interpello
                continue
                
            # Cerca il link nella seconda riga
            riga_link = rows[1]
            a_tag = riga_link.find('a', href=True)
            if not a_tag:
                continue
                
            titolo = a_tag.get_text(strip=True)
            # Rimuove ritorni a capo nel titolo
            titolo = re.sub(r'\s+', ' ', titolo).strip()
            
            # Attenzione: i link potrebbero essere relativi
            url_interpello = urljoin(url_base, a_tag['href'])

            if url_interpello in url_visti:
                continue

            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Lazio",
                "provincia": "Viterbo",
                "titolo": titolo,
                "data": data_pulita,
                "cdc": cdc,
                "url": url_interpello,
                "pdf_links": [],
                "form_links": [],
                "data_rilevamento": oggi_iso
            }
            risultati.append(risultato)
            url_visti.add(url_interpello)

    except Exception as e:
        print(f"    ❌ Errore durante lo scraping di Viterbo: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
