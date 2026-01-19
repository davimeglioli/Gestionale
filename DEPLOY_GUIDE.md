# Guida al Deploy su Render

## Ottimizzazioni Applicate

✅ **app.py**
- Aggiunto logging per monitoraggio in produzione
- Port dinamico da variabile `PORT` (richiesto da Render)
- Host cambiato a `0.0.0.0` per accettare connessioni esterne
- Debug mode automatico basato su `FLASK_ENV`
- SECRET_KEY da variabile d'ambiente

✅ **requirements.txt**
- Aggiunto `python-dotenv` per file .env

✅ **render.yaml**
- Python 3.12 specificato
- 4 worker processes (da 2 a 4) per migliore performance
- Timeout aumentato a 120 secondi
- Logging abilitato (`--access-logfile` e `--error-logfile`)
- Variabili d'ambiente configurate
- Max instances impostato a 3

✅ **File di Configurazione**
- `Procfile`: Per alternative (Heroku, Railway, etc.)
- `runtime.txt`: Specifica Python 3.12.1
- `.env.example`: Template per variabili d'ambiente
- `.gitignore`: Esclude file sensibili e cache

---

## Come Fare il Deploy su Render

### Passo 1: Prepara il Repository
```bash
git add .
git commit -m "Optimize code for Render deployment"
git push origin main
```

### Passo 2: Crea un Account su Render
1. Vai su https://render.com
2. Registrati con GitHub (consigliato)
3. Autorizza Render ad accedere ai tuoi repository

### Passo 3: Configura le Variabili d'Ambiente
**Importante**: Prima di creare il servizio, prepara le variabili:

1. Apri un terminale locale
2. Genera una SECRET_KEY sicura:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```
3. Copia il risultato

### Passo 4: Crea il Servizio su Render
1. Nel dashboard Render, clicca **New +**
2. Seleziona **Web Service**
3. Collega il tuo repository GitHub
4. Compila i dettagli:
   - **Name**: `gestionale-preventivi`
   - **Root Directory**: (lascia vuoto)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: 
   ```
   gunicorn -w 4 -b 0.0.0.0:$PORT --timeout 120 --access-logfile - --error-logfile - app:app
   ```

5. Scendi a **Environment**
6. Aggiungi queste variabili:
   - `SECRET_KEY`: (incolla il valore generato)
   - `FLASK_ENV`: `production`
   - `PYTHONUNBUFFERED`: `1`

7. Clicca **Create Web Service**

### Passo 5: Monitora il Deploy
1. Guarda i log in tempo reale nella pagina del servizio
2. Aspetta che lo stato diventi **Live** (5-10 minuti)
3. Clicca il link per visitare l'app

---

## Alternativa: Deploy da File render.yaml

Se il tuo repository ha `render.yaml` (che ora hai):

1. Su Render Dashboard: **New** → **Web Service**
2. Seleziona il repo
3. Spunta **Use render.yaml**
4. Clicca **Create**

Render leggerà automaticamente `render.yaml` per la configurazione!

---

## Database SQLite su Render

⚠️ **Importante**: SQLite non è ideale per Render in produzione perché:
- Il filesystem è ephemeral (si resetta ogni deploy)
- I dati vengono persi

### Soluzioni:

**Opzione A: Backup Regolari (Rapido)**
```python
# Aggiungi a app.py per backup settimanale
import shutil
from datetime import datetime

def backup_db():
    backup_path = f"quotes_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    shutil.copy(DB_PATH, backup_path)
```

**Opzione B: Usare PostgreSQL (Consigliato)**
1. Aggiungi un PostgreSQL su Render (gratis con limiti)
2. Installa `psycopg2` in requirements.txt
3. Modifica `app.py` per usare PostgreSQL
4. Connessione automatica da variabile `DATABASE_URL`

**Opzione C: Sincronizzare con Cloud Storage**
- Google Cloud Storage
- AWS S3
- Azure Blob Storage

---

## Troubleshooting

### Errore: "Module not found"
→ Assicurati che tutti i package siano in `requirements.txt`

### Errore: "Port already in use"
→ Render gestisce il PORT automaticamente. Non hardcodare la porta!

### Errore: "Connection refused"
→ Verifica che il `host` sia `0.0.0.0` e non `127.0.0.1`

### Database non persiste tra i deploy
→ Questo è normale su Render (filesystem ephemeral). Usa PostgreSQL per dati persistenti.

### App lenta
→ Aumenta worker processes in `startCommand` (da 4 a 8)

---

## Comandi Utili

**Visualizzare i log in tempo reale:**
```bash
# Su Render dashboard → Web Service → Logs
```

**Accedere a una console shell:**
```
Render Dashboard → Web Service → Shell
```

**Redeploy manuale:**
```
Render Dashboard → Web Service → Manual Deploy
```

---

## Checklist Pre-Deploy

- [ ] `requirements.txt` contiene tutte le dipendenze
- [ ] `render.yaml` è configurato correttamente
- [ ] File `.env.example` documentato
- [ ] PORT è dinamico in `app.py` (da `os.environ.get("PORT")`)
- [ ] Host è `0.0.0.0` (non `127.0.0.1`)
- [ ] SECRET_KEY è da variabile d'ambiente
- [ ] Debug mode è disabilitato in produzione
- [ ] Credenziali non sono commitmate nel codice

---

## Supporto

- Documentazione Render: https://render.com/docs
- Flask on Render: https://render.com/docs/deploy-flask
- Gunicorn: https://gunicorn.org/

**Fatto!** La tua app è pronta per Render! 🚀
