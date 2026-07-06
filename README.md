# KeyMaster Report

**Painel de controle para projetos pessoais, com auth, persistência em nuvem e chat de IA embutido.**

![status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)


---

KeyMaster nasceu de um problema simples: quando você tem vários projetos pessoais rodando ao mesmo tempo, é fácil perder o fio da meada — o que já foi feito, o que ainda tem bug, o que era aquela ideia de estilo que você anotou há duas semanas. É um dashboard single-page para organizar isso tudo por projeto, com checklists, anotações e um chat de IA que conhece o contexto do que você está construindo. Acesse em: ![keyreport.vercel.app](keyreport.vercel.app)

## Índice

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Um detalhe de arquitetura: o indicador de status](#um-detalhe-de-arquitetura-o-indicador-de-status)
- [Como rodar](#como-rodar)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Limitações conhecidas](#limitações-conhecidas)
- [Roadmap](#roadmap)
- [Licença](#licença)

## Funcionalidades

| | |
|---|---|
| **Autenticação** | Login por e-mail/senha via Supabase Auth |
| **Projetos** | Criação, listagem e exclusão, cada um isolado com seus próprios dados |
| **Checklists** | Abas separadas para Funções, Bugs e Configurações — itens marcáveis e removíveis |
| **Notas de estilo** | Campo livre por projeto para diretrizes visuais e decisões de design |
| **Chat com IA** | Integração com Groq (`llama-3.3-70b-versatile`), histórico persistido por projeto |
| **Tema** | Claro/escuro, persistido em `localStorage` |
| **Persistência** | Dupla: Supabase como fonte de verdade, `localStorage` como cache local |

## Stack

| Camada | Tecnologia |
|---|---|
| Interface | HTML5, CSS3 (custom properties, glassmorphism), JavaScript vanilla |
| Autenticação e banco | [Supabase](https://supabase.com/) (Postgres + Auth) |
| IA | [Groq API](https://console.groq.com/) |
| Persistência local | `localStorage` |

## Um detalhe de arquitetura: o indicador de status

A bolinha de status no canto da tela não é só cosmética — ela reflete o estado real da aplicação. O problema de indicadores de "carregando" feitos com um booleano simples (`isLoading = true/false`) é que eles quebram assim que duas operações assíncronas rodam em paralelo: a primeira que terminar apaga o indicador, mesmo que a segunda ainda esteja em andamento.

KeyMaster resolve isso com um contador:

```js
let cargasAtivas = 0;

function iniciarCarregamento() {
    cargasAtivas++;
    atualizarStatusDot();
}

function finalizarCarregamento() {
    cargasAtivas = Math.max(0, cargasAtivas - 1);
    atualizarStatusDot();
}
```

Toda operação que toca o Supabase ou faz trabalho pesado — salvar um projeto, trocar de aba, mandar uma mensagem no chat — chama `iniciarCarregamento()` no início e `finalizarCarregamento()` dentro de um `finally`, garantindo que o contador desça mesmo se a operação falhar. O dot só volta a ficar verde quando `cargasAtivas` chega a zero — ou seja, quando **nada** mais está em andamento, não só a última coisa que você disparou.

## Como rodar

**Pré-requisitos:** uma conta no [Supabase](https://supabase.com/) e uma chave de API da [Groq](https://console.groq.com/).

1. **Banco de dados** — crie uma tabela `projetos` no Supabase:

   | coluna | tipo |
   |---|---|
   | `id` | `uuid`, chave primária |
   | `nome` | `text` |
   | `user_id` | `uuid`, referência ao usuário autenticado |
   | `dados` | `jsonb` |

2. **Autenticação** — habilite o provedor Email/Password em *Authentication* e configure políticas de *Row Level Security* na tabela `projetos` para que cada usuário acesse apenas os próprios registros.

3. **Credenciais** — em `app.js`, aponte para o seu projeto Supabase:

   ```js
   const supabaseClient = window.supabase.createClient(
       'SUA_URL_SUPABASE',
       'SUA_CHAVE_ANON'
   );
   ```
   > A chave *anon* do Supabase é pública por design — feita para rodar no navegador. A segurança real vem das políticas de RLS, não do sigilo dessa chave. Ainda assim, se for versionar em um repositório público, vale considerar variáveis de ambiente com um passo de build leve (ex: Vite), especialmente se as policies ainda não estiverem restritas.

4. **Chat de IA** — gere uma chave em [console.groq.com](https://console.groq.com/) e cole no campo de configuração dentro da própria aplicação; ela fica em `localStorage`, nunca no código.

5. **Execução** — sirva os arquivos com um servidor local (ex: extensão *Live Server* do VS Code, ou `npx serve`). Abrir via `file://` direto costuma bloquear as requisições ao Supabase por CORS.

## Estrutura do projeto

```
.
├── index.html   # marcação da aplicação
├── style.css    # tema, layout e componentes
└── app.js       # autenticação, projetos, checklists, chat, status-dot
```

## Limitações conhecidas

- `buscarProjetos()` e `carregarProjetosDoSupabase()` fazem consultas equivalentes à tabela `projetos`; a primeira é herança de uma versão anterior e hoje não atualiza a interface.
- A chave anônima do Supabase está hardcoded em `app.js` — ver nota de segurança acima.

## Roadmap

- [ ] Variáveis de ambiente para credenciais
- [ ] Exportar/importar projetos em JSON ou similares
- [ ] Ajustar estilos e funções 'duplicadas'
- [ ] Melhorar expansividade para telas pequenas

## Licença

MIT — use, modifique e adapte livremente.
