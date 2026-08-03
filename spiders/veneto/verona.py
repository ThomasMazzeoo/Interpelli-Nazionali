import time
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

# Inserisci l'URL corretto della pagina principale di Verona
URL_BASE = "https://verona.istruzioneveneto.gov.it/interpelli-as-2025-2026/" 

def run(url_visti):
    nuovi_interpelli = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    print("📡 [VENETO] Connessione a Verona (Modalità Semplificata)...")

    try:
        resp = requests.get(URL_BASE, headers=headers, timeout=15)
        if resp.status_code != 200: 
            return []
            
        soup = BeautifulSoup(resp.text, 'html.parser')

        # 1. Trova i "Bottononi" dei mesi (es. Interpelli Giugno 2026)
        link_mesi = []
        for a in soup.find_all('a', href=True):
            testo_a = a.get_text(strip=True).lower()
            if 'interpelli' in testo_a and re.search(r'202[4-9]', testo_a):
                if a['href'] not in [l['href'] for l in link_mesi]:
                    link_mesi.append(a)

        conteggio = 0
        
        # 2. Visita solo i primi 3 mesi (dal più recente) per non sovraccaricare il server
        for mese_tag in link_mesi[:3]: 
            url_mese = mese_tag['href']
            if not url_mese.startswith('http'):
                url_mese = "https://verona.istruzioneveneto.gov.it" + url_mese

            resp_mese = requests.get(url_mese, headers=headers, timeout=10)
            soup_mese = BeautifulSoup(resp_mese.text, 'html.parser')

            # 3. Trova le date specifiche puntate (es. 03/06/2026)
            for a in soup_mese.find_all('a', href=True):
                testo_link = a.get_text(strip=True)
                
                # Cerca una data nel formato gg/mm/aaaa
                match_data = re.search(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})', testo_link)

                if match_data:
                    url_file = a['href']
                    if not url_file.startswith('http'):
                        url_file = "https://verona.istruzioneveneto.gov.it" + url_file

                    if url_file in url_visti:
                        continue

                    giorno, mese_num, anno = match_data.groups()
                    data_pubblicazione_str = f"{anno}-{mese_num.zfill(2)}-{giorno.zfill(2)}"

                    # IL TRUCCO TEMPORALE: Aggiungiamo 3 giorni alla data di pubblicazione!
                    # Così non viene scartato dal frontend come "Scaduto" istantaneamente.
                    try:
                        data_pub_obj = datetime.strptime(data_pubblicazione_str, "%Y-%m-%d")
                        data_scadenza_obj = data_pub_obj + timedelta(days=3)
                        data_scadenza_str = data_scadenza_obj.strftime("%Y-%m-%d")
                    except:
                        data_scadenza_str = data_pubblicazione_str

                    # Titolo iper-chiaro per l'utente finale
                    titolo_finale = f"Avvisi Pubblicati il {giorno}/{mese_num}/{anno} (Apri per i dettagli)"

                    print(f"    🎯 Trovato Verona: {titolo_finale}")

                    nuovi_interpelli.append({
                        "regione": "Veneto",
                        "provincia": "Verona",
                        "titolo": titolo_finale,
                        "data": data_scadenza_str,
                        "cdc": ["TUTTE LE CLASSI"], # Badge generico
                        "url": url_file,
                        "pdf_links": [url_file] if '.pdf' in url_file.lower() else [],
                        "form_links": [],
                        "data_rilevamento": datetime.now().isoformat()
                    })

                    url_visti.add(url_file)
                    conteggio += 1

                    # Fermati appena arrivi a 20 per rispettare il limite imposto!
                    if conteggio >= 20:
                        break
            
            if conteggio >= 20:
                break

    except Exception as e:
        print(f"  ❌ Errore critico su Verona: {e}")

    return nuovi_interpelli
