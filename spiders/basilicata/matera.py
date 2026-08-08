import requests
from bs4 import BeautifulSoup
from datetime import datetime
from utils.helpers import converti_data_italiana, estrai_cdc

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Matera (Istruzione Matera - Interpelli)...")

    url_base = "https://www.istruzionematera.it/category/interpelli/"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    oggi_iso = datetime.now().isoformat()

    try:
        resp = requests.get(url_base, headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"    ⚠️ Errore Istruzione Matera, status code: {resp.status_code}")
            return risultati

        soup = BeautifulSoup(resp.text, 'html.parser')

        # Ogni interpello e' un <div class="news">
        news_divs = soup.find_all('div', class_='news')

        for news in news_divs[:20]:
            h4_tag = news.find('h4')
            if not h4_tag:
                continue

            # Il formato dell'h4 e': "13 Maggio 2026 - <a href="...">TITOLO</a>"
            a_tag = h4_tag.find('a', href=True)
            if not a_tag:
                continue

            titolo = a_tag.get_text(strip=True)
            url_interpello = a_tag['href']

            # Salta se gia' visto
            if url_interpello in url_visti:
                continue

            # Estrai la data dal testo dell'h4 prima del link
            # Il testo completo dell'h4 contiene "DATA - TITOLO"
            h4_text = h4_tag.get_text(strip=True)
            data_raw = ""
            # La data e' la parte prima del " - " che precede il titolo
            # Usiamo il testo prima del primo link
            for content in h4_tag.children:
                if isinstance(content, str):
                    # Questo e' il testo prima del link, es. "13 Maggio 2026 - "
                    data_raw = content.strip().rstrip('-').strip()
                    break

            # --- CONVERSIONE DATA ---
            data_pulita = converti_data_italiana(data_raw)

            # --- ESTRAZIONE CDC DAL TITOLO ---
            cdc = estrai_cdc(titolo)

            risultato = {
                "regione": "Basilicata",
                "provincia": "Matera",
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
        print(f"    ⚠️ Errore durante lo scraping di Matera: {e}")

    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
