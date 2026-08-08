# Interpello Nazionale

Una piattaforma automatizzata per aggregare, filtrare e visualizzare le chiamate di supplenza (Interpelli) emesse dagli Uffici Scolastici Regionali (USR) e dagli Ambiti Territoriali (ATP) in Italia, secondo le direttive dell'O.M. 88/2024.

## Funzionalità

- **Scraping Automatico (Spider):** Script in Python (BeautifulSoup) che estraggono giornalmente i bandi dai vari siti istituzionali (USR, ATP).
- **Mappa Interattiva:** Frontend basato su HTML, Tailwind CSS, Leaflet.js e JavaScript vanilla, che permette ai docenti di filtrare gli interpelli cliccando direttamente sulla cartina dell'Italia o utilizzando filtri mirati (Regione, Provincia, Classe di Concorso).
- **Classifica Nazionale (Scoreboard):** Mostra un ranking in tempo reale delle regioni con più cattedre scoperte, guidando visivamente l'utente.
- **Supporto Mobile:** Layout completamente responsive, ottimizzato sia per desktop (sidebar) sia per dispositivi mobili (visualizzazione "Bottom Sheet").
- **Database JSON Statico:** I dati estratti dagli spider vengono salvati in `database_nazionale.json`, che funge da "database serverless" leggerissimo per il frontend, rendendo il progetto ideale per il deployment su GitHub Pages o su altri servizi di hosting statico.
- **Sitemap & SEO:** Lo script `main.py` genera automaticamente la `sitemap.xml` aggiornata quotidianamente per agevolare l'indicizzazione su Google.

## Struttura del Progetto

- `index.html`: La dashboard dell'interfaccia utente.
- `app.js` e `style.css`: Logica frontend (filtri, mappa) e stilizzazione.
- `main.py`: Orchestratore Python che lancia in serie tutti gli spider regionali.
- `spiders/`: Cartella che raggruppa tutti gli estrattori, suddivisi per regione/provincia.
- `utils/helpers.py`: Funzioni condivise per gli spider (es. normalizzazione date, estrazione Classe di Concorso dal testo).
- `database_nazionale.json`: Il cuore dei dati (output degli spider e input della UI).

## Come installare e avviare

### 1. Installazione Dipendenze (per il backend scraping)
Assicurati di avere Python 3.9+ installato. Crea un ambiente virtuale e installa i requirements:
```bash
python -m venv venv
venv\Scripts\activate      # Su Windows
# source venv/bin/activate # Su Mac/Linux
pip install -r requirements.txt
```

### 2. Aggiornamento Database (Esecuzione Spiders)
Per avviare l'estrattore e aggiornare il file `database_nazionale.json`:
```bash
python main.py
```
Questo comando farà partire tutti gli spider configurati e appenderà/aggiornerà i nuovi interpelli.

### 3. Avvio Frontend in Locale
Essendo un sito statico, basta lanciare un server HTTP dalla radice del progetto:
```bash
python -m http.server 8000
```
Ora visita `http://localhost:8000` dal tuo browser.

## Deployment (GitHub Pages)

Questo progetto è strutturato per essere facilmente ospitato tramite **GitHub Pages**:
1. Crea un nuovo repository su GitHub.
2. Fai il push di tutto il codice (`git add .`, `git commit`, `git push`).
3. Dalle impostazioni del repository, vai su **Pages** e abilita il deployment dal branch `main` (o `master`).
4. (Opzionale) Puoi impostare un **GitHub Action** (cron job) che esegua `python main.py` ogni notte, per aggiornare in totale autonomia il file `database_nazionale.json` e fare automaticamente il push sul repository, offrendo un sito auto-aggiornante a costo zero!