from datetime import datetime

def run(url_visti):
    risultati = []
    print("    Inizio scraping Provincia di Bolzano (Piattaforma Autonoma MadLene)...")

    oggi_iso = datetime.now().isoformat()
    link_ufficiale = "https://www.madlene.it/it"
    
    # La provincia di Bolzano usa un portale autonomo dedicato per tutte le chiamate,
    # quindi restituiamo un singolo blocco permanente (bacheca) che reindirizzi i docenti.
    
    # Per evitare duplicati nel database se lo script viene eseguito più volte,
    # controlliamo se il link è già nei visti. In realtà, per le bacheche permanenti
    # potremmo anche saltare l'inserimento se esiste, ma siccome main.py li scarta 
    # solo se troppo vecchi o senza data (e permanente=True bypassa il controllo),
    # usiamo l'url ufficiale come ID univoco.
    if link_ufficiale not in url_visti:
        risultato = {
            "regione": "Trentino-Alto Adige",
            "provincia": "Bolzano",
            "titolo": "Piattaforma Autonoma Supplenze Alto Adige (MadLene)",
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
        print("    🟢 AGGIUNTO: Piattaforma MadLene (Bolzano) come bacheca permanente.")
    else:
        print("    ✅ Piattaforma MadLene già presente nel database.")
        
    return risultati

if __name__ == "__main__":
    res = run(set())
    for r in res:
        print(r)
