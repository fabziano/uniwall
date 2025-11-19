class IndexedDBManager {
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

    async saveImage(imageObject) {
        await this.ensureDbOpen();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.put(imageObject);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async saveAllImages(imageArray) {
        await this.ensureDbOpen();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            
            store.clear();
            
            imageArray.forEach(image => {
                store.put(image);
            });

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
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

    async deleteImage(id) {
        await this.ensureDbOpen();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
}

class UIManager {
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.imageJSON = [];
        this.imageInput = document.getElementById('image-upload');
        this.jsonInput = document.getElementById('json-upload');
        this.saveJsonButton = document.getElementById('save-json');
        this.imageGridContainer = document.getElementById('image-grid');
        this.imageListSection = document.getElementById('image-list-section');
        this.TARGET_WIDTH = 720;
        this.TARGET_HEIGHT = 1280;

        this.attachEventListeners();
    }

    attachEventListeners() {
        this.imageInput.addEventListener('change', this.handleImageUpload.bind(this));
        this.jsonInput.addEventListener('change', this.handleJsonUpload.bind(this));
        this.saveJsonButton.addEventListener('click', this.saveJSON.bind(this));
    }

    async loadDataFromDB() {
        try {
            const data = await this.dbManager.getAllImages();
            this.imageJSON = data.sort((a, b) => a.id - b.id);
            this.renderGrid();
        } catch (error) {
            console.error('Erro ao carregar dados do IndexedDB:', error);
        }
    }

    async handleImageUpload() {
        const file = this.imageInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = this.TARGET_WIDTH;
                canvas.height = this.TARGET_HEIGHT;

                ctx.drawImage(img, 0, 0, this.TARGET_WIDTH, this.TARGET_HEIGHT);

                const base64DataUrl = canvas.toDataURL('image/webp', 1.0);

                canvas.toBlob(async (blob) => {
                    if (!blob) return;

                    const imageId = Date.now();
                    const newImage = {
                        id: imageId,
                        base64: base64DataUrl
                    };

                    try {
                        await this.dbManager.saveImage(newImage);
                        this.imageJSON.push(newImage);
                        this.imageJSON.sort((a, b) => a.id - b.id);
                        this.renderGrid();
                    } catch (error) {
                        console.error('Erro ao salvar imagem no DB:', error);
                    } finally {
                        this.imageInput.value = null;
                    }

                }, 'image/webp');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async handleJsonUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                const isValid = Array.isArray(data) && data.every(item =>
                    typeof item.id === 'number' &&
                    typeof item.base64 === 'string' &&
                    item.base64.startsWith('data:image/webp')
                );

                if (isValid) {
                    await this.dbManager.saveAllImages(data);
                    this.imageJSON = data;
                    this.imageJSON.sort((a, b) => a.id - b.id);
                    this.renderGrid();
                }
            } catch (error) {
                console.error('Erro ao processar JSON:', error);
            } finally {
                e.target.value = null;
            }
        };
        reader.readAsText(file);
    }

    renderGrid() {
        this.imageGridContainer.innerHTML = '';

        if (this.imageJSON.length === 0) {
            this.imageListSection.style.display = 'none';
            this.saveJsonButton.disabled = true;
            return;
        }

        this.imageListSection.style.display = 'block';
        this.saveJsonButton.disabled = false;

        this.imageJSON.forEach(item => {
            const card = document.createElement('div');
            card.className = 'image-card';
            card.dataset.id = item.id;

            const imgContainer = document.createElement('div');
            imgContainer.className = 'card-image-container';

            const imgElement = document.createElement('img');
            imgElement.src = item.base64;
            imgElement.className = 'table-image';
            imgElement.alt = 'Imagem';
            imgContainer.appendChild(imgElement);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Excluir';
            deleteButton.className = 'delete-button';
            deleteButton.addEventListener('click', () => this.deleteImage(item.id));

            card.appendChild(imgContainer);
            card.appendChild(deleteButton);
            this.imageGridContainer.appendChild(card);
        });
    }

    async deleteImage(id) {
        const confirmation = window.confirm(`Tem certeza que deseja excluir a imagem?`);

        if (confirmation) {
            try {
                await this.dbManager.deleteImage(id);
                this.imageJSON = this.imageJSON.filter(item => item.id !== id);
                this.renderGrid();
            } catch (error) {
                console.error('Erro ao excluir do DB:', error);
            }
        }
    }

    saveJSON() {
        const jsonString = JSON.stringify(this.imageJSON, null, 2);
        const filename = 'imagens.json';
        const blob = new Blob([jsonString], { type: 'application/json' });

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }
}

const DB_NAME = 'fotosDB';
const DB_VERSION = 1;
const STORE_NAME = 'fotos';

const dbManager = new IndexedDBManager(DB_NAME, DB_VERSION, STORE_NAME);
const uiManager = new UIManager(dbManager);

uiManager.loadDataFromDB();