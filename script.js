// ==========================================
// CONFIGURAÇÃO DO GOOGLE APPS SCRIPT
// ==========================================
// COLOQUE SUA URL DO GOOGLE APPS SCRIPT AQUI ENTRE AS ASPAS:
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyu1twHs2RzhrKeMoM3qsXaDffc8nX9I-IUPuBQTy8U9P9eEUp1SbvV41yKkCSal7dJHg/exec';

// Estado Local
let categories = [];
let bookmarks = [];
let notesHtml = ''; // Guarda as anotações
let activeCategoryId = 'cat_all';
let searchQuery = '';
let isEditMode = false;

// Elementos DOM
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const bookmarksGrid = document.getElementById('bookmarks-grid');
const bookmarkModal = document.getElementById('bookmark-modal');
const bookmarkForm = document.getElementById('bookmark-form');
const categoryModal = document.getElementById('category-modal');
const categoryForm = document.getElementById('category-form');
const syncStatus = document.getElementById('sync-status');
const themeToggle = document.getElementById('theme-toggle');
const searchInput = document.getElementById('search-input');

// Elementos Anotações
const notesModal = document.getElementById('notes-modal');
const notesEditor = document.getElementById('notes-editor');

// ==========================================
// THEME (Dark/Light Mode)
// ==========================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-theme');
        document.getElementById('theme-icon').setAttribute('data-lucide', 'sun');
    }
}
initTheme();

themeToggle.onclick = () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-icon').setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons();
};

// ==========================================
// CONTROLE DO MENU LATERAL
// ==========================================
function setIsSidebarOpen(open) {
    sidebar.classList.toggle('open', open);
    sidebarOverlay.classList.toggle('open', open);
}
document.getElementById('open-sidebar').onclick = () => setIsSidebarOpen(true);
document.getElementById('close-sidebar').onclick = () => setIsSidebarOpen(false);
sidebarOverlay.onclick = () => setIsSidebarOpen(false);

// ==========================================
// GOOGLE SHEETS SYNC (NUVEM)
// ==========================================
async function carregarDaNuvem() {
    syncStatus.innerHTML = '<i data-lucide="refresh-cw" class="spin"></i> Carregando...';
    lucide.createIcons();
    
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        const data = await response.json();
        
        // Separa os dados lidos do App Script (Células A1 e A2)
        const bd = data.bookmarksData || { categories: [], bookmarks: [] };
        notesHtml = data.notesData || '';
        
        if (!bd.categories || bd.categories.length === 0) {
            categories = [{ id: 'cat_all', name: 'Todos' }, { id: 'cat_geral', name: 'Geral' }];
            bookmarks = [];
        } else {
            categories = bd.categories;
            bookmarks = bd.bookmarks;
        }
        
        render();
        syncStatus.innerHTML = '<i data-lucide="cloud-check"></i> Sincronizado';
    } catch (error) {
        console.error("Erro ao carregar do Sheets:", error);
        syncStatus.innerHTML = '<i data-lucide="cloud-off"></i> Erro ao conectar';
        categories = JSON.parse(localStorage.getItem('bkp_categories')) || [{ id: 'cat_all', name: 'Todos' }];
        bookmarks = JSON.parse(localStorage.getItem('bkp_bookmarks')) || [];
        notesHtml = localStorage.getItem('bkp_notes') || '';
        render();
    }
    lucide.createIcons();
}

async function salvarNaNuvem() {
    // Backup Local
    localStorage.setItem('bkp_categories', JSON.stringify(categories));
    localStorage.setItem('bkp_bookmarks', JSON.stringify(bookmarks));
    localStorage.setItem('bkp_notes', notesHtml);
    
    syncStatus.innerHTML = '<i data-lucide="refresh-cw" class="spin"></i> Salvando...';
    lucide.createIcons();
    
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                bookmarksData: { categories, bookmarks },
                notesData: notesHtml 
            })
        });
        syncStatus.innerHTML = '<i data-lucide="cloud-check"></i> Sincronizado';
    } catch (error) {
        console.error("Erro ao salvar:", error);
        syncStatus.innerHTML = '<i data-lucide="cloud-off"></i> Salvo Localmente';
    }
    lucide.createIcons();
}

// ==========================================
// EDITOR DE ANOTAÇÕES (RICH TEXT)
// ==========================================
document.getElementById('btn-notes').onclick = () => {
    notesEditor.innerHTML = notesHtml; // Carrega as anotações atuais
    notesModal.classList.remove('hidden');
};

document.getElementById('close-notes-modal').onclick = () => {
    notesModal.classList.add('hidden');
};

document.getElementById('save-notes-btn').onclick = () => {
    notesHtml = notesEditor.innerHTML; // Salva o HTML gerado pelo editor
    notesModal.classList.add('hidden');
    salvarNaNuvem(); // Envia para a nuvem
};

// Formatação do texto do editor
window.formatText = (command) => {
    document.execCommand(command, false, null);
    notesEditor.focus();
};

// ==========================================
// INTERFACE E RENDERIZAÇÃO
// ==========================================
searchInput.oninput = (e) => { searchQuery = e.target.value; render(); };

function render() {
    const categoryList = document.getElementById('category-list');
    categoryList.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `cat-btn ${activeCategoryId === cat.id ? 'active' : ''}`;
        btn.innerHTML = `<span>${cat.name}</span> ${isEditMode && cat.id !== 'cat_all' ? `<i data-lucide="trash-2" class="trash" onclick="deleteCategory('${cat.id}', event)"></i>` : ''}`;
        btn.onclick = () => { activeCategoryId = cat.id; setIsSidebarOpen(false); render(); };
        categoryList.appendChild(btn);
    });

    const select = document.getElementById('link-category');
    select.innerHTML = '<option value="" disabled selected>Selecione...</option>';
    categories.filter(c => c.id !== 'cat_all').forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id; opt.textContent = cat.name;
        select.appendChild(opt);
    });

    bookmarksGrid.innerHTML = '';
    const filtered = bookmarks.filter(b => {
        const matchesCat = activeCategoryId === 'cat_all' || b.categoryId === activeCategoryId;
        const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.url.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
    }).sort((a, b) => b.dateAdded - a.dateAdded);

    document.getElementById('current-category-label').textContent = categories.find(c => c.id === activeCategoryId)?.name || 'Todos';

    if (filtered.length === 0) {
        document.getElementById('no-results').classList.remove('hidden');
    } else {
        document.getElementById('no-results').classList.add('hidden');
        filtered.forEach(b => {
            const hostname = new URL(b.url).hostname.replace('www.', '');
            const card = document.createElement('div');
            card.className = 'bookmark-card';
            card.innerHTML = `
                <a href="${b.url}" target="_blank" rel="noopener noreferrer" class="bookmark-link">
                    <div class="favicon-container"><img src="https://www.google.com/s2/favicons?domain=${hostname}&sz=64" alt=""></div>
                    <div class="bookmark-info">
                        <h3 class="bookmark-title">${b.title}</h3>
                        <p class="bookmark-url">${hostname}</p>
                    </div>
                </a>
                ${isEditMode ? `
                    <div class="card-actions">
                        <button class="card-action-btn" onclick="editBookmark('${b.id}', event)" title="Editar"><i data-lucide="pencil" style="width: 16px;"></i></button>
                        <button class="card-action-btn delete" onclick="deleteBookmark('${b.id}', event)" title="Excluir"><i data-lucide="trash-2" style="width: 16px;"></i></button>
                    </div>
                ` : ''}
            `;
            bookmarksGrid.appendChild(card);
        });
    }
    lucide.createIcons();
}

// ==========================================
// AÇÕES DE EDIÇÃO E FORMULÁRIOS
// ==========================================
document.getElementById('toggle-edit-mode').onclick = (e) => {
    isEditMode = !isEditMode;
    e.currentTarget.classList.toggle('active', isEditMode);
    document.getElementById('btn-new-link').classList.toggle('hidden', !isEditMode);
    document.getElementById('sidebar-footer').classList.toggle('hidden', !isEditMode);
    render();
};

window.editBookmark = (id, e) => {
    if (e) e.stopPropagation();
    const b = bookmarks.find(item => item.id === id);
    if (!b) return;
    
    document.getElementById('modal-title').textContent = 'Editar Link';
    document.getElementById('bookmark-id').value = b.id;
    document.getElementById('link-title').value = b.title;
    document.getElementById('link-url').value = b.url;
    document.getElementById('link-category').value = b.categoryId;
    bookmarkModal.classList.remove('hidden');
};

document.getElementById('btn-new-link').onclick = () => {
    bookmarkForm.reset();
    document.getElementById('modal-title').textContent = 'Novo Link';
    document.getElementById('bookmark-id').value = '';
    bookmarkModal.classList.remove('hidden');
};

document.getElementById('close-bookmark-modal').onclick = () => bookmarkModal.classList.add('hidden');

bookmarkForm.onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('bookmark-id').value;
    const title = document.getElementById('link-title').value;
    let url = document.getElementById('link-url').value;
    const categoryId = document.getElementById('link-category').value;
    if (!url.startsWith('http')) url = 'https://' + url;

    if (id) {
        const idx = bookmarks.findIndex(b => b.id === id);
        if (idx !== -1) bookmarks[idx] = { ...bookmarks[idx], title, url, categoryId };
    } else {
        bookmarks.push({ id: 'b_' + Date.now(), title, url, categoryId: categoryId || 'cat_all', dateAdded: Date.now() });
    }

    bookmarkModal.classList.add('hidden');
    render();
    salvarNaNuvem();
};

// Modais de Categoria
document.getElementById('btn-add-category').onclick = () => { 
    categoryForm.reset(); 
    categoryModal.classList.remove('hidden'); 
};
document.getElementById('close-category-modal').onclick = () => categoryModal.classList.add('hidden');

categoryForm.onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('category-name').value.trim();
    if (!name) return;
    categories.push({ id: 'c_' + Date.now(), name });
    categoryModal.classList.add('hidden');
    render();
    salvarNaNuvem();
};

window.deleteBookmark = (id, e) => {
    if (e) e.preventDefault();
    bookmarks = bookmarks.filter(b => b.id !== id);
    render();
    salvarNaNuvem();
};

window.deleteCategory = (id, e) => {
    if (e) e.stopPropagation();
    if (confirm('Excluir esta categoria e seus links?')) {
        categories = categories.filter(c => c.id !== id);
        bookmarks = bookmarks.filter(b => b.categoryId !== id);
        if (activeCategoryId === id) activeCategoryId = 'cat_all';
        render();
        salvarNaNuvem();
    }
};

// ==========================================
// IMPORTAÇÃO DRAG & DROP (JSON FIREFOX)
// ==========================================
const dropOverlay = document.createElement('div');
dropOverlay.className = 'drop-overlay';
dropOverlay.innerHTML = '<i data-lucide="upload-cloud" style="width:64px; height:64px; margin-bottom:16px;"></i><span>Solte o arquivo de favoritos aqui</span>';
document.body.appendChild(dropOverlay);

let dragCounter = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; dropOverlay.classList.add('active'); });
window.addEventListener('dragleave', (e) => { e.preventDefault(); dragCounter--; if (dragCounter === 0) dropOverlay.classList.remove('active'); });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
    e.preventDefault(); dragCounter = 0; dropOverlay.classList.remove('active');
    const file = e.dataTransfer.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try { importBookmarks(JSON.parse(ev.target.result)); } catch(err) { alert('Erro ao processar arquivo.'); }
        };
        reader.readAsText(file);
    }
});

function importBookmarks(data) {
    let count = 0;
    function traverse(node, currentCat) {
        if (!node) return;
        let catName = currentCat;
        if (node.typeCode === 2 && node.title) {
            const ignore = ['menu', 'toolbar', 'unfiled', 'mobile', ''];
            catName = ignore.includes(node.title) ? 'DIVERSOS' : node.title;
        }
        if (node.typeCode === 1 && node.uri) {
            if (!catName || ['menu', 'toolbar', 'unfiled', 'mobile', ''].includes(catName)) catName = 'DIVERSOS';
            let cat = categories.find(c => c.name.toUpperCase() === catName.toUpperCase());
            if (!cat) {
                cat = { id: 'c_' + Date.now() + Math.random().toString(36).substring(2,7), name: catName.toUpperCase() };
                categories.push(cat);
            }
            if (!bookmarks.find(b => b.url === node.uri)) {
                bookmarks.push({
                    id: 'b_' + Date.now() + Math.random().toString(36).substring(2,7),
                    title: node.title || node.uri, url: node.uri, categoryId: cat.id,
                    dateAdded: node.dateAdded ? Math.floor(node.dateAdded / 1000) : Date.now()
                });
                count++;
            }
        }
        if (node.children) node.children.forEach(child => traverse(child, catName));
    }
    traverse(data, 'DIVERSOS');
    render();
    salvarNaNuvem();
    setTimeout(() => alert(`${count} favoritos importados com sucesso!`), 100);
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
carregarDaNuvem();