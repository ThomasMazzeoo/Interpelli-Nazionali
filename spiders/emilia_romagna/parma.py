import hashlib
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Parma (USR Emilia-Romagna - Interpelli)...")

    url_base = "https://pr.istruzioneer.gov.it/interpelli-docenti-2/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"    ⚠️ Errore USR Parma, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        tabella = soup.find('table')
        if not tabella:
            print("    ⚠️ Nessuna tabella interpelli trovata nella pagina.")
            return risultati

        righe = tabella.find_all('tr')
        # La prima riga e' l'header, la saltiamo. Limita alle prime 20 righe di dati
        for riga in righe[1:21]:
            cols = riga.find_all('td')
            if len(cols) < 5:
                continue

            # --- COLONNA 0: DATA ---
            data_raw = cols[0].get_text(strip=True)

            # --- COLONNA 1: SCUOLA ---
            scuola = cols[1].get_text(strip=True)

            # --- COLONNA 2: CDC ---
            cdc_raw = cols[2].get_text(strip=True)

            # --- COLONNA 3: TIPO POSTO ---
            tipo_posto = cols[3].get_text(strip=True)

            # --- COLONNA 4: LINK ---
            links_col = cols[4]
            a_tags = links_col.find_all('a', href=True)

            # Salta righe senza link (es. "Annullato")
            if not a_tags:
                continue

            url_principale = a_tags[0]['href']

            # Rileva PDF e form links
            pdf_links = []
            form_links = []
            for a in a_tags:
                href = a['href']
                if '.pdf' in href.lower() or '.docx' in href.lower():
                    pdf_links.append(href)
                elif any(f in href.lower() for f in ['google.com/forms', 'forms.gle', 'nuvola.madisoft', 'spaggiari', 'madinterpello', 'portaleargo']):
                    form_links.append(href)

            # --- CONVERSIONE DATA ---
            data_pulita = converti_data_italiana(data_raw)

            # --- ESTRAZIONE CDC ---
            cdc = estrai_cdc(cdc_raw)
            if not cdc and cdc_raw:
                cdc = [cdc_raw]

            # --- TITOLO ---
            titolo = f"{scuola} - {cdc_raw}"
            if tipo_posto:
                titolo += f" ({tipo_posto})"

            # URL univoco con hash (molte scuole condividono lo stesso link generico)
            hash_id = hashlib.md5(f"{data_raw}_{scuola}_{cdc_raw}".encode('utf-8')).hexdigest()[:10]
            url_univoco = f"{url_principale}#{hash_id}"

            if url_univoco in url_visti:
                continue

            risultato = {
                "regione": "Emilia-Romagna",
                "provincia": "Parma",
                "titolo": titolo,
                "data": data_pulita,
                "cdc": cdc,
                "url": url_univoco,
                "pdf_links": pdf_links,
                "form_links": form_links,
                "data_rilevamento": oggi_iso
            }
            risultati.append(risultato)
            url_visti.add(url_univoco)

    except Exception as e:
        print(f"    ⚠️ Errore durante lo scraping di Parma: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
