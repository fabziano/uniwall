class DatabaseManager {
    constructor(dbName, dbVersion, storeName) {
        this.DB_NAME = dbName;
        this.DB_VERSION = dbVersion;
        this.STORE_NAME = storeName;
        this.db = null;
    }

    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async ensureDbOpen() {
        if (!this.db) {
            await this.openDB();
        }
    }

    async getAllImages() {
        await this.ensureDbOpen();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
}

class ImageRotationManager {
    constructor(dbManager, interval, lateralCount, elementIds) {
        this.dbManager = dbManager;
        this.INTERVALO_ROTACAO = interval;
        this.QUANTIDADE_LATERAIS = lateralCount;
        this.posicoesImagens = elementIds;
        
        this.imagensJSON = [];
        this.indicePrincipal = 0;
        this.intervalId = null;
    }
    
    getSafeIndex(index) {
        const total = this.imagensJSON.length;
        return total > 0 ? (index % total + total) % total : 0;
    }

    async carregarDados() {
        try {
            const dados = await this.dbManager.getAllImages();
            
            if (dados.length > 0) {
                this.imagensJSON = dados.sort((a, b) => a.id - b.id);
                this.indicePrincipal = this.imagensJSON.length - 1; 
                this.iniciarRotacao();
            } else {
                console.log("Nenhuma imagem encontrada no banco de dados.");
            }
        } catch (erro) {
            console.error('Erro ao carregar:', erro);
        }
    }

    iniciarRotacao() {
        if (this.imagensJSON.length === 0) return;
        
        this.atualizarTodasImagens();
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        this.intervalId = setInterval(this.proximaRotacao.bind(this), this.INTERVALO_ROTACAO);
    }
    
    proximaRotacao() {
        this.indicePrincipal = this.getSafeIndex(this.indicePrincipal + 1);
        this.atualizarTodasImagens();
    }

    atualizarTodasImagens() {
        const totalImagens = this.imagensJSON.length;
        if (totalImagens === 0) return;

        const elementoPrincipal = document.getElementById(this.posicoesImagens[0]);
        const imagemPrincipal = this.imagensJSON[this.indicePrincipal];
        
        if (elementoPrincipal && imagemPrincipal) {
            elementoPrincipal.src = imagemPrincipal.base64;
            elementoPrincipal.alt = `Principal ID: ${imagemPrincipal.id}`;
        } else if (elementoPrincipal) {
            elementoPrincipal.src = '';
            elementoPrincipal.alt = `Vazio`;
        }

        const indicePrimeiraLateral = this.getSafeIndex(this.indicePrincipal + 1);

        for (let i = 1; i <= this.QUANTIDADE_LATERAIS; i++) {
            const elementoImg = document.getElementById(this.posicoesImagens[i]);
            const indiceArray = this.getSafeIndex(indicePrimeiraLateral + (i - 1)); 

            const imagemAtual = this.imagensJSON[indiceArray];

            if (elementoImg && imagemAtual) {
                elementoImg.src = imagemAtual.base64;
                elementoImg.alt = `Lateral ID: ${imagemAtual.id}`;
            } else if (elementoImg) {
                elementoImg.src = '';
                elementoImg.alt = `Vazio`;
            }
        }
    }
}

const DB_NAME = 'fotosDB';
const DB_VERSION = 1;
const STORE_NAME = 'fotos';

const INTERVALO_ROTACAO = 5000;
const QUANTIDADE_LATERAIS = 6;
const POSICOES_IMAGENS = [
    'img-principal',
    'img-foto1',
    'img-foto2',
    'img-foto3',
    'img-foto4',
    'img-foto5',
    'img-foto6'
];

const dbManager = new DatabaseManager(DB_NAME, DB_VERSION, STORE_NAME);
const rotationManager = new ImageRotationManager(dbManager, INTERVALO_ROTACAO, QUANTIDADE_LATERAIS, POSICOES_IMAGENS);

rotationManager.carregarDados();