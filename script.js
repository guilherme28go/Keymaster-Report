// ==========================================================
// 0. SISTEMA CENTRAL DE STATUS (status-dot)
// ==========================================================

let cargasAtivas = 0;

function iniciarCarregamento() {
    cargasAtivas++;
    atualizarStatusDot();
}

function finalizarCarregamento() {
    cargasAtivas = Math.max(0, cargasAtivas - 1);
    atualizarStatusDot();
}


function atualizarStatusDot() {
    const dot = document.querySelector('.status-dot');
    if (!dot) return;

    if (cargasAtivas > 0) {
        dot.classList.add('carregando');
        dot.classList.remove('status-success', 'status-error');
    } else {
        dot.classList.remove('carregando');
    }
}

window.definirStatus = function (estado) {
    const dot = document.querySelector('.status-dot');
    if (!dot) return;

    if (estado === 'saving') {
        iniciarCarregamento();
        return;
    }

    // success / error / neutral: encerra a carga que 'saving' abriu
    finalizarCarregamento();

    if (estado === 'success') {
        dot.classList.add('status-success');
        setTimeout(() => dot.classList.remove('status-success'), 800);
    } else if (estado === 'error') {
        dot.classList.add('status-error');
        setTimeout(() => dot.classList.remove('status-error'), 1500);
    }
    // 'neutral' não precisa fazer mais nada: atualizarStatusDot()
    // já deixou o dot verde se não houver mais cargas ativas.
};

iniciarCarregamento();

// ==========================================================
// 1. SUPABASE
// ==========================================================

const supabaseClient = window.supabase.createClient(
    'https://zunqzecprgjzezqocjia.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bnF6ZWNwcmdqemV6cW9jamlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTE5NzEsImV4cCI6MjA5ODU2Nzk3MX0.tiVOfIW27Fy8AizcVNqYVAr2OQyAdfJi4tPCSDceOOY'
);

// ==========================================================
// 2. ESTADO GLOBAL
// ==========================================================

let appState = {
    projetos: JSON.parse(localStorage.getItem('keymaster_spa_projetos')) || {},
    projetoAtivo: null,
    abaAtiva: 'estilo'
};

// ==========================================================
// 3. LOGIN / SESSÃO
// ==========================================================

window.fazerLogin = async function () {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    iniciarCarregamento();
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: senha,
        });

        if (error) return alert("Erro no login: " + error.message);

        verificarEstadoLogin();
    } finally {
        finalizarCarregamento();
    }
};

window.realizarLogin = async function () {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    iniciarCarregamento();
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: senha,
        });

        if (error) {
            alert("Erro no login: " + error.message);
        } else {
            // A troca de tela é feita automaticamente pelo onAuthStateChange
            console.log("Login realizado com sucesso!");
        }
    } catch (e) {
        console.error("Erro inesperado:", e);
    } finally {
        finalizarCarregamento();
    }
};

window.fazerLogoff = async function () {
    iniciarCarregamento();
    try {
        await supabaseClient.auth.signOut();
        verificarEstadoLogin();
    } finally {
        finalizarCarregamento();
    }
};

// Única definição (a antiga estava duplicada e a primeira versão
// tinha um bug: atribuía o retorno de `.style.display = 'none'`
// à variável loginContainer em vez do próprio elemento).
function verificarEstadoLogin() {
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-principal');

    if (!loginContainer) {
        console.warn("Elemento 'login-container' não encontrado no HTML. Pulando...");
        return;
    }
    if (!appContainer) {
        console.warn("Elemento 'app-principal' não encontrado no HTML. Pulando...");
        return;
    }

    iniciarCarregamento();
    supabaseClient.auth.getUser()
        .then((res) => {
            if (res.data.user) {
                console.log("Usuário logado, mostrando o App.");
                loginContainer.style.display = 'none';
                appContainer.style.display = 'block';
            } else {
                console.log("Usuário deslogado, mostrando o Login.");
                loginContainer.style.display = 'block';
                appContainer.style.display = 'none';
            }
        })
        .catch(err => {
            console.error("Erro ao verificar usuário no Supabase:", err);
        })
        .finally(() => {
            finalizarCarregamento();
        });
}

// ==========================================================
// 4. CARREGAMENTO DE PROJETOS (Supabase)
// ==========================================================

async function carregarProjetosDoSupabase() {
    console.log("Buscando projetos no Banco de Dados...");

    iniciarCarregamento();
    try {
        const { data, error } = await supabaseClient.from('projetos').select('*');

        if (error) {
            console.error("Erro ao buscar projetos:", error.message);
            return;
        }

        appState.projetos = {};
        if (data) {
            data.forEach(item => {
                appState.projetos[item.nome] = item.dados;
            });
        }
        renderizarProjetos();
    } finally {
        finalizarCarregamento();
    }
}

// ==========================================================
// 5. INICIALIZAÇÃO (único DOMContentLoaded)
// ==========================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Tema salvo
    const savedTheme = localStorage.getItem('keymaster_theme') || 'light-theme';
    const body = document.getElementById('app-body');
    if (body) body.className = savedTheme;

    const atualizarTela = (logado) => {
        const loginContainer = document.getElementById('login-container');
        const appPrincipal = document.getElementById('app-principal');
        if (!loginContainer || !appPrincipal) return;

        if (logado) {
            loginContainer.style.display = 'none';
            appPrincipal.style.display = 'block';
            appPrincipal.style.visibility = 'visible';
            appPrincipal.style.opacity = '1';
            appPrincipal.style.position = 'relative';

            carregarProjetosDoSupabase();
        } else {
            loginContainer.style.display = 'flex';
            appPrincipal.style.display = 'none';
        }
    };

    try {
        // Verifica sessão inicial
        const { data: { session } } = await supabaseClient.auth.getSession();
        atualizarTela(!!session);

        // Ouve mudanças de login (login ou logout)
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log("auth event:", event);
            atualizarTela(!!session);
        });

        configurarInputsChecklist();
    } finally {
        // Encerra a carga aberta lá no topo do arquivo (iniciarCarregamento()
        // logo após a definição do sistema de status).
        finalizarCarregamento();
    }
});

// ==========================================================
// 6. PROJETOS (lista)
// ==========================================================

window.renderizarProjetos = function () {
    const lista = document.getElementById('listaProjetos');
    if (!lista) return;
    lista.innerHTML = '';

    const chaves = Object.keys(appState.projetos);
    if (chaves.length === 0) {
        lista.innerHTML = '<p style="color: var(--text-muted); font-style: italic; font-size: 14px; grid-column: 1/-1;">Nenhum projeto encontrado. Comece criando um acima!</p>';
        return;
    }

    chaves.forEach(nome => {
        const card = document.createElement('div');
        card.className = 'projeto-card';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div>
                    <h3 style="display: flex; align-items: center; gap: 8px; margin: 0 0 5px 0;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-color, #3b82f6);">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        ${nome}
                    </h3>
                    <span>Clique para entrar nas funções</span>
                </div>

                <button class="btn-deletar-projeto" style="background: transparent; border: none; cursor: pointer; padding: 5px; color: #9ca3af; display: flex; align-items: center; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#9ca3af'" title="Excluir Projeto">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;

        card.querySelector('.btn-deletar-projeto').addEventListener('click', (event) => {
            event.stopPropagation();
            removerProjeto(nome);
        });

        card.addEventListener('click', () => entrarNoProjeto(nome));
        lista.appendChild(card);
    });
};

window.adicionarProjeto = async function () {
    const nomeInput = document.getElementById('nomeProjeto');
    const nome = nomeInput.value.trim();
    if (!nome) return alert("Digite um nome!");

    iniciarCarregamento();
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            alert("Você precisa estar logado para criar um projeto.");
            return;
        }

        const novoProjeto = {
            nome: nome,
            user_id: user.id,
            dados: { estilo: '', campoFuncoes: [], campoBugs: [], campoConfig: [], historicoChat: '' }
        };

        const { error } = await supabaseClient
            .from('projetos')
            .insert([novoProjeto]);

        if (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar no servidor: " + error.message);
            return;
        }

        appState.projetos[nome] = novoProjeto.dados;
        renderizarProjetos();
        entrarNoProjeto(nome);
    } finally {
        finalizarCarregamento();
    }
};

window.removerProjeto = async function (nome) {
    if (!confirm(`Deseja mesmo excluir o projeto "${nome}"?`)) return;

    iniciarCarregamento();
    try {
        const { error } = await supabaseClient
            .from('projetos')
            .delete()
            .eq('nome', nome);

        if (error) throw error;

        delete appState.projetos[nome];
        localStorage.setItem('keymaster_spa_projetos', JSON.stringify(appState.projetos));

        console.log(`Projeto "${nome}" excluído com sucesso do banco e do local.`);
        renderizarProjetos();
    } catch (err) {
        console.error("Erro ao excluir projeto:", err);
        alert("Erro ao excluir do banco de dados: " + err.message);
    } finally {
        finalizarCarregamento();
    }
};

// ==========================================================
// 7. NAVEGAÇÃO ENTRE TELAS
// ==========================================================

window.entrarNoProjeto = function (nome) {
    iniciarCarregamento();
    try {
        appState.projetoAtivo = nome;
        const proj = appState.projetos[nome];

        const tituloPainel = document.getElementById('painelTituloProjeto');
        if (tituloPainel) {
            tituloPainel.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-color, #3b82f6);">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Projeto: ${nome}
                </div>
            `;
        }

        const campoEstilo = document.getElementById('campoEstilo');
        if (campoEstilo) campoEstilo.value = proj.estilo || '';

        renderizarChecklist('campoFuncoes');
        renderizarChecklist('campoBugs');
        renderizarChecklist('campoConfig');

        const chatContainer = document.getElementById('iaAnaliseTexto');
        if (chatContainer) {
            chatContainer.innerHTML = proj.historicoChat
                ? proj.historicoChat
                : `<div class="ai-message bot">Bem-vindo ao painel do <strong>${nome}</strong>! Crie e marque os checklists nas abas e use o chat de IA de forma integrada.</div>`;
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        document.getElementById('tela-inicial').classList.add('escondido');
        document.getElementById('tela-projeto').classList.remove('escondido');
    } finally {
        finalizarCarregamento();
    }
};

window.voltarParaInicial = function () {
    appState.projetoAtivo = null;
    document.getElementById('tela-projeto').classList.add('escondido');
    document.getElementById('tela-inicial').classList.remove('escondido');
    renderizarProjetos();
};

window.mudarAba = function (idAba) {
    appState.abaAtiva = idAba;
    document.querySelectorAll('.secao-aba').forEach(sec => sec.classList.add('escondido'));

    const abaAlvo = document.getElementById(`conteudo-${idAba}`);
    if (abaAlvo) abaAlvo.classList.remove('escondido');

    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${idAba}'`)) {
            btn.classList.add('active');
        }
    });
};

// ==========================================================
// 8. ABA "ESTILO"
// ==========================================================

window.salvarDadosAba = async function (tipo) {
    const nomeProj = appState.projetoAtivo;
    if (!nomeProj) {
        console.error("Erro: Nenhum projeto ativo selecionado!");
        return;
    }

    if (tipo !== 'estilo') return;

    iniciarCarregamento();
    try {
        const valorEstilo = document.getElementById('campoEstilo').value;
        appState.projetos[nomeProj].estilo = valorEstilo;

        localStorage.setItem('keymaster_spa_projetos', JSON.stringify(appState.projetos));

        // Limpeza profunda do objeto antes de mandar pro Supabase
        const dadosLimpos = JSON.parse(JSON.stringify(appState.projetos[nomeProj]));

        console.log("Enviando para Supabase (Limpo):", dadosLimpos);

        const { data, error } = await supabaseClient
            .from('projetos')
            .update({ dados: dadosLimpos })
            .eq('nome', nomeProj)
            .select();

        if (error) throw error;

        if (data && data.length === 0) {
            console.warn("Aviso: Projeto não encontrado pelo nome:", nomeProj);
            alert("Erro: Projeto não encontrado no banco de dados.");
        } else {
            console.log("Dados salvos com sucesso!", data);
        }

        const chatContainer = document.getElementById('iaAnaliseTexto');
        if (chatContainer) {
            chatContainer.innerHTML += `<div class="ai-message bot" style="color:#10b981;"><em>Dados salvos na nuvem!</em></div>`;
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    } catch (err) {
        console.error("Erro no Supabase:", err);
        alert("Erro ao salvar: " + err.message);
    } finally {
        finalizarCarregamento();
    }
};

// ==========================================================
// 9. CHECKLISTS (Funções / Bugs / Config)
// ==========================================================

function configurarInputsChecklist() {
    const ids = ['campoFuncoes', 'campoBugs', 'campoConfig'];
    ids.forEach(id => {
        const input = document.getElementById(`${id}-input`);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    adicionarItemChecklist(id);
                }
            });
        }
    });
}

window.adicionarItemChecklist = function (idCampo) {
    const input = document.getElementById(`${idCampo}-input`);
    if (!input || !input.value.trim() || !appState.projetoAtivo) return;

    iniciarCarregamento();
    try {
        const texto = input.value.trim();
        const proj = appState.projetos[appState.projetoAtivo];

        if (!proj[idCampo] || !Array.isArray(proj[idCampo])) {
            proj[idCampo] = [];
        }

        proj[idCampo].push({ texto: texto, concluido: false });
        input.value = '';

        localStorage.setItem('keymaster_spa_projetos', JSON.stringify(appState.projetos));
        renderizarChecklist(idCampo);
    } finally {
        finalizarCarregamento();
    }
};

function renderizarChecklist(idCampo) {
    const container = document.getElementById(`${idCampo}-container`);
    if (!container || !appState.projetoAtivo) return;
    container.innerHTML = '';

    const proj = appState.projetos[appState.projetoAtivo];
    const itens = proj[idCampo] || [];

    if (itens.length === 0) {
        container.innerHTML = '<em style="color:gray; font-size:14px;">Nenhum item adicionado.</em>';
        return;
    }

    itens.forEach((item, index) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '10px';
        div.style.marginBottom = '8px';
        div.style.background = 'rgba(255,255,255,0.05)';
        div.style.padding = '8px 12px';
        div.style.borderRadius = '6px';
        div.className = 'campoConfig-container';

        div.innerHTML = `
            <input type="checkbox" ${item.concluido ? 'checked' : ''}
                   onchange="alternarItemChecklist('${idCampo}', ${index})">

            <span class="texto-item" style="text-decoration: ${item.concluido ? 'line-through' : 'none'}; color: ${item.concluido ? 'gray' : 'inherit'}; flex-grow: 1;">
                ${item.texto}
            </span>

            <button class="btn-excluir-item" onclick="removerItemChecklist('${idCampo}', ${index})" title="Remover item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        container.appendChild(div);
    });
}

window.alternarItemChecklist = function (idCampo, index) {
    iniciarCarregamento();
    try {
        const proj = appState.projetos[appState.projetoAtivo];
        proj[idCampo][index].concluido = !proj[idCampo][index].concluido;
        localStorage.setItem('keymaster_spa_projetos', JSON.stringify(appState.projetos));
        renderizarChecklist(idCampo);
    } finally {
        finalizarCarregamento();
    }
};

window.removerItemChecklist = function (idCampo, index) {
    iniciarCarregamento();
    try {
        const proj = appState.projetos[appState.projetoAtivo];
        proj[idCampo].splice(index, 1);
        localStorage.setItem('keymaster_spa_projetos', JSON.stringify(appState.projetos));
        renderizarChecklist(idCampo);
    } finally {
        finalizarCarregamento();
    }
};

// ==========================================================
// 10. TEMA
// ==========================================================

window.alternarTema = function () {
    const body = document.getElementById('app-body');
    body.className = body.classList.contains('light-theme') ? 'dark-theme' : 'light-theme';
    localStorage.setItem('keymaster_theme', body.className);
};

// ==========================================================
// 11. CHAT COM IA / API KEY
// ==========================================================

window.salvarApiKey = function () {
    iniciarCarregamento();
    try {
        const apiKeyInput = document.getElementById('apiKey');
        const key = apiKeyInput.value.trim();

        if (!key) {
            alert("Por favor, digite uma chave válida.");
            return;
        }

        localStorage.setItem('keymaster_groq_key', key);
        alert("Chave API salva com sucesso! O chat já pode ser usado.");
    } finally {
        finalizarCarregamento();
    }
};

window.enviarChatIA = async function () {
    const inputChat = document.getElementById('chatInput');
    const textoMensagem = inputChat.value.trim();
    const chatContainer = document.getElementById('iaAnaliseTexto');
    const apiKey = localStorage.getItem('keymaster_groq_key');

    if (!textoMensagem || !apiKey) return alert("Configure sua chave do Groq!");

    chatContainer.innerHTML += `<div class="ai-message user">${textoMensagem}</div>`;
    inputChat.value = '';

    iniciarCarregamento();
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: textoMensagem }]
            })
        });

        const data = await response.json();
        const respostaIA = data.choices[0].message.content;

        chatContainer.innerHTML += `<div class="ai-message bot">${respostaIA}</div>`;
    } catch (err) {
        chatContainer.innerHTML += `<div class="ai-message bot">Erro: ${err.message}</div>`;
    } finally {
        finalizarCarregamento();
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;

    if (appState.projetoAtivo) {
        appState.projetos[appState.projetoAtivo].historicoChat = chatContainer.innerHTML;
        localStorage.setItem('keymaster_spa_projetos', JSON.stringify(appState.projetos));
    }
};

// ==========================================================
// 12. BUSCA DE PROJETOS
// ==========================================================
// Observação: esta função e `carregarProjetosDoSupabase` fazem
// basicamente a mesma consulta ('projetos').select('*'). Mantive
// as duas por segurança (caso algo no HTML chame `buscarProjetos`
// diretamente), mas vale avaliar se realmente precisa das
// duas rodando — hoje ela só loga no console e não atualiza
// appState nem a tela.

async function buscarProjetos() {
    console.log("Status: Carregando...");

    iniciarCarregamento();
    try {
        const { error } = await supabaseClient
            .from('projetos')
            .select('*');

        if (error) throw error;

        console.log("Dados carregados com sucesso!");
    } catch (err) {
        console.error("Erro na busca:", err);
    } finally {
        finalizarCarregamento();
        console.log("Status: Finalizado.");
    }
}