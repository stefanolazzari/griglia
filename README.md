# Griglia distribuita

Applicazione web che suddivide un'immagine o un video in una griglia e mostra una cella diversa su ogni dispositivo connesso. I client si collegano allo stesso server tramite WebSocket; i video vengono sincronizzati tra i dispositivi.

## Requisiti

- Node.js e npm
- Un browser moderno su ogni dispositivo
- I dispositivi devono poter raggiungere il computer che esegue il server sulla rete locale

## Avvio

Dalla cartella del progetto, installa le dipendenze e avvia il server:

```bash
npm install
npm start
```

Il server usa la porta `3000` per impostazione predefinita. Apri `http://localhost:3000` sul computer che lo ospita. Per collegare altri dispositivi, apri `http://<IP-del-computer>:3000` su ciascuno di essi, sostituendo `<IP-del-computer>` con l'indirizzo IP locale del computer server. Se necessario, consenti le connessioni alla porta nel firewall.

Ogni connessione al server corrisponde a un client e riceve una cella della griglia. La griglia viene ricalcolata quando i client si collegano o si disconnettono; per questo, collega tutti i dispositivi prima dell'uso.

Per usare una porta diversa, imposta la variabile d'ambiente `PORT` prima di avviare il server:

```powershell
$env:PORT = "3001"
npm start
```

## Immagini e video

Inserisci il contenuto in `public/media`. Sono supportati:

- Immagini: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Video: `.mp4`, `.webm`, `.ogv`, `.mov`

Se sono presenti più file supportati, il server sceglie il primo in ordine alfabetico. Se la cartella è vuota o non contiene file supportati, viene mostrata un'immagine di prova generata dal client.

Per cambiare il contenuto mentre il server è in esecuzione, aggiungi o sostituisci i file e ricarica le pagine dei client.

## Comandi

Nella pagina, usa:

- `i`: mostra o nasconde le informazioni sul client e sulla griglia
- `g`: mostra o nasconde il bordo della cella
- `f`: alterna tra mantenimento delle proporzioni e riempimento dello schermo
- Doppio clic o doppio tocco: mostra o nasconde le informazioni

Se il browser blocca l'avvio automatico del video, tocca o fai clic sullo schermo per avviarlo. I video sono impostati per partire senza audio.
