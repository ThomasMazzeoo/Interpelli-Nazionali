from datetime import datetime

def run(url_visti):
    risultati = []
    print("    Inizio scraping Regione Valle d'Aosta (Piattaforma Unica)...")

    oggi_iso = datetime.now().isoformat()
    link_ufficiale = "https://scuole.vda.it/interpelli"
    
    if link_ufficiale not in url_visti:
        risultato = {
            "regione": "Valle d'Aosta",
            "provincia": "Valle d'Aosta",
            "titolo": "Bacheca Ufficiale Supplenze Valle d'Aosta",
            "data": "", # Senza data per renderla permanente
            "permanente": True,
            "escludi_scoreboard": True, # Non influenza la classifica nazionale
            "cdc": ["DA VERIFICARE SUL SITO"],
            "url": link_ufficiale,
            "pdf_links": [],
            "form_links": [link_ufficiale],
            "data_rilevamento": oggi_iso
        }
        risultati.append(risultato)
        print("    🟢 AGGIUNTO: Piattaforma Unica (Valle d'Aosta) come bacheca permanente.")
    else:
        print("    ✅ Piattaforma Valle d'Aosta già presente nel database.")
        
    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
