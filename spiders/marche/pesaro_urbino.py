import requests
import urllib3
from bs4 import BeautifulSoup
from datetime import datetime
import re
from utils.helpers import estrai_cdc

urllib3.disable_warnings()

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Pesaro Urbino (USR Marche - Interpelli)...")

    url_base = "https://www.usppesarourbino.it/category/interpelli/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15, verify=False)
        if resp.status_code != 200:
            print(f"    ⚠️ Errore USR Pesaro Urbino, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        articoli = soup.find_all('article', class_='post')

        for articolo in articoli[:5]:
            h2_tag = articolo.find('h2', class_='entry-title')
            if not h2_tag:
                continue

            a_tag = h2_tag.find('a', href=True)
            if not a_tag:
                continue

            url_articolo = a_tag['href']
            
            time_tag = articolo.find('time')
            data_articolo = datetime.now().strftime("%Y-%m-%d")
            if time_tag and time_tag.has_attr('datetime'):
                data_articolo = time_tag['datetime'].split('T')[0]
            
            # Fetch the actual article page
            resp_art = requests.get(url_articolo, headers=headers, timeout=15, verify=False)
            if resp_art.status_code != 200:
                continue
                
            soup_art = BeautifulSoup(resp_art.text, 'html.parser')
            entry_content = soup_art.find('div', class_='entry-content')
            if not entry_content:
                continue
                
            paragrafi = entry_content.find_all('p')
            
            for p in paragrafi:
                link_tag = p.find('a', href=True)
                if not link_tag:
                    continue
                    
                titolo_interpello = p.get_text(strip=True)
                if len(titolo_interpello) < 10:
                    continue
                    
                url_interpello = link_tag['href']
                
                if url_interpello in url_visti:
                    continue
                    
                # We try to extract date from the PDF URL (e.g. /2026/05/)
                data_pulita = data_articolo
                match_data = re.search(r'/(\d{4})/(\d{2})/', url_interpello)
                if match_data:
                    anno = match_data.group(1)
                    mese = match_data.group(2)
                    if anno == data_articolo[:4] and mese == data_articolo[5:7]:
                        data_pulita = data_articolo
                    else:
                        data_pulita = f"{anno}-{mese}-01"

                cdc = estrai_cdc(titolo_interpello)

                risultato = {
                    "regione": "Marche",
                    "provincia": "Pesaro Urbino",
                    "titolo": titolo_interpello,
                    "data": data_pulita,
                    "cdc": cdc,
                    "url": url_interpello,
                    "pdf_links": [],
                    "form_links": [],
                    "data_rilevamento": oggi_iso
                }
                
                # Find other links in the same paragraph (e.g. Google forms)
                tutti_link = p.find_all('a', href=True)
                for l in tutti_link:
                    hr = l['href']
                    if 'forms' in hr or 'docs.google.com' in hr:
                        risultato['form_links'].append(hr)
                        
                risultati.append(risultato)
                url_visti.add(url_interpello)
                
                if len(risultati) >= 30:
                    return risultati

    except Exception as e:
        print(f"    ⚠️ Errore durante lo scraping di Pesaro Urbino: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
