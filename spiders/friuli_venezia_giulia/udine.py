from datetime import datetime

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Udine (USR FVG - Bacheca Interpelli)...")

    oggi_iso = datetime.now().isoformat()
    link_ufficiale = "https://usrfvg.gov.it/it/home/menu/uffici/ufficio-territoriale-di-udine/Interpelli/index.html"
    
    if link_ufficiale not in url_visti:
        risultato = {
            "regione": "Friuli Venezia Giulia",
            "provincia": "Udine",
            "titolo": "Bacheca Ufficiale Interpelli Provincia di Udine (USR FVG)",
            "data": "", # Senza data per renderla permanente
            "permanente": True,
            "escludi_scoreboard": True, # Non influenza la classifica nazionale (essendo un contenitore generico)
            "cdc": ["DA VERIFICARE SUL SITO"],
            "url": link_ufficiale,
            "pdf_links": [],
            "form_links": [link_ufficiale],
            "data_rilevamento": oggi_iso
        }
        risultati.append(risultato)
        print("    🟢 AGGIUNTO: Bacheca Interpelli Udine (USR FVG) come bacheca permanente.")
    else:
        print("    ✅ Bacheca Interpelli Udine già presente nel database.")
        
    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
